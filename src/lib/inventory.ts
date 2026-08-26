/**
 * Regras de negócio do controle de estoque e compras.
 * Todos os cálculos ficam centralizados aqui e são parametrizáveis
 * por configurações (settings.purchase_rules), nunca fixos no código das telas.
 */

export type PurchaseRules = {
  coverage_weeks: number;
  safety_margin_percent: number;
  default_lead_time_days: number;
  attention_threshold_percent: number;
};

export const DEFAULT_RULES: PurchaseRules = {
  coverage_weeks: 1,
  safety_margin_percent: 0,
  default_lead_time_days: 0,
  attention_threshold_percent: 20,
};

export type StockStatus = "critico" | "atencao" | "normal";

export type ProductRow = {
  id: string;
  code: number | null;
  description: string;
  unit: string;
  current_stock: number;
  avg_weekly_consumption: number;
  min_stock: number;
  desired_stock: number;
  coverage_weeks: number | null;
  safety_stock: number;
  lead_time_days: number;
  notes: string | null;
  active: boolean;
  category_id: string | null;
  supplier_id: string | null;
  categories?: { name: string } | null;
  suppliers?: { name: string } | null;
};

export type ComputedProduct = ProductRow & {
  categoryName: string;
  supplierName: string;
  projectedStock: number;
  suggestedPurchase: number;
  futureStock: number;
  status: StockStatus;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function computeProduct(
  p: ProductRow,
  rules: PurchaseRules = DEFAULT_RULES,
  incoming = 0,
): ComputedProduct {
  const weeks = p.coverage_weeks ?? rules.coverage_weeks ?? 1;
  const consumption = Number(p.avg_weekly_consumption) || 0;
  const current = Number(p.current_stock) || 0;
  const desired = Number(p.desired_stock) || 0;
  const safety = Number(p.safety_stock) || 0;
  const margin = 1 + (rules.safety_margin_percent || 0) / 100;

  const projectedStock = round(current - consumption * weeks);

  const rawSuggestion = (desired - current + consumption * weeks) * margin + safety - incoming;
  const suggestedPurchase = round(Math.max(0, rawSuggestion));
  const futureStock = round(current + suggestedPurchase - consumption * weeks);

  let status: StockStatus = "normal";
  if (projectedStock < 0 || (consumption > 0 && current < consumption)) {
    status = "critico";
  } else if (
    current <= Number(p.min_stock) * (1 + (rules.attention_threshold_percent || 0) / 100) ||
    projectedStock < Number(p.min_stock)
  ) {
    status = "atencao";
  }
  if (consumption === 0 && suggestedPurchase === 0) status = "normal";

  return {
    ...p,
    categoryName: p.categories?.name ?? "—",
    supplierName: p.suppliers?.name ?? "—",
    projectedStock,
    suggestedPurchase,
    futureStock,
    status,
  };
}

/**
 * Status de um produto para uma quantidade de estoque qualquer
 * (usado para prever o status do estoque futuro em tempo real).
 */
export function statusFor(
  stock: number,
  consumption: number,
  minStock: number,
  rules: PurchaseRules = DEFAULT_RULES,
): StockStatus {
  const current = Number(stock) || 0;
  const cons = Number(consumption) || 0;
  const min = Number(minStock) || 0;
  const projected = current - cons;
  if (projected < 0 || (cons > 0 && current < cons)) return "critico";
  if (current <= min * (1 + (rules.attention_threshold_percent || 0) / 100) || projected < min)
    return "atencao";
  return "normal";
}

export const STATUS_LABEL: Record<StockStatus, string> = {

  critico: "Crítico",
  atencao: "Atenção",
  normal: "Normal",
};

export const MOVEMENT_TYPES = [
  { value: "contagem", label: "Contagem" },
  { value: "entrada_compra", label: "Entrada de compra" },
  { value: "ajuste_positivo", label: "Ajuste positivo" },
  { value: "ajuste_negativo", label: "Ajuste negativo" },
  { value: "perda", label: "Perda" },
  { value: "consumo", label: "Consumo" },
  { value: "correcao", label: "Correção" },
] as const;

export const movementLabel = (t: string) =>
  MOVEMENT_TYPES.find((m) => m.value === t)?.label ?? t;

export const ORDER_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "solicitacao_enviada", label: "Solicitação enviada" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "pedido_realizado", label: "Pedido realizado" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const orderStatusLabel = (s: string) =>
  ORDER_STATUSES.find((o) => o.value === s)?.label ?? s;

export const OPEN_ORDER_STATUSES = [
  "rascunho",
  "solicitacao_enviada",
  "aguardando_aprovacao",
  "aprovado",
  "pedido_realizado",
];

export function formatQty(n: number | null | undefined, unit?: string) {
  const v = Number(n ?? 0);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${s} ${unit}` : s;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
