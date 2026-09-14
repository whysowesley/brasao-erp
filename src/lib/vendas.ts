import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import type {
  DailySaleRecord,
  DaySalesSummary,
  MonthSalesMetrics,
  QuickDayEntryForm,
  SalesChannelKey,
  SalesIncident,
  IncidentStatus,
  Day4WeeksComparison,
  DayChannelComparison,
  HistoricalWeekPoint,
  DayComparisonStatus,
} from "@/lib/vendas-types";
import { SALES_CHANNELS } from "@/lib/vendas-types";

export const SALES_COLLECTION = "daily_sales";
export const INCIDENTS_COLLECTION = "sales_incidents";

/* -------------------------------------------------------------------------- */
/*                                    UTILS                                   */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export function getCurrentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function fetchSalesForDate(date: string): Promise<DailySaleRecord[]> {
  try {
    const q = query(collection(db, SALES_COLLECTION), where("date", "==", date));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: data["date"],
        channel: data["channel"],
        channel_category: data["channel_category"],
        amount: Number(data["amount"]) || 0,
        orders_count: data["orders_count"] ? Number(data["orders_count"]) : null,
        notes: data["notes"] || null,
        user_name: data["user_name"] || null,
        created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
          ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
          : (data["created_at"] as string) || new Date().toISOString(),
        updated_at: (data["updated_at"] as { toDate?: () => Date })?.toDate
          ? (data["updated_at"] as { toDate: () => Date }).toDate().toISOString()
          : (data["updated_at"] as string) || null,
      };
    });
  } catch (err) {
    console.error("Erro ao buscar vendas da data:", err);
    return [];
  }
}

export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getMonthLabel(monthKey: string): string {
  if (!monthKey || !monthKey.includes("-")) return monthKey;
  const [yearStr, monthStr] = monthKey.split("-");
  const monthNum = parseInt(monthStr!, 10) - 1;
  const date = new Date(parseInt(yearStr!, 10), monthNum, 1);
  const name = date.toLocaleDateString("pt-BR", { month: "long" });
  return `${name.charAt(0).toUpperCase() + name.slice(1)} de ${yearStr}`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* -------------------------------------------------------------------------- */
/*                                   QUERIES                                  */
/* -------------------------------------------------------------------------- */

export function useDailySales(monthKey?: string) {
  return useQuery({
    queryKey: ["daily_sales", monthKey],
    queryFn: async (): Promise<DailySaleRecord[]> => {
      const salesCol = collection(db, SALES_COLLECTION);
      let q = query(salesCol);

      // Se especificado monthKey (ex: "2026-09"), filtra pelo range de datas
      if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        const start = `${monthKey}-01`;
        const end = `${monthKey}-31`;
        q = query(salesCol, where("date", ">=", start), where("date", "<=", end));
      }

      const snap = await getDocs(q);
      const records: DailySaleRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const chKey = d["channel"] as SalesChannelKey;
        const config = SALES_CHANNELS[chKey];
        return {
          id: docSnap.id,
          date: String(d["date"] || ""),
          channel: chKey,
          channel_category: config ? config.category : d["channel_category"] || "delivery",
          amount: Number(d["amount"]) || 0,
          orders_count: d["orders_count"] != null ? Number(d["orders_count"]) : null,
          notes: d["notes"] || null,
          created_at: d["created_at"]?.toDate
            ? d["created_at"].toDate().toISOString()
            : d["created_at"],
          user_name: d["user_name"] || "Operador",
        };
      });

      // Ordenar por data asc, depois por canal
      return records.sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                  MUTATIONS                                 */
/* -------------------------------------------------------------------------- */

export function useSaveSaleRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      date: string;
      channel: SalesChannelKey;
      amount: number;
      orders_count?: number | null;
      notes?: string | null;
      user_name?: string;
    }) => {
      const channelConfig = SALES_CHANNELS[input.channel];
      const payload = {
        date: input.date,
        channel: input.channel,
        channel_category: channelConfig ? channelConfig.category : "delivery",
        amount: Number(input.amount) || 0,
        orders_count: input.orders_count != null ? Number(input.orders_count) : null,
        notes: input.notes ? input.notes.trim() : null,
        user_name: input.user_name || "Administrador",
        updated_at: serverTimestamp(),
      };

      if (input.id) {
        const docRef = doc(db, SALES_COLLECTION, input.id);
        await updateDoc(docRef, payload);
        return input.id;
      } else {
        const docRef = await addDoc(collection(db, SALES_COLLECTION), {
          ...payload,
          created_at: serverTimestamp(),
        });
        return docRef.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_sales"] });
    },
  });
}

