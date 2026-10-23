import { getPostOperationMode } from "./post-operation";

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
  is_post_operation?: boolean;
};

export const DEFAULT_RULES: PurchaseRules = {
  coverage_weeks: 1,
  safety_margin_percent: 0,
  default_lead_time_days: 0,
  attention_threshold_percent: 20,
  is_post_operation: false,
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

export const DAYS_CYCLE_ORDER: DayOfWeek[] = [
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
  "dom",
  "seg2",
];

/** Mapeia a data real para o dia do ciclo de 8 dias (Segunda a Segunda) */
export function getDayOfWeekFromDate(d: Date = new Date()): DayOfWeek {
  const day = d.getDay();
  switch (day) {
    case 1:
      return "seg";
    case 2:
      return "ter";
    case 3:
      return "qua";
    case 4:
      return "qui";
    case 5:
      return "sex";
    case 6:
      return "sab";
    case 0:
      return "dom";
    default:
      return "seg";
  }
}

/**
 * Retorna os dias restantes no ciclo de 8 dias a partir de um dia referencial até a 2ª feira (seg2).
 * Quando isPostOperation = true (contagem pós-operação / fechamento / noite), o consumo do próprio dia vigente
 * já aconteceu. Logo, os dias restantes a serem supridos começam a partir do dia seguinte!
 * Exemplo: se hoje é Sábado e é pós-operação, restam apenas Domingo e Segunda (2 dias, não 3).
 */
export function getRemainingCycleDays(refDay: DayOfWeek, isPostOperation = false): DayOfWeek[] {
  if (refDay === "seg" && !isPostOperation) {
    // Na segunda-feira pré-operação (manhã da chegada), a compra abastece o ciclo que se inicia hoje.
    // Portanto, o consumo prévio até a chegada é zero (o estoque atual já é o saldo que entra na 2ª feira).
    return [];
  }
  const idx = DAYS_CYCLE_ORDER.indexOf(refDay);
  if (idx === -1) return [...DAYS_CYCLE_ORDER];
  const startIdx = isPostOperation ? idx + 1 : idx;
  if (startIdx >= DAYS_CYCLE_ORDER.length) {
    return [];
  }
  return DAYS_CYCLE_ORDER.slice(startIdx);
}

/** Retorna um texto legível dos dias restantes, ex: 'Dom a Seg (2 dias - Pós-operação)' */
export function getRemainingDaysLabel(refDay: DayOfWeek, isPostOperation = false): string {
  const days = getRemainingCycleDays(refDay, isPostOperation);
  if (days.length === 0) {
    if (refDay === "seg" && !isPostOperation) {
      return "Chegada hoje (2ª feira)";
    }
    return "0 dias restantes (Ciclo atual concluído)";
  }
  const first = DAYS_OF_WEEK.find((d) => d.key === days[0])?.short ?? "Amanhã";
  const last = DAYS_OF_WEEK.find((d) => d.key === days[days.length - 1])?.short ?? "SEG 2";
  const suffix = isPostOperation ? " (Pós-op)" : "";
  if (days.length === 1) return `${first} (1 dia)${suffix}`;
  return `${first} a ${last} (${days.length} dias)${suffix}`;
}

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
  futureStockWithSuggestion?: number;
  status: StockStatus;
  futureStatus: StockStatus;
  referenceDay: DayOfWeek;
  remainingDaysCount: number;
  remainingDaysLabel: string;
  remainingConsumption: number;
  projectedCycleEndStock: number;
  targetTurnover: number;
  isPostOperation: boolean;
  effectiveCurrentStock?: number;
  todayConsumption?: number;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function computeProduct(
  p: ProductRow,
  rules: PurchaseRules = DEFAULT_RULES,
  incoming = 0,
  refDay: DayOfWeek = getDayOfWeekFromDate(),
  isPostOperation: boolean = rules.is_post_operation ?? getPostOperationMode(),
  isStockAlreadyPostOp: boolean = false,
): ComputedProduct {
  const weeks = p.coverage_weeks ?? rules.coverage_weeks ?? 1;
  const consumption = Number(p.avg_weekly_consumption) || 0;
  const current = Number(p.current_stock) || 0;
  const desired = Number(p.desired_stock) || 0;
  const safety = Number(p.safety_stock) || 0;
  const margin = 1 + (rules.safety_margin_percent || 0) / 100;

  // Consumo diário do produto
  const daily = getDailyConsumptionFromProduct(p);
  const todayConsumption = round(Number(daily[refDay]) || 0);

  // Giro semanal do ciclo (Segunda a Segunda, 8 dias):
  // O estoque deve durar de uma segunda-feira até a outra.
  // Se o item tem consumo diário customizado, soma os 8 dias (ex: 5kg x 8 = 40kg).
  // Se for constante ou semanal, usa constant_daily_consumption * 8, avg_weekly_consumption ou a soma diária.
  const cycleWeeklyConsumption =
    p.daily_consumption_mode === "custom" && p.daily_consumption
      ? sumDailyConsumption(daily)
      : p.constant_daily_consumption && p.constant_daily_consumption > 0
        ? round(p.constant_daily_consumption * 8)
        : Number(p.avg_weekly_consumption) || sumDailyConsumption(daily);

  // Demanda necessária para sustentar a semana de Segunda a Segunda:
  const weeklyDemand = round(weeks * cycleWeeklyConsumption);

  // Tratamento da flag pós-operação:
  // - Em PRÉ-OPERAÇÃO (isPostOperation = false):
  //   A operação de hoje ainda NÃO ocorreu. O consumo do dia de referência ainda acontecerá.
  //   Dias restantes a consumir incluem o dia de hoje e vão até a 2ª feira (Seg2).
  //   Exemplo do usuário: domingo pré-op com 10kg de estoque -> giro hoje (dom) = 5kg e amanhã (seg) = 5kg -> consome 10kg.
  // - Em PÓS-OPERAÇÃO (isPostOperation = true):
  //   "se hoje é domingo de manhã e eu marco a flag 'pos-operação', então deduzo que já usei o consumo definido no cadastro daquele dia".
  //   Se a contagem ainda não é pós-operação (!isStockAlreadyPostOp), deduz o consumo de hoje do estoque atual.
  //   Portanto, os dias restantes a suprir começam a partir de amanhã até a 2ª feira (Seg2).
  const effectiveCurrent =
    isPostOperation && !isStockAlreadyPostOp && refDay !== "seg2"
      ? round(current - todayConsumption)
      : current;

  const remainingDays = getRemainingCycleDays(refDay, isPostOperation);
  let remainingConsumption = 0;
  for (const dayKey of remainingDays) {
    remainingConsumption += Number(daily[dayKey]) || 0;
  }
  remainingConsumption = round(remainingConsumption);
  const remainingDaysLabel = getRemainingDaysLabel(refDay, isPostOperation);

  // Saldo de estoque previsto que vai sobrar na 2ª feira (sem compra):
  // (Estoque Efetivo - Consumo Restante dos dias até a 2ª feira)
  // No exemplo do usuário: 10kg no domingo - 10kg de consumo até 2ª = 0kg.
  const projectedCycleEndStock = round(effectiveCurrent - remainingConsumption);

  // Demanda necessária a suprir dependendo do momento da compra:
  // 1) Na segunda-feira pré-operação (comprando no início do ciclo semanal de 8 dias para durar até a próxima segunda):
  //    targetDemand = weeklyDemand (ex: 80kg)
  //    availableStock = current (ex: 30kg)
  //    Falta comprar = 80kg - 30kg = 50kg! Para que no final da semana reste 0kg!
  // 2) No domingo (comprando o pedido semanal que chega na 2ª feira):
  //    targetDemand = weeklyDemand (ex: 40kg)
  //    availableStock = projectedCycleEndStock (ex: 0kg)
  //    Falta comprar = 40kg - 0kg = 40kg!
  // 3) No meio da semana (terça a sábado):
  //    targetDemand = remainingConsumption (o consumo restante de amanhã até a outra segunda)
  //    availableStock = effectiveCurrent (o estoque atual disponível)
  //    Falta comprar = remainingConsumption - effectiveCurrent! Para que dure até a outra segunda perto de 0!
  let targetDemand = weeklyDemand;
  let availableStock = current;

  if (refDay === "seg" && !isPostOperation) {
    targetDemand = weeklyDemand;
    availableStock = current;
  } else if (refDay === "dom") {
    targetDemand = weeklyDemand;
    availableStock = projectedCycleEndStock;
  } else {
    targetDemand = remainingConsumption;
    availableStock = effectiveCurrent;
  }

  // Margem de segurança opcional (se explicitamente configurada e pequena <= 10):
  const marginPercent = Math.max(0, Number(rules.safety_margin_percent) || 0);
  const percentBuffer = marginPercent > 0 ? round(targetDemand * (marginPercent / 100)) : 0;
  const safetyBuffer = safety > 0 && safety <= 10 ? safety : 0;
  const targetBuffer = Math.min(10, Math.max(safetyBuffer, percentBuffer));

  // Compra sugerida:
  // A quantidade que falta para suprir o consumo até a próxima segunda-feira e terminar perto de 0 (0, 1, 2, 3, no máximo 10)
  // Caso o produto esteja inativo (bloqueado), a compra sugerida é travada em 0
  const isInactive = p.active === false;
  const rawSuggestion = Math.max(0, targetDemand + targetBuffer - availableStock - incoming);
  const roundedRaw = round(rawSuggestion);
  const suggestedPurchase = isInactive ? 0 : roundedRaw > 0 ? Math.ceil(roundedRaw) : 0;

  // Projeções de estoque futuro na próxima 2ª feira (saldo residual que restará após todo o consumo do período):
  // - Sem compra: estoque disponível menos a demanda do período (pode ser negativo/déficit caso não compre)
  const futureStock = round(availableStock + incoming - targetDemand);
  // - Com compra sugerida: estoque disponível + compra sugerida - demanda do período (sempre perto de 0!)
  const futureStockWithSuggestion = round(
    availableStock + incoming + suggestedPurchase - targetDemand,
  );
  const projectedStock = projectedCycleEndStock;
  const targetTurnover = round(targetDemand);

  // Status do estoque: só é crítico se o saldo previsto na 2ª feira for menor que zero (< 0)
  let status: StockStatus = "normal";
  if (projectedCycleEndStock < 0) {
    status = "critico";
  } else if (
    current <= Number(p.min_stock) * (1 + (rules.attention_threshold_percent || 0) / 100) ||
    projectedCycleEndStock < Number(p.min_stock) ||
    projectedCycleEndStock === 0
  ) {
    status = "atencao";
  }
  if (remainingConsumption === 0 && current > 0) status = "normal";

  const futureStatus = futureStatusFor(futureStockWithSuggestion, Number(p.min_stock), rules);

  return {
    ...p,
    categoryName: p.categories?.name ?? "—",
    supplierName: p.suppliers?.name ?? "—",
    projectedStock,
    suggestedPurchase,
    futureStock,
    futureStockWithSuggestion,
    status,
    futureStatus,
    referenceDay: refDay,
    remainingDaysCount: remainingDays.length,
    remainingDaysLabel,
    remainingConsumption,
    projectedCycleEndStock,
    targetTurnover,
    isPostOperation,
    effectiveCurrentStock: effectiveCurrent,
    todayConsumption,
  };
}

/**
 * Status do estoque futuro:
 * Conforme regra de negócio: só fica 'critico' se for negativo (< 0, déficit).
 * O intuito é comprar sempre na margem para suprir o consumo médio e terminar perto de 0 (0 a 10).
 */
export function futureStatusFor(
  futureStock: number,
  _minStock: number,
  _rules?: PurchaseRules | null,
): StockStatus {
  const future = Number(futureStock) || 0;

  // Só fica crítico se for negativo (< 0, faltará produto antes da próxima segunda-feira)
  if (future < -0.001) {
    return "critico";
  }

  // O estoque futuro terminar perto de 0 (0 a 10) é o comportamento planejado correto
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
