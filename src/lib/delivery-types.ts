export type DeliveryType = "propria" | "gami";

export type CostClassification = "otimo" | "normal" | "critico";

export interface DeliveryThresholds {
  otimo_max: number; // Ex: <= 5.50 -> Ótimo
  dentro_max: number; // Ex: <= 7.50 -> Dentro / Normal (acima disso é Crítico)
}

export interface DeliveryConfig {
  propria_taxa_por_corrida: number; // Padrão R$ 3,50
  propria_diaria_padrao: number; // Padrão R$ 50,00
  propria_thresholds: DeliveryThresholds;
  gami_thresholds: DeliveryThresholds;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = {
  propria_taxa_por_corrida: 3.5,
  propria_diaria_padrao: 50.0,
  propria_thresholds: {
    otimo_max: 5.5,
    dentro_max: 7.5,
  },
  gami_thresholds: {
    otimo_max: 6.0,
    dentro_max: 8.0,
  },
};

export interface DailyDeliveryEntry {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  month_key: string; // YYYY-MM

  // Entregas Próprias
  propria_corridas: number;
  propria_valor_por_corrida: number;
  propria_diaria: number;
  propria_qtd_diarias: number;
  propria_custo_variavel: number;
  propria_custo_fixo: number;
  propria_custo_total: number;
  propria_ticket_medio: number;
  propria_observacoes?: string;

  // Entregas Gami / Terceirizadas
  gami_corridas: number;
  gami_custo_total: number;
  gami_ticket_medio: number;
  gami_observacoes?: string;

  // Consolidado do Dia
  total_corridas: number;
  total_custo: number;
  ticket_medio_geral: number;
  mais_vantajoso: "propria" | "gami" | "empate" | "apenas_propria" | "apenas_gami" | "sem_corridas";
  diferenca_ticket: number; // própria_ticket - gami_ticket (positivo = gami foi mais barato)

  created_at?: string;
  updated_at?: string;
  created_by_user?: string;
}

export interface SaveDailyDeliveryInput {
  date: string; // YYYY-MM-DD
  propria_corridas: number;
  propria_valor_por_corrida?: number;
  propria_diaria?: number;
  propria_qtd_diarias?: number;
  propria_observacoes?: string;

  gami_corridas: number;
  gami_custo_total: number;
  gami_observacoes?: string;

  userName?: string | null;
}

export interface DeliveryMonthMetrics {
  totalCorridasGeral: number;
  totalCustoGeral: number;
  ticketMedioGeral: number;

  totalCorridasPropria: number;
  totalCustoPropria: number;
  ticketMedioPropria: number;
  propriaCustoFixo: number;
  propriaCustoVariavel: number;

  totalCorridasGami: number;
  totalCustoGami: number;
  ticketMedioGami: number;

  // Percentuais de divisão
  percentualVolumePropria: number;
  percentualVolumeGami: number;
  percentualCustoPropria: number;
  percentualCustoGami: number;

  // Comparativo
  diferencaTicketMedio: number; // ticketMedioPropria - ticketMedioGami
  modalidadeMaisEconomica: "propria" | "gami" | "empate" | "sem_dados";
  diasLancados: number;

  // Contagens de Status
  propriaStatusCount: { otimo: number; normal: number; critico: number };
  gamiStatusCount: { otimo: number; normal: number; critico: number };
}
