import { useCallback, useSyncExternalStore } from "react";

/**
 * Plano de compra compartilhado entre todas as telas.
 *
 * O que o usuário digita em "Quero comprar" na tela de Estoque fica disponível
 * (já preenchido) em Sugestões, Pedidos, Contagens e no Dashboard — e também
 * sincroniza entre abas do navegador.
 */

const STORAGE_KEY = "brasao:purchase-plan";

type Plan = Record<string, number>;

let plan: Plan = {};
let loaded = false;
const listeners = new Set<() => void>();

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
  return { plan: value, setPlanned: set, clearPlan };
}

/** Quantidade planejada para um produto, com fallback na sugestão do sistema. */
export function plannedQty(plan: Plan, productId: string, fallback: number) {
  return plan[productId] ?? fallback;
}
