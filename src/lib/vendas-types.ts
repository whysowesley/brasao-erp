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