export function useSaveFullDaySales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      form,
      existingRecords = [],
      userName = "Administrador",
    }: {
      form: QuickDayEntryForm;
      existingRecords?: DailySaleRecord[];
      userName?: string;
    }) => {
      const batch = writeBatch(db);
      const date = form.date;
      const salesCol = collection(db, SALES_COLLECTION);

      const channelValues: Record<SalesChannelKey, number> = {
        balcao_salao: Number(form.balcao_salao) || 0,
        delivery_ifood: Number(form.delivery_ifood) || 0,
        delivery_anota_ai: Number(form.delivery_anota_ai) || 0,
        delivery_99: Number(form.delivery_99) || 0,
        delivery_sw_fast: Number(form.delivery_sw_fast) || 0,
      };

      let existingForDay = existingRecords.filter((r) => r.date === date);
      if (existingForDay.length === 0) {
        existingForDay = await fetchSalesForDate(date);
      }

      for (const [chKey, val] of Object.entries(channelValues)) {
        const key = chKey as SalesChannelKey;
        const config = SALES_CHANNELS[key];
        const existing = existingForDay.find((r) => r.channel === key);

        if (val > 0) {
          if (existing) {
            const docRef = doc(db, SALES_COLLECTION, existing.id);
            batch.update(docRef, {
              amount: val,
              notes: form.notes ? form.notes.trim() : null,
              orders_count: form.orders_count ? Number(form.orders_count) : null,
              user_name: userName,
              updated_at: serverTimestamp(),
            });
          } else {
            const newDocRef = doc(salesCol);
            batch.set(newDocRef, {
              date,
              channel: key,
              channel_category: config.category,
              amount: val,
              notes: form.notes ? form.notes.trim() : null,
              orders_count: form.orders_count ? Number(form.orders_count) : null,
              user_name: userName,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            });
          }
        } else if (existing && val === 0) {
          // Se o usuário zerou um lançamento que existia, podemos remover ou atualizar para 0
          const docRef = doc(db, SALES_COLLECTION, existing.id);
          batch.delete(docRef);
        }
      }

      await batch.commit();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_sales"] });
    },
  });
}

export function useDeleteSaleRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, SALES_COLLECTION, id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_sales"] });
    },
  });
}

export function useDeleteDaySales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const q = query(collection(db, SALES_COLLECTION), where("date", "==", date));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_sales"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                               METRICS CALC                                 */
/* -------------------------------------------------------------------------- */

