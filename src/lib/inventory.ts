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

export type DayOfWeek = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom" | "seg2";

export type DailyConsumption = {
  seg: number;
  ter: number;
  qua: number;
  qui: number;
  sex: number;
  sab: number;
  dom: number;
  seg2: number;
};

export type ConsumptionMode = "constant" | "custom";

export const DAYS_OF_WEEK: Array<{ key: DayOfWeek; label: string; short: string }> = [
  { key: "seg", label: "Segunda-feira", short: "SEG" },
  { key: "ter", label: "Terça-feira", short: "TER" },
  { key: "qua", label: "Quarta-feira", short: "QUA" },
  { key: "qui", label: "Quinta-feira", short: "QUI" },
  { key: "sex", label: "Sexta-feira", short: "SEX" },
  { key: "sab", label: "Sábado", short: "SÁB" },
  { key: "dom", label: "Domingo", short: "DOM" },
  { key: "seg2", label: "Segunda-feira (2)", short: "SEG 2" },
];

export const DEFAULT_DAILY_CONSUMPTION: DailyConsumption = {
  seg: 0,
  ter: 0,
  qua: 0,
  qui: 0,
  sex: 0,
  sab: 0,
  dom: 0,
  seg2: 0,
};

export function sumDailyConsumption(daily: Partial<DailyConsumption> | null | undefined): number {
  if (!daily) return 0;
  const s =
    (Number(daily.seg) || 0) +
    (Number(daily.ter) || 0) +
    (Number(daily.qua) || 0) +
    (Number(daily.qui) || 0) +
    (Number(daily.sex) || 0) +
    (Number(daily.sab) || 0) +
    (Number(daily.dom) || 0) +
    (Number(daily.seg2) || 0);
  return Math.round((s + Number.EPSILON) * 1000) / 1000;
}

export function createConstantDailyConsumption(value: number): DailyConsumption {
  const v = Math.max(0, Number(value) || 0);
  return {
    seg: v,
    ter: v,
    qua: v,
    qui: v,
    sex: v,
    sab: v,
    dom: v,
    seg2: v,
  };
}

export function getDailyConsumptionFromProduct(p: Partial<ProductRow>): DailyConsumption {
  if (p.daily_consumption) {
    return {
      seg: Number(p.daily_consumption.seg) || 0,
      ter: Number(p.daily_consumption.ter) || 0,
      qua: Number(p.daily_consumption.qua) || 0,
      qui: Number(p.daily_consumption.qui) || 0,
      sex: Number(p.daily_consumption.sex) || 0,
      sab: Number(p.daily_consumption.sab) || 0,
      dom: Number(p.daily_consumption.dom) || 0,
      seg2:
        p.daily_consumption.seg2 !== undefined && p.daily_consumption.seg2 !== null
          ? Number(p.daily_consumption.seg2) || 0
          : Number(p.daily_consumption.seg) || 0,
    };
  }
  const weekly = Number(p.avg_weekly_consumption) || 0;
  const perDay = Math.round((weekly / 8 + Number.EPSILON) * 1000) / 1000;
  return createConstantDailyConsumption(perDay);
}

export type ProductRow = {
  id: string;
  code: number | null;
  description: string;
  unit: string;
  current_stock: number;
  avg_weekly_consumption: number;
  daily_consumption_mode?: ConsumptionMode;
  daily_consumption?: DailyConsumption;
  constant_daily_consumption?: number;
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
  futureStatus: StockStatus;
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

  const futureStatus = futureStatusFor(futureStock, Number(p.min_stock), rules);

  return {
    ...p,
    categoryName: p.categories?.name ?? "—",
    supplierName: p.suppliers?.name ?? "—",
    projectedStock,
    suggestedPurchase,
    futureStock,
    status,
    futureStatus,
  };
}

/**
 * Status do estoque futuro:
 * Conforme regra de negócio: só fica 'critico' se for igual ou menor que zero (<= 0).
 * O intuito é comprar sempre na margem máxima para suprir o consumo médio.
 * Se > 0 e abaixo ou no limiar do estoque mínimo -> 'atencao'.
 * Acima do estoque mínimo -> 'normal'.
 */
export function futureStatusFor(
  futureStock: number,
  minStock: number,
  rules: PurchaseRules = DEFAULT_RULES,
): StockStatus {
  const future = Number(futureStock) || 0;
  const min = Number(minStock) || 0;

  // Só fica crítico se for igual ou menor que zero
  if (future <= 0) {
    return "critico";
  }

  const threshold = min * (1 + (rules.attention_threshold_percent || 0) / 100);
  if (future < min || (min > 0 && future <= threshold)) {
    return "atencao";
  }

  return "normal";
}

/**
 * Status de um produto para uma quantidade de estoque atual qualquer
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

export const movementLabel = (t: string) => MOVEMENT_TYPES.find((m) => m.value === t)?.label ?? t;

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
