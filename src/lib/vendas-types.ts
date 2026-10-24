export type SalesChannelCategory = "balcao_salao" | "delivery";

export type SalesChannelKey =
  "balcao_salao" | "delivery_ifood" | "delivery_anota_ai" | "delivery_99" | "delivery_sw_fast";

export interface SalesChannelConfig {
  key: SalesChannelKey;
  label: string;
  category: SalesChannelCategory;
  categoryLabel: string;
  color: string;
  badgeBg: string;
  description: string;
  iconName: string;
}

export const SALES_CHANNELS: Record<SalesChannelKey, SalesChannelConfig> = {
  balcao_salao: {
    key: "balcao_salao",
    label: "Balcão / Salão",
    category: "balcao_salao",
    categoryLabel: "Salão / Presencial",
    color: "#16a34a", // emerald-600
    badgeBg:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    description: "Clientes que almoçam presencialmente ou compram no balcão",
    iconName: "UtensilsCrossed",
  },
  delivery_ifood: {
    key: "delivery_ifood",
    label: "iFood",
    category: "delivery",
    categoryLabel: "Delivery",
    color: "#ea1d2c", // ifood red
    badgeBg:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    description: "Pedidos recebidos pelo marketplace iFood",
    iconName: "ShoppingBag",
  },
  delivery_anota_ai: {
    key: "delivery_anota_ai",
    label: "Anota Aí",
    category: "delivery",
    categoryLabel: "Delivery",
    color: "#0284c7", // sky-600
    badgeBg:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    description: "Pedidos via cardápio digital / WhatsApp Anota Aí",
    iconName: "Smartphone",
  },
  delivery_99: {
    key: "delivery_99",
    label: "99Food",
    category: "delivery",
    categoryLabel: "Delivery",
    color: "#f59e0b", // amber-500
    badgeBg:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    description: "Pedidos realizados pelo app 99Food",
    iconName: "Bike",
  },
  delivery_sw_fast: {
    key: "delivery_sw_fast",
    label: "SW Fast (Ligação)",
    category: "delivery",
    categoryLabel: "Delivery",
    color: "#8b5cf6", // violet-500
    badgeBg:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
    description: "Pedidos via telefone / ligação no sistema SW Fast",
    iconName: "PhoneCall",
  },
};

export interface DailySaleRecord {
  id: string;
  date: string; // YYYY-MM-DD
  channel: SalesChannelKey;
  channel_category: SalesChannelCategory;
  amount: number;
  orders_count?: number | null;
  notes?: string | null;
  created_at?: string;
  user_name?: string;
}

export interface DaySalesSummary {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: string;
  formattedDate: string;
  balcao_salao: number;
  delivery_ifood: number;
  delivery_anota_ai: number;
  delivery_99: number;
  delivery_sw_fast: number;
  totalDelivery: number;
  totalBalcao: number;
  totalDay: number;
  cumulativeMonth: number;
  totalOrders: number;
  records: DailySaleRecord[];
}

export interface MonthSalesMetrics {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  totalRevenue: number;
  totalBalcao: number;
  totalDelivery: number;
  percentBalcao: number;
  percentDelivery: number;
  channelTotals: Record<SalesChannelKey, number>;
  channelPercentages: Record<SalesChannelKey, number>;
  daysWithSalesCount: number;
  totalOrdersCount: number;
  avgDailyRevenue: number;
  bestDay: { date: string; amount: number } | null;
  lowestDay: { date: string; amount: number } | null;
  days: DaySalesSummary[];
}