export function computeMonthSalesMetrics(
  records: DailySaleRecord[],
  monthKey: string,
): MonthSalesMetrics {
  const [yearStr, monthStr] = (monthKey || getCurrentMonthKey()).split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);

  // Total de dias no mês
  const daysInMonth = new Date(year, month, 0).getDate();

  // Filtrar apenas registros do mês
  const monthRecords = records.filter((r) => r.date.startsWith(`${monthKey}-`));

  // Mapa de data -> registros
  const dateMap = new Map<string, DailySaleRecord[]>();
  for (const r of monthRecords) {
    const list = dateMap.get(r.date) || [];
    list.push(r);
    dateMap.set(r.date, list);
  }

  let cumulativeRevenue = 0;
  let totalBalcao = 0;
  let totalDelivery = 0;
  let totalOrdersCount = 0;

  const channelTotals: Record<SalesChannelKey, number> = {
    balcao_salao: 0,
    delivery_ifood: 0,
    delivery_anota_ai: 0,
    delivery_99: 0,
    delivery_sw_fast: 0,
  };

  const days: DaySalesSummary[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const dateStr = `${monthKey}-${dayStr}`;
    const dayDate = new Date(year, month - 1, d);
    const dayOfWeek = WEEKDAYS[dayDate.getDay()]!;

    const recs = dateMap.get(dateStr) || [];

    let balcao = 0;
    let ifood = 0;
    let anotaAi = 0;
    let noventaENove = 0;
    let swFast = 0;
    let dayOrders = 0;

    for (const r of recs) {
      if (r.orders_count) dayOrders += r.orders_count;
      if (r.channel === "balcao_salao") balcao += r.amount;
      else if (r.channel === "delivery_ifood") ifood += r.amount;
      else if (r.channel === "delivery_anota_ai") anotaAi += r.amount;
      else if (r.channel === "delivery_99") noventaENove += r.amount;
      else if (r.channel === "delivery_sw_fast") swFast += r.amount;
    }

    const dayDelivery = ifood + anotaAi + noventaENove + swFast;
    const dayTotal = balcao + dayDelivery;

    cumulativeRevenue += dayTotal;
    totalBalcao += balcao;
    totalDelivery += dayDelivery;
    totalOrdersCount += dayOrders;

    channelTotals.balcao_salao += balcao;
    channelTotals.delivery_ifood += ifood;
    channelTotals.delivery_anota_ai += anotaAi;
    channelTotals.delivery_99 += noventaENove;
    channelTotals.delivery_sw_fast += swFast;

    days.push({
      date: dateStr,
      dayOfMonth: d,
      dayOfWeek,
      formattedDate: `${dayStr}/${monthStr}`,
      balcao_salao: balcao,
      delivery_ifood: ifood,
      delivery_anota_ai: anotaAi,
      delivery_99: noventaENove,
      delivery_sw_fast: swFast,
      totalDelivery: dayDelivery,
      totalBalcao: balcao,
      totalDay: dayTotal,
      cumulativeMonth: cumulativeRevenue,
      totalOrders: dayOrders,
      records: recs,
    });
  }

  const totalRevenue = totalBalcao + totalDelivery;
  const percentBalcao = totalRevenue > 0 ? (totalBalcao / totalRevenue) * 100 : 0;
  const percentDelivery = totalRevenue > 0 ? (totalDelivery / totalRevenue) * 100 : 0;

  const channelPercentages: Record<SalesChannelKey, number> = {
    balcao_salao: totalRevenue > 0 ? (channelTotals.balcao_salao / totalRevenue) * 100 : 0,
    delivery_ifood: totalRevenue > 0 ? (channelTotals.delivery_ifood / totalRevenue) * 100 : 0,
    delivery_anota_ai:
      totalRevenue > 0 ? (channelTotals.delivery_anota_ai / totalRevenue) * 100 : 0,
    delivery_99: totalRevenue > 0 ? (channelTotals.delivery_99 / totalRevenue) * 100 : 0,
    delivery_sw_fast: totalRevenue > 0 ? (channelTotals.delivery_sw_fast / totalRevenue) * 100 : 0,
  };

  const daysWithSales = days.filter((d) => d.totalDay > 0);
  const daysWithSalesCount = daysWithSales.length;
  const avgDailyRevenue = daysWithSalesCount > 0 ? totalRevenue / daysWithSalesCount : 0;

  let bestDay: { date: string; amount: number } | null = null;
  let lowestDay: { date: string; amount: number } | null = null;

  if (daysWithSales.length > 0) {
    const sorted = [...daysWithSales].sort((a, b) => b.totalDay - a.totalDay);
    const highest = sorted[0]!;
    const lowest = sorted[sorted.length - 1]!;
    bestDay = { date: highest.date, amount: highest.totalDay };
    lowestDay = {
      date: lowest.date,
      amount: lowest.totalDay,
    };
  }

  return {
    monthKey,
    monthLabel: getMonthLabel(monthKey),
    totalRevenue,
    totalBalcao,
    totalDelivery,
    percentBalcao,
    percentDelivery,
    channelTotals,
    channelPercentages,
    daysWithSalesCount,
    totalOrdersCount,
    avgDailyRevenue,
    bestDay,
    lowestDay,
    days,
  };
}

/** Hook para buscar vendas diárias em um intervalo de datas (para DRE e Relatórios) */
export function useDailySalesRange(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["daily_sales_range", startDate, endDate],
    queryFn: async (): Promise<DailySaleRecord[]> => {
      if (!startDate || !endDate) return [];
      try {
        const q = query(
          collection(db, SALES_COLLECTION),
          where("date", ">=", startDate),
          where("date", "<=", endDate),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: data["date"],
            channel: data["channel"],
            channel_category: data["channel_category"],
            amount: Number(data["amount"]) || 0,
            orders_count: data["orders_count"] ? Number(data["orders_count"]) : null,
            notes: data["notes"] || null,
            user_name: data["user_name"] || null,
            created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
              ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
              : (data["created_at"] as string) || new Date().toISOString(),
            updated_at: (data["updated_at"] as { toDate?: () => Date })?.toDate
              ? (data["updated_at"] as { toDate: () => Date }).toDate().toISOString()
              : (data["updated_at"] as string) || null,
          };
        });
      } catch (err) {
        console.error("Erro ao buscar vendas por período:", err);
        return [];
      }
    },
    enabled: Boolean(startDate && endDate),
  });
}

