import { useCallback, useSyncExternalStore } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

/**
 * Plano de compra compartilhado entre todas as telas.
 *
 * O que o usuário digita em "Quero comprar" na tela de Estoque fica disponível
 * (já preenchido) em Sugestões, Pedidos, Contagens e no Dashboard — e também
 * sincroniza entre abas do navegador e no Firestore para nunca se perder.
 */

const STORAGE_KEY = "brasao:purchase-plan";

type Plan = Record<string, number>;

let plan: Plan = {};
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
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch {
      // Silencia erros de rede ou permissão offline
    }
  }, 400);
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) plan = JSON.parse(raw) as Plan;
  } catch {
    plan = {};
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      plan = e.newValue ? (JSON.parse(e.newValue) as Plan) : {};
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
              // Mescla os dados mantendo ambos sincronizados
              const merged: Plan = { ...remotePlan, ...plan };
              if (JSON.stringify(merged) !== JSON.stringify(plan)) {
                plan = merged;
                try {
                  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
                } catch {
                  // ignore
                }
                emit();
              }
            }
          }
        },
        () => {
          // ignore
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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
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
  return plan;
};
const getServerSnapshot = () => EMPTY;

export function setPlanned(productId: string, quantity: number | null) {
  load();
  if (quantity === null || Number.isNaN(quantity)) {
    const { [productId]: _drop, ...rest } = plan;
    plan = rest;
  } else {
    plan = { ...plan, [productId]: quantity };
  }
  persist();
}

export function setPlannedBatch(batch: Record<string, number>) {
  load();
  plan = { ...plan, ...batch };
  persist();
}

export function clearPlan(productIds?: string[]) {
  load();
  if (!productIds) plan = {};
  else {
    const next = { ...plan };
    for (const id of productIds) delete next[id];
    plan = next;
  }
  persist();
}

/** Plano completo (reativo). */
export function usePurchasePlan() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback(
    (productId: string, quantity: number | null) => setPlanned(productId, quantity),
    [],
  );
  const setBatch = useCallback((batch: Record<string, number>) => setPlannedBatch(batch), []);
  return { plan: value, setPlanned: set, setPlannedBatch: setBatch, clearPlan };
}

/** Quantidade planejada para um produto, com fallback na sugestão do sistema. */
export function plannedQty(plan: Plan, productId: string, fallback: number) {
  return plan[productId] ?? fallback;
}