export interface QuickDayEntryForm {
  date: string;
  balcao_salao: number | string;
  delivery_ifood: number | string;
  delivery_anota_ai: number | string;
  delivery_99: number | string;
  delivery_sw_fast: number | string;
  orders_count?: number | string;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*                        INTERCORRÊNCIAS & FATURAMENTO                       */
/* -------------------------------------------------------------------------- */

export type IncidentStatus = "pendente" | "em_andamento" | "resolvido";

export const INCIDENT_CATEGORIES = [
  "Clima / Chuva Torrencial",
  "iFood / App Fora do Ar",
  "Motoboy / Logística de Entrega",
  "Cozinha / Ruptura de Estoque",
  "Sistema PDV / Maquininha Travou",
  "Contato de Faturamento",
  "Falta de Energia / Água",
  "Operação / Equipe / Atraso",
  "Outros",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export interface SalesIncident {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  incident: string; // Qual foi a intercorrência
  action_taken: string; // Ação tomada
  to_meeting: boolean; // Se deve levar como pauta para reunião
  status: IncidentStatus; // Resolvido / Pendente / Em andamento
  resolution_notes?: string | null; // Retorno sobre o ocorrido / como foi solucionado
  resolved_at?: string | null;
  user_id?: string | null;
  user_name: string;
  created_at?: string;
  updated_at?: string;
}

/* -------------------------------------------------------------------------- */
/*                  ANÁLISE COMPARATIVA DE 4 SEMANAS                          */
/* -------------------------------------------------------------------------- */

export type DayComparisonStatus = "acima" | "media" | "abaixo" | "sem_historico";

export interface HistoricalWeekPoint {
  weekNumber: number; // 1 = 1 semana atrás, 2 = 2 semanas atrás, 3 = 3 semanas atrás, 4 = 4 semanas atrás
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD/MM
  dayOfWeek: string;
  amount: number;
  channels: Record<SalesChannelKey, number>;
  ordersCount: number;
  hasRecords: boolean;
}

export interface DayChannelComparison {
  channel: SalesChannelKey;
  label: string;
  categoryLabel: string;
  color: string;
  currentAmount: number;
  avgAmount: number;
  variationAmount: number;
  variationPercent: number;
  status: DayComparisonStatus;
}

export interface Day4WeeksComparison {
  targetDate: string;
  formattedTargetDate: string;
  dayOfWeek: string;
  currentDayAmount: number;
  currentDayChannels: Record<SalesChannelKey, number>;
  currentDayOrders: number;
  hasCurrentDaySales: boolean;

  historicalWeeks: HistoricalWeekPoint[];
  weeksWithDataCount: number;
  totalHistoricalAmount: number;
  avgHistoricalAmount: number;

  variationAmount: number; // currentDayAmount - avgHistoricalAmount
  variationPercent: number; // % em relação à média
  status: DayComparisonStatus;
  statusLabel: string;
  statusBadgeClass: string;
  statusCardClass: string;

  channelComparisons: DayChannelComparison[];
  incidents: SalesIncident[];
}

/* -------------------------------------------------------------------------- */
/*             PROJEÇÃO DE VENDAS & ANÁLISE SEMANAL POR PESO DIÁRIO           */
/* -------------------------------------------------------------------------- */

export interface AtypicalDayEntry {
  date: string; // YYYY-MM-DD
  isAtypical: boolean; // se é feriado ou dia atípico
  reason?: string | null; // ex: "Feriado", "Chuva torrencial", etc.
  user_name?: string | null;
  updated_at?: string | null;
}

export interface WeekdayOccurrenceDetail {
  date: string;
  formattedDate: string;
  dayOfMonth: number;
  actualAmount: number;
  projectionAmount: number;
  diffAmount: number | null;
  diffPercent: number | null;
  isAtypical: boolean;
  atypicalReason?: string | null;
  isRealized: boolean;
  status: "acima" | "media" | "abaixo" | "projetado" | "feriado";
}

export interface WeekdayWeightMetric {
  dayOfWeekIndex: number; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  dayOfWeekName: string; // "Segunda-feira", etc.
  dayOfWeekShort: string; // "Seg", etc.
  totalOccurrencesInMonth: number; // Ex: 4 segundas no mês
  pastOccurrencesCount: number; // Quantas já passaram ou foram lançadas
  normalDaysCount: number; // Quantas foram normais (com vendas > 0 e NÃO atípicas)
  atypicalDaysCount: number; // Quantas foram marcadas como atípicas/feriado
  normalDaysSum: number; // Soma do faturamento dos dias normais
  avgAmount: number; // normalDaysSum / normalDaysCount (peso médio por dia)
  isFallback: boolean; // se usou média de fallback (ex: histórico anterior)
  remainingDaysCount: number; // Quantas faltam no mês
  projectedSubtotal: number; // avgAmount * remainingDaysCount
  occurrences: WeekdayOccurrenceDetail[];
  bestOccurrence?: WeekdayOccurrenceDetail | null;
  worstOccurrence?: WeekdayOccurrenceDetail | null;
  healthStatus: "saudavel" | "estavel" | "alerta";
}

export type DayProjectionStatus = "realizado" | "projetado" | "hoje_realizado" | "hoje_pendente";

export interface DayProjectionItem {
  date: string; // YYYY-MM-DD
  dayOfMonth: number; // 1 a 31
  dayOfWeekIndex: number; // 0 a 6
  dayOfWeekName: string; // "Segunda-feira"
  dayOfWeekShort: string; // "Seg"
  formattedDate: string; // "20/10"
  weekNumber: number; // 1 a 5
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
  hasActualSales: boolean;
  actualAmount: number;
  projectedAmount: number;
  effectiveAmount: number; // actualAmount se realizado, senão projectedAmount
  projectionBenchmark: number; // O valor da projeção calculada (peso do dia)
  diffAmount: number | null; // actualAmount - projectionBenchmark (se realizado)
  diffPercent: number | null; // ((actualAmount - projectionBenchmark) / projectionBenchmark) * 100
  performanceStatus: "acima" | "media" | "abaixo" | "projetado";
  isAtypical: boolean;
  atypicalReason?: string | null;
  status: DayProjectionStatus;
  statusLabel: string;
  statusColorClass: string;
  weekdayWeight: number; // média daquele dia da semana aplicada
  cumulativeTotal: number;
}

export interface WeekComparisonItem {
  targetWeekNumber: number;
  targetLabel: string;
  diffPercent: number; // +10.5 ou -8.2
  isHigher: boolean;
}

export interface WeekProjectionGroup {
  weekNumber: number; // 1, 2, 3, 4, 5
  label: string; // "Semana 1 (01 a 07/10)", etc.
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: DayProjectionItem[];
  totalRealizado: number;
  totalProjetado: number; // dias restantes a vencer
  totalProjetadoSemana: number; // Benchmark total projetado para os 7 dias da semana (peso médio dos dias)
  benchmarkDiasRealizados: number; // Benchmark apenas dos dias já realizados
  diffRealizadoVsProjetado: number; // totalRealizado - totalProjetadoSemana
  percentAtingidoSemana: number; // (totalRealizado / totalProjetadoSemana) * 100
  diffRealizadoVsBenchmarkDiasPassados: number; // totalRealizado - benchmarkDiasRealizados (comparativo dos dias passados)
  percentAtingidoDiasPassados: number; // (totalRealizado / benchmarkDiasRealizados) * 100
  totalPrevisto: number; // totalRealizado + totalProjetado
  daysWithSalesCount: number;
  daysProjectedCount: number;
  atypicalDaysCount: number;
  isCompleted: boolean;
  isCurrentWeek: boolean;
  weightPercentOfMonth: number; // (totalPrevisto / totalPrevistoMes) * 100
  comparisons: WeekComparisonItem[]; // vs Semana 1, Semana 2, etc.
  diffVsPreviousWeek: number | null; // % vs semana imediatamente anterior
  diffVsAverageWeeks: number | null; // % vs média semanal
  healthStatus: "saudavel" | "estavel" | "alerta";
  healthLabel: string;
}

export interface MonthSalesProjectionMetrics {
  monthKey: string; // YYYY-MM
  monthLabel: string; // "Outubro de 2026"
  daysInMonth: number;
  referenceDate: string; // Data de referência (hoje)
  daysPassedCount: number;
  daysRemainingCount: number;
  totalRealizado: number;
  totalProjetado: number;
  totalBenchmarkMes: number; // Soma de benchmark de todos os dias do mês
  totalPrevistoMes: number; // totalRealizado + totalProjetado
  avgDiariaRealizada: number;
  avgDiariaProjetada: number;
  atypicalDaysCount: number;
  weekdayWeights: WeekdayWeightMetric[];
  weeks: WeekProjectionGroup[];
  days: DayProjectionItem[];
  bestDay: DayProjectionItem | null;
  worstDay: DayProjectionItem | null;
  underperformingDays: DayProjectionItem[];
}