/* -------------------------------------------------------------------------- */
/*                 INTERCORRÊNCIAS & CONTATOS DE FATURAMENTO                  */
/* -------------------------------------------------------------------------- */

export const WEEKDAYS_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function getPastWeekDate(dateStr: string, weeksAgo: number): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() - weeksAgo * 7);
  const py = date.getFullYear();
  const pm = String(date.getMonth() + 1).padStart(2, "0");
  const pd = String(date.getDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

export function getDayOfWeekInfo(dateStr: string): { short: string; long: string } {
  if (!dateStr || !dateStr.includes("-")) return { short: "-", long: "-" };
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const dayIdx = date.getDay();
  return {
    short: WEEKDAYS[dayIdx] || "-",
    long: WEEKDAYS_FULL[dayIdx] || "-",
  };
}

export function useSalesIncidents(dateFilter?: string) {
  return useQuery({
    queryKey: ["sales_incidents", dateFilter],
    queryFn: async (): Promise<SalesIncident[]> => {
      try {
        const col = collection(db, INCIDENTS_COLLECTION);
        let q = query(col);
        if (dateFilter) {
          q = query(col, where("date", "==", dateFilter));
        }
        const snap = await getDocs(q);
        const incidents: SalesIncident[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            date: String(d["date"] || ""),
            category: String(d["category"] || "Outros"),
            incident: String(d["incident"] || ""),
            action_taken: String(d["action_taken"] || ""),
            to_meeting: Boolean(d["to_meeting"]),
            status: (d["status"] as IncidentStatus) || "pendente",
            resolution_notes: d["resolution_notes"] || null,
            resolved_at: d["resolved_at"] || null,
            user_id: d["user_id"] || null,
            user_name: String(d["user_name"] || "Operador"),
            created_at: (d["created_at"] as { toDate?: () => Date })?.toDate
              ? (d["created_at"] as { toDate: () => Date }).toDate().toISOString()
              : (d["created_at"] as string) || new Date().toISOString(),
            updated_at: (d["updated_at"] as { toDate?: () => Date })?.toDate
              ? (d["updated_at"] as { toDate: () => Date }).toDate().toISOString()
              : (d["updated_at"] as string) || null,
          };
        });

        return incidents.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return (b.created_at || "").localeCompare(a.created_at || "");
        });
      } catch (err) {
        console.error("Erro ao buscar intercorrências:", err);
        return [];
      }
    },
  });
}

export function useSaveSalesIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      date: string;
      category: string;
      incident: string;
      action_taken: string;
      to_meeting: boolean;
      status: IncidentStatus;
      resolution_notes?: string | null;
      resolved_at?: string | null;
      user_id?: string | null;
      user_name?: string;
    }) => {
      const payload = {
        date: input.date,
        category: input.category,
        incident: input.incident.trim(),
        action_taken: input.action_taken.trim(),
        to_meeting: Boolean(input.to_meeting),
        status: input.status,
        resolution_notes: input.resolution_notes ? input.resolution_notes.trim() : null,
        resolved_at:
          input.status === "resolvido" ? input.resolved_at || getTodayDateString() : null,
        user_id: input.user_id || null,
        user_name: input.user_name || "Operador",
        updated_at: serverTimestamp(),
      };

      if (input.id) {
        const docRef = doc(db, INCIDENTS_COLLECTION, input.id);
        await updateDoc(docRef, payload);
        return input.id;
      } else {
        const docRef = await addDoc(collection(db, INCIDENTS_COLLECTION), {
          ...payload,
          created_at: serverTimestamp(),
        });
        return docRef.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales_incidents"] });
      qc.invalidateQueries({ queryKey: ["sales_comparison"] });
    },
  });
}

export function useDeleteSalesIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, INCIDENTS_COLLECTION, id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales_incidents"] });
      qc.invalidateQueries({ queryKey: ["sales_comparison"] });
    },
  });
}

