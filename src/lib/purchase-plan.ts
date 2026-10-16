import { useCallback, useSyncExternalStore } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

/**
 * Plano de compra compartilhado entre todas as telas ("Quero Comprar").
 *
 * O que o usuário digita em "Quero comprar" na tela de Produtos/Estoque fica disponível
 * (já preenchido) em Sugestões de Compra, Pedidos, Contagens e no Dashboard.
 * Permanece salvo de forma persistente e só se altera quando o estoque for atualizado
 * ou quando o usuário mexer manualmente.
 *
 * Todas as quantidades planejadas e sugeridas são sempre arredondadas para cima (Math.ceil).
 */

const STORAGE_KEY = "brasao:purchase-plan-v2";
// Compatibilidade retroativa com a chave antiga
const LEGACY_STORAGE_KEY = "brasao:purchase-plan";

export type Plan = Record<string, number>;

interface StoredPayload {
  plan: Plan;
  updatedAt: number;
}

let plan: Plan = {};
let lastLocalUpdate = 0;
let loaded = false;
let firestoreSubscribed = false;
const listeners = new Set<() => void>();

let firestoreSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToFirestore() {
  if (typeof window === "undefined") return;
  if (firestoreSaveTimeout) clearTimeout(firestoreSaveTimeout);
  firestoreSaveTimeout = setTimeout(async () => {
    try {
      await setDoc(
        doc(db, "settings", "purchase_plan"),
        {
          plan,
          updatedAt: lastLocalUpdate,
          updated_at: new Date().toISOString(),
        },
        // Não usa merge: true cego para que produtos removidos/zerados não reapareçam do Firestore
      );
    } catch {
      // Silencia erros de rede ou permissão offline
    }
  }, 300);
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPayload;
      if (
        parsed &&
        typeof parsed.plan === "object" &&
        parsed.plan !== null &&
        !Array.isArray(parsed.plan)
      ) {
        plan = parsed.plan;
        lastLocalUpdate = Number(parsed.updatedAt) || 0;
      }
    } else {
      // Tenta recuperar do formato legado se existir
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacyPlan = JSON.parse(legacyRaw) as Plan;
        if (
          legacyPlan &&
          typeof legacyPlan === "object" &&
          legacyPlan !== null &&
          !Array.isArray(legacyPlan)
        ) {
          plan = legacyPlan;
          lastLocalUpdate = Date.now();
        }
      }
    }
  } catch {
    plan = {};
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY && e.key !== LEGACY_STORAGE_KEY) return;
    try {
      if (e.newValue) {
        const parsed = JSON.parse(e.newValue);
        if (
          parsed &&
          parsed.plan &&
          typeof parsed.plan === "object" &&
          !Array.isArray(parsed.plan)
        ) {
          plan = parsed.plan;
          lastLocalUpdate = Math.max(lastLocalUpdate, Number(parsed.updatedAt) || 0);
        } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          plan = parsed;
        } else {
          plan = {};
        }
      } else {
        plan = {};
      }
    } catch {
      plan = {};
    }
    emit();
  });

  if (!firestoreSubscribed) {
    firestoreSubscribed = true;
    try {
      const planDocRef = doc(db, "settings", "purchase_plan");
      onSnapshot(
        planDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && typeof data["plan"] === "object" && data["plan"] !== null) {
              const remotePlan = data["plan"] as Plan;
              const remoteUpdatedAt = Number(data["updatedAt"]) || 0;

              // Só aceita o estado remoto se ele for mais recente ou se o local for virgem (0)
              if (remoteUpdatedAt >= lastLocalUpdate || lastLocalUpdate === 0) {
                // Arredonda todos os valores remotos para cima
                const normalized: Plan = {};
                for (const [k, v] of Object.entries(remotePlan)) {
                  if (typeof v === "number" && v > 0) {
                    normalized[k] = Math.ceil(v);
                  }
                }
                plan = normalized;
                lastLocalUpdate = Math.max(lastLocalUpdate, remoteUpdatedAt);
                try {
                  const payload: StoredPayload = { plan, updatedAt: lastLocalUpdate };
                  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
                } catch {
                  // ignore
                }
                emit();
              }
            }
          }
        },
        () => {
          // ignore offline
        },
      );
    } catch {
      // ignore
    }
  }
}

function emit() {
  for (const l of listeners) l();
}

function persist() {
  lastLocalUpdate = Date.now();
  try {
    const payload: StoredPayload = { plan, updatedAt: lastLocalUpdate };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignora quota/privacidade */
  }
  emit();
  syncToFirestore();
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: Plan = {};
const getSnapshot = () => {
  load();
  return plan && typeof plan === "object" && !Array.isArray(plan) ? plan : EMPTY;
};
const getServerSnapshot = () => EMPTY;

/** Define a quantidade pretendida para um produto (arredondada sempre para cima se > 0) */
export function setPlanned(productId: string, quantity: number | null) {
  load();
  const currentPlan = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  if (quantity === null || Number.isNaN(quantity)) {
    const { [productId]: _drop, ...rest } = currentPlan;
    plan = rest;
  } else {
    const rounded = quantity > 0 ? Math.ceil(quantity) : 0;
    plan = { ...currentPlan, [productId]: rounded };
  }
  persist();
}

/** Define múltiplas quantidades de uma vez (ex: aplicar todas as sugestões) */
export function setPlannedBatch(batch: Record<string, number>) {
  load();
  const currentPlan = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  const roundedBatch: Record<string, number> = {};
  for (const [id, q] of Object.entries(batch)) {
    if (typeof q === "number") {
      roundedBatch[id] = q > 0 ? Math.ceil(q) : 0;
    }
  }
  plan = { ...currentPlan, ...roundedBatch };
  persist();
}

/**
 * Limpa o plano de compra manual de produtos específicos (chamado quando o estoque é atualizado)
 * ou de todos os produtos quando solicitado.
 */
export function clearPlan(productIds?: string[]) {
  load();
  const currentPlan = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  if (!productIds || productIds.length === 0) {
    plan = {};
  } else {
    const next = { ...currentPlan };
    for (const id of productIds) {
      delete next[id];
    }
    plan = next;
  }
  persist();
}

/** Plano completo (reativo). */
export function usePurchasePlan() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const safeValue = value && typeof value === "object" && !Array.isArray(value) ? value : EMPTY;
  const set = useCallback(
    (productId: string, quantity: number | null) => setPlanned(productId, quantity),
    [],
  );
  const setBatch = useCallback((batch: Record<string, number>) => setPlannedBatch(batch), []);
  const clear = useCallback((ids?: string[]) => clearPlan(ids), []);
  return { plan: safeValue, setPlanned: set, setPlannedBatch: setBatch, clearPlan: clear };
}

/** Quantidade planejada para um produto, com fallback na sugestão arredondada para cima. */
export function plannedQty(plan: Plan, productId: string, fallback: number) {
  const v = plan[productId];
  if (v !== undefined) {
    return v > 0 ? Math.ceil(v) : 0;
  }
  return fallback > 0 ? Math.ceil(fallback) : 0;
}
