import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import {
  type DeliveryConfig,
  type DailyDeliveryEntry,
  type SaveDailyDeliveryInput,
  type DeliveryMonthMetrics,
  type CostClassification,
  DEFAULT_DELIVERY_CONFIG,
} from "./delivery-types";

export const DELIVERY_COLLECTION = "delivery_entries";
export const DELIVERY_CONFIG_DOC = "delivery_config";

/* -------------------------------------------------------------------------- */
/*                               CLASSIFICATION                               */
/* -------------------------------------------------------------------------- */

export function classifyDeliveryCost(
  cost: number,
  thresholds: { otimo_max: number; dentro_max: number },
): {
  status: CostClassification;
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  if (!cost || cost <= 0) {
    return {
      status: "normal",
      label: "Sem corridas",
      badgeClass: "bg-muted text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    };
  }

  if (cost <= thresholds.otimo_max) {
    return {
      status: "otimo",
      label: "Ótimo",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      dotColor: "bg-emerald-500",
    };
  }

  if (cost <= thresholds.dentro_max) {
    return {
      status: "normal",
      label: "Dentro / Normal",
      badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      dotColor: "bg-blue-500",
    };
  }

  return {
    status: "critico",
    label: "Crítico (Elevado)",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold",
    dotColor: "bg-rose-500",
  };
}

/* -------------------------------------------------------------------------- */
/*                               CONFIG HOOKS                                 */
/* -------------------------------------------------------------------------- */

export async function fetchDeliveryConfig(): Promise<DeliveryConfig> {
  try {
    const snap = await getDoc(doc(db, "settings", DELIVERY_CONFIG_DOC));
    if (snap.exists()) {
      const data = snap.data();
      return {
        propria_taxa_por_corrida:
          typeof data?.["propria_taxa_por_corrida"] === "number"
            ? data["propria_taxa_por_corrida"]
            : DEFAULT_DELIVERY_CONFIG.propria_taxa_por_corrida,
        propria_diaria_padrao:
          typeof data?.["propria_diaria_padrao"] === "number"
            ? data["propria_diaria_padrao"]
            : DEFAULT_DELIVERY_CONFIG.propria_diaria_padrao,
        propria_thresholds: {
          otimo_max:
            typeof data?.["propria_thresholds"]?.["otimo_max"] === "number"
              ? data["propria_thresholds"]["otimo_max"]
              : DEFAULT_DELIVERY_CONFIG.propria_thresholds.otimo_max,
          dentro_max:
            typeof data?.["propria_thresholds"]?.["dentro_max"] === "number"
              ? data["propria_thresholds"]["dentro_max"]
              : DEFAULT_DELIVERY_CONFIG.propria_thresholds.dentro_max,
        },
        gami_thresholds: {
          otimo_max:
            typeof data?.["gami_thresholds"]?.["otimo_max"] === "number"
              ? data["gami_thresholds"]["otimo_max"]
              : DEFAULT_DELIVERY_CONFIG.gami_thresholds.otimo_max,
          dentro_max:
            typeof data?.["gami_thresholds"]?.["dentro_max"] === "number"
              ? data["gami_thresholds"]["dentro_max"]
              : DEFAULT_DELIVERY_CONFIG.gami_thresholds.dentro_max,
        },
        updated_at: data?.["updated_at"],
        updated_by: data?.["updated_by"],
      };
    }
  } catch (err) {
    console.warn("Aviso ao carregar configurações de delivery:", err);
  }
  return DEFAULT_DELIVERY_CONFIG;
}

export function useDeliveryConfig() {
  return useQuery({
    queryKey: ["delivery_config"],
    queryFn: fetchDeliveryConfig,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveDeliveryConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      config,
      userName,
    }: {
      config: DeliveryConfig;
      userName?: string | null;
    }) => {
      const docRef = doc(db, "settings", DELIVERY_CONFIG_DOC);
      await setDoc(docRef, {
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: userName || "Usuário",
      });
      return config;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_config"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                               ENTRIES HOOKS                                */
/* -------------------------------------------------------------------------- */

export async function fetchMonthlyDeliveryEntries(monthKey: string): Promise<DailyDeliveryEntry[]> {
  try {
    const q = query(collection(db, DELIVERY_COLLECTION), where("month_key", "==", monthKey));
    const snap = await getDocs(q);
    const list: DailyDeliveryEntry[] = [];
    snap.forEach((d) => {
      list.push(d.data() as DailyDeliveryEntry);
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn(`Erro ao carregar entregas do mês ${monthKey}:`, err);
    return [];
  }
}

export function useMonthlyDeliveryEntries(monthKey: string) {
  return useQuery({
    queryKey: ["delivery_entries", monthKey],
    queryFn: () => fetchMonthlyDeliveryEntries(monthKey),
    staleTime: 1000 * 30,
  });
}

export function buildDeliveryEntryFromInput(
  input: SaveDailyDeliveryInput,
  config: DeliveryConfig,
): DailyDeliveryEntry {
  const date = input.date;
  const month_key = date.substring(0, 7);

  // Própria
  const pCorridas = Math.max(0, Math.round(Number(input.propria_corridas) || 0));
  const pTaxa =
    typeof input.propria_valor_por_corrida === "number" && input.propria_valor_por_corrida >= 0
      ? input.propria_valor_por_corrida
      : config.propria_taxa_por_corrida;
  const pDiaria =
    typeof input.propria_diaria === "number" && input.propria_diaria >= 0
      ? input.propria_diaria
      : config.propria_diaria_padrao;
  const pQtdDiarias =
    typeof input.propria_qtd_diarias === "number" && input.propria_qtd_diarias >= 0
      ? input.propria_qtd_diarias
      : pCorridas > 0
        ? 1
        : 0; // se teve corridas mas diária não foi informada, 1 diária; se 0 corridas, 0 diária a menos que explícito

  const pCustoVariavel = pCorridas * pTaxa;
  const pCustoFixo = pDiaria * pQtdDiarias;
  const pCustoTotal = pCustoVariavel + pCustoFixo;
  const pTicket = pCorridas > 0 ? Number((pCustoTotal / pCorridas).toFixed(2)) : 0;

  // Gami
  const gCorridas = Math.max(0, Math.round(Number(input.gami_corridas) || 0));
  const gCustoTotal = Math.max(0, Number(input.gami_custo_total) || 0);
  const gTicket = gCorridas > 0 ? Number((gCustoTotal / gCorridas).toFixed(2)) : 0;

  // Totais
  const totalCorridas = pCorridas + gCorridas;
  const totalCusto = pCustoTotal + gCustoTotal;
  const ticketGeral = totalCorridas > 0 ? Number((totalCusto / totalCorridas).toFixed(2)) : 0;

  // Mais vantajoso
  let maisVantajoso: DailyDeliveryEntry["mais_vantajoso"] = "sem_corridas";
  let diferencaTicket = 0;

  if (pCorridas > 0 && gCorridas > 0) {
    diferencaTicket = Number((pTicket - gTicket).toFixed(2));
    if (Math.abs(pTicket - gTicket) < 0.05) {
      maisVantajoso = "empate";
    } else if (pTicket < gTicket) {
      maisVantajoso = "propria";
    } else {
      maisVantajoso = "gami";
    }
  } else if (pCorridas > 0) {
    maisVantajoso = "apenas_propria";
  } else if (gCorridas > 0) {
    maisVantajoso = "apenas_gami";
  }

  return {
    id: date,
    date,
    month_key,
    propria_corridas: pCorridas,
    propria_valor_por_corrida: pTaxa,
    propria_diaria: pDiaria,
    propria_qtd_diarias: pQtdDiarias,
    propria_custo_variavel: pCustoVariavel,
    propria_custo_fixo: pCustoFixo,
    propria_custo_total: pCustoTotal,
    propria_ticket_medio: pTicket,
    propria_observacoes: input.propria_observacoes?.trim() || "",

    gami_corridas: gCorridas,
    gami_custo_total: gCustoTotal,
    gami_ticket_medio: gTicket,
    gami_observacoes: input.gami_observacoes?.trim() || "",

    total_corridas: totalCorridas,
    total_custo: totalCusto,
    ticket_medio_geral: ticketGeral,
    mais_vantajoso: maisVantajoso,
    diferenca_ticket: diferencaTicket,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by_user: input.userName || "Usuário",
  };
}

export function useSaveDailyDeliveryEntry() {
  const qc = useQueryClient();
  const { data: config = DEFAULT_DELIVERY_CONFIG } = useDeliveryConfig();

  return useMutation({
    mutationFn: async (input: SaveDailyDeliveryInput) => {
      const entry = buildDeliveryEntryFromInput(input, config);
      const docRef = doc(db, DELIVERY_COLLECTION, entry.id);
      await setDoc(docRef, {
        ...entry,
        server_updated_at: serverTimestamp(),
      });
      return entry;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["delivery_entries", saved.month_key] });
    },
  });
}

export function useDeleteDailyDeliveryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, monthKey }: { id: string; monthKey: string }) => {
      await deleteDoc(doc(db, DELIVERY_COLLECTION, id));
      return { id, monthKey };
    },
    onSuccess: ({ monthKey }) => {
      qc.invalidateQueries({ queryKey: ["delivery_entries", monthKey] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                               METRICS CALC                                 */
/* -------------------------------------------------------------------------- */

export function calculateDeliveryMonthMetrics(
  entries: DailyDeliveryEntry[],
  config: DeliveryConfig = DEFAULT_DELIVERY_CONFIG,
): DeliveryMonthMetrics {
  let totalCorridasGeral = 0;
  let totalCustoGeral = 0;

  let totalCorridasPropria = 0;
  let totalCustoPropria = 0;
  let propriaCustoFixo = 0;
  let propriaCustoVariavel = 0;

  let totalCorridasGami = 0;
  let totalCustoGami = 0;

  const propriaStatusCount = { otimo: 0, normal: 0, critico: 0 };
  const gamiStatusCount = { otimo: 0, normal: 0, critico: 0 };

  let diasLancados = 0;

  entries.forEach((e) => {
    if (e.total_corridas > 0 || e.total_custo > 0) {
      diasLancados++;
    }

    totalCorridasGeral += e.total_corridas;
    totalCustoGeral += e.total_custo;

    totalCorridasPropria += e.propria_corridas;
    totalCustoPropria += e.propria_custo_total;
    propriaCustoFixo += e.propria_custo_fixo;
    propriaCustoVariavel += e.propria_custo_variavel;

    totalCorridasGami += e.gami_corridas;
    totalCustoGami += e.gami_custo_total;

    if (e.propria_corridas > 0) {
      const cls = classifyDeliveryCost(e.propria_ticket_medio, config.propria_thresholds);
      propriaStatusCount[cls.status]++;
    }

    if (e.gami_corridas > 0) {
      const cls = classifyDeliveryCost(e.gami_ticket_medio, config.gami_thresholds);
      gamiStatusCount[cls.status]++;
    }
  });

  const ticketMedioGeral =
    totalCorridasGeral > 0 ? Number((totalCustoGeral / totalCorridasGeral).toFixed(2)) : 0;
  const ticketMedioPropria =
    totalCorridasPropria > 0 ? Number((totalCustoPropria / totalCorridasPropria).toFixed(2)) : 0;
  const ticketMedioGami =
    totalCorridasGami > 0 ? Number((totalCustoGami / totalCorridasGami).toFixed(2)) : 0;

  const percentualVolumePropria =
    totalCorridasGeral > 0 ? (totalCorridasPropria / totalCorridasGeral) * 100 : 0;
  const percentualVolumeGami =
    totalCorridasGeral > 0 ? (totalCorridasGami / totalCorridasGeral) * 100 : 0;

  const percentualCustoPropria =
    totalCustoGeral > 0 ? (totalCustoPropria / totalCustoGeral) * 100 : 0;
  const percentualCustoGami = totalCustoGeral > 0 ? (totalCustoGami / totalCustoGeral) * 100 : 0;

  const diferencaTicketMedio =
    ticketMedioPropria > 0 && ticketMedioGami > 0
      ? Number((ticketMedioPropria - ticketMedioGami).toFixed(2))
      : 0;

  let modalidadeMaisEconomica: DeliveryMonthMetrics["modalidadeMaisEconomica"] = "sem_dados";
  if (ticketMedioPropria > 0 && ticketMedioGami > 0) {
    if (Math.abs(ticketMedioPropria - ticketMedioGami) < 0.1) {
      modalidadeMaisEconomica = "empate";
    } else if (ticketMedioPropria < ticketMedioGami) {
      modalidadeMaisEconomica = "propria";
    } else {
      modalidadeMaisEconomica = "gami";
    }
  } else if (ticketMedioPropria > 0) {
    modalidadeMaisEconomica = "propria";
  } else if (ticketMedioGami > 0) {
    modalidadeMaisEconomica = "gami";
  }

  return {
    totalCorridasGeral,
    totalCustoGeral,
    ticketMedioGeral,
    totalCorridasPropria,
    totalCustoPropria,
    ticketMedioPropria,
    propriaCustoFixo,
    propriaCustoVariavel,
    totalCorridasGami,
    totalCustoGami,
    ticketMedioGami,
    percentualVolumePropria,
    percentualVolumeGami,
    percentualCustoPropria,
    percentualCustoGami,
    diferencaTicketMedio,
    modalidadeMaisEconomica,
    diasLancados,
    propriaStatusCount,
    gamiStatusCount,
  };
}