export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      resolution_notes,
    }: {
      id: string;
      status: IncidentStatus;
      resolution_notes?: string;
    }) => {
      const docRef = doc(db, INCIDENTS_COLLECTION, id);
      const payload: Record<string, unknown> = {
        status,
        updated_at: serverTimestamp(),
      };
      if (resolution_notes !== undefined) {
        payload.resolution_notes = resolution_notes.trim() || null;
      }
      if (status === "resolvido") {
        payload.resolved_at = getTodayDateString();
      } else {
        payload.resolved_at = null;
      }
      await updateDoc(docRef, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales_incidents"] });
      qc.invalidateQueries({ queryKey: ["sales_comparison"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*               ANÁLISE COMPARATIVA DE 4 SEMANAS DO MESMO DIA                */
/* -------------------------------------------------------------------------- */

export function computeDay4WeeksComparison(
  targetDate: string,
  allFetchedSales: DailySaleRecord[],
  incidents: SalesIncident[],
): Day4WeeksComparison {
  const dayInfo = getDayOfWeekInfo(targetDate);
  const [y, m, d] = targetDate.split("-");
  const formattedTargetDate = `${d}/${m}/${y}`;

  // 4 semanas anteriores do mesmo dia da semana
  const pastDates: string[] = [
    getPastWeekDate(targetDate, 1),
    getPastWeekDate(targetDate, 2),
    getPastWeekDate(targetDate, 3),
    getPastWeekDate(targetDate, 4),
  ];

  // Agrupar registros por data
  const dateMap = new Map<string, DailySaleRecord[]>();
  for (const r of allFetchedSales) {
    const list = dateMap.get(r.date) || [];
    list.push(r);
    dateMap.set(r.date, list);
  }

  // Vendas do dia alvo (atual / data consultada)
  const currentDayRecs = dateMap.get(targetDate) || [];
  const currentDayChannels: Record<SalesChannelKey, number> = {
    balcao_salao: 0,
    delivery_ifood: 0,
    delivery_anota_ai: 0,
    delivery_99: 0,
    delivery_sw_fast: 0,
  };
  let currentDayAmount = 0;
  let currentDayOrders = 0;

  for (const r of currentDayRecs) {
    currentDayAmount += r.amount;
    if (r.orders_count) currentDayOrders += r.orders_count;
    if (r.channel in currentDayChannels) {
      currentDayChannels[r.channel] += r.amount;
    }
  }

  // Construir os 4 pontos históricos
  const historicalWeeks: HistoricalWeekPoint[] = pastDates.map((pDate, idx) => {
    const weekNum = idx + 1;
    const [py, pm, pd] = pDate.split("-");
    const formattedDate = `${pd}/${pm}`;
    const pRecs = dateMap.get(pDate) || [];

    const channels: Record<SalesChannelKey, number> = {
      balcao_salao: 0,
      delivery_ifood: 0,
      delivery_anota_ai: 0,
      delivery_99: 0,
      delivery_sw_fast: 0,
    };
    let amount = 0;
    let ordersCount = 0;

    for (const r of pRecs) {
      amount += r.amount;
      if (r.orders_count) ordersCount += r.orders_count;
      if (r.channel in channels) {
        channels[r.channel] += r.amount;
      }
    }

    return {
      weekNumber: weekNum,
      date: pDate,
      formattedDate,
      dayOfWeek: dayInfo.short,
      amount,
      channels,
      ordersCount,
      hasRecords: pRecs.length > 0 || amount > 0,
    };
  });

  const weeksWithData = historicalWeeks.filter((w) => w.hasRecords);
  const weeksWithDataCount = weeksWithData.length;
  const totalHistoricalAmount = weeksWithData.reduce((acc, w) => acc + w.amount, 0);
  const avgHistoricalAmount =
    weeksWithDataCount > 0 ? totalHistoricalAmount / weeksWithDataCount : 0;

  // Variação vs média das semanas anteriores
  const variationAmount = currentDayAmount - avgHistoricalAmount;
  const variationPercent =
    avgHistoricalAmount > 0
      ? ((currentDayAmount - avgHistoricalAmount) / avgHistoricalAmount) * 100
      : 0;

  // Status de decisão:
  // Verde: Acima da média
  // Amarelo: Na média (tolerância de +- 2%)
  // Vermelho: Abaixo da média
  let status: DayComparisonStatus = "sem_historico";
  let statusLabel = "Sem Histórico Prévio";
  let statusBadgeClass = "bg-muted text-muted-foreground border-border";
  let statusCardClass = "border-border/70";

  if (weeksWithDataCount === 0) {
    status = "sem_historico";
    statusLabel = "Sem Histórico Prévio (4 Semanas)";
    statusBadgeClass = "bg-muted text-muted-foreground border-border";
    statusCardClass = "border-border/70";
  } else if (variationPercent > 2) {
    status = "acima";
    statusLabel = "Acima da Média";
    statusBadgeClass =
      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    statusCardClass = "border-emerald-500/40 bg-emerald-50/15 dark:bg-emerald-950/10";
  } else if (variationPercent < -2) {
    status = "abaixo";
    statusLabel = "Abaixo da Média";
    statusBadgeClass =
      "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    statusCardClass = "border-rose-500/40 bg-rose-50/15 dark:bg-rose-950/10";
  } else {
    status = "media";
    statusLabel = "Na Média";
    statusBadgeClass =
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    statusCardClass = "border-amber-500/40 bg-amber-50/15 dark:bg-amber-950/10";
  }

  // Comparação detalhada canal por canal
  const channelComparisons: DayChannelComparison[] = (
    Object.keys(SALES_CHANNELS) as SalesChannelKey[]
  ).map((chKey) => {
    const config = SALES_CHANNELS[chKey];
    const curVal = currentDayChannels[chKey] || 0;
    const chTotalHist = weeksWithData.reduce((acc, w) => acc + (w.channels[chKey] || 0), 0);
    const chAvg = weeksWithDataCount > 0 ? chTotalHist / weeksWithDataCount : 0;
    const chVarAmount = curVal - chAvg;
    const chVarPercent = chAvg > 0 ? ((curVal - chAvg) / chAvg) * 100 : 0;

    let chStatus: DayComparisonStatus = "sem_historico";
    if (weeksWithDataCount === 0) {
      chStatus = "sem_historico";
    } else if (chVarPercent > 2) {
      chStatus = "acima";
    } else if (chVarPercent < -2) {
      chStatus = "abaixo";
    } else {
      chStatus = "media";
    }

    return {
      channel: chKey,
      label: config.label,
      categoryLabel: config.categoryLabel,
      color: config.color,
      currentAmount: curVal,
      avgAmount: chAvg,
      variationAmount: chVarAmount,
      variationPercent: chVarPercent,
      status: chStatus,
    };
  });

  return {
    targetDate,
    formattedTargetDate,
    dayOfWeek: dayInfo.long,
    currentDayAmount,
    currentDayChannels,
    currentDayOrders,
    hasCurrentDaySales: currentDayRecs.length > 0 || currentDayAmount > 0,
    historicalWeeks,
    weeksWithDataCount,
    totalHistoricalAmount,
    avgHistoricalAmount,
    variationAmount,
    variationPercent,
    status,
    statusLabel,
    statusBadgeClass,
    statusCardClass,
    channelComparisons,
    incidents,
  };
}

export function useDay4WeeksAnalysis(targetDate: string) {
  const pastDates = [
    targetDate,
    getPastWeekDate(targetDate, 1),
    getPastWeekDate(targetDate, 2),
    getPastWeekDate(targetDate, 3),
    getPastWeekDate(targetDate, 4),
  ];

  const salesQuery = useQuery({
    queryKey: ["sales_comparison", targetDate],
    queryFn: async (): Promise<DailySaleRecord[]> => {
      try {
        const q = query(collection(db, SALES_COLLECTION), where("date", "in", pastDates));
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: data["date"],
            channel: data["channel"],
            channel_category: data["channel_category"],
            amount: Number(data["amount"]) || 0,
            orders_count: data["orders_count"] ? Number(data["orders_count"]) : null,
            notes: data["notes"] || null,
            user_name: data["user_name"] || null,
          };
        });
      } catch (err) {
        console.error("Erro ao buscar histórico de 4 semanas:", err);
        return [];
      }
    },
    enabled: Boolean(targetDate),
  });

  const incidentsQuery = useSalesIncidents(targetDate);

  const comparison = computeDay4WeeksComparison(
    targetDate,
    salesQuery.data || [],
    incidentsQuery.data || [],
  );

  return {
    data: comparison,
    isLoading: salesQuery.isLoading || incidentsQuery.isLoading,
    refetch: () => {
      salesQuery.refetch();
      incidentsQuery.refetch();
    },
  };
}
