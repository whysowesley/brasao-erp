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
} from "@/lib/vendas-types";
import { SALES_CHANNELS } from "@/lib/vendas-types";

export const SALES_COLLECTION = "daily_sales";

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
        date: data.date,
        channel: data.channel,
        channel_category: data.channel_category,
        amount: Number(data.amount) || 0,
        orders_count: data.orders_count ? Number(data.orders_count) : null,
        notes: data.notes || null,
        user_name: data.user_name || null,
        created_at: (data.created_at as { toDate?: () => Date })?.toDate
          ? (data.created_at as { toDate: () => Date }).toDate().toISOString()
          : (data.created_at as string) || new Date().toISOString(),
        updated_at: (data.updated_at as { toDate?: () => Date })?.toDate
          ? (data.updated_at as { toDate: () => Date }).toDate().toISOString()
          : (data.updated_at as string) || null,
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
  const monthNum = parseInt(monthStr, 10) - 1;
  const date = new Date(parseInt(yearStr, 10), monthNum, 1);
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
        const chKey = d.channel as SalesChannelKey;
        const config = SALES_CHANNELS[chKey];
        return {
          id: docSnap.id,
          date: String(d.date || ""),
          channel: chKey,
          channel_category: config ? config.category : d.channel_category || "delivery",
          amount: Number(d.amount) || 0,
          orders_count: d.orders_count != null ? Number(d.orders_count) : null,
          notes: d.notes || null,
          created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : d.created_at,
          user_name: d.user_name || "Operador",
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
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

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
    const dayOfWeek = WEEKDAYS[dayDate.getDay()];

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
    bestDay = { date: sorted[0].date, amount: sorted[0].totalDay };
    lowestDay = {
      date: sorted[sorted.length - 1].date,
      amount: sorted[sorted.length - 1].totalDay,
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
            date: data.date,
            channel: data.channel,
            channel_category: data.channel_category,
            amount: Number(data.amount) || 0,
            orders_count: data.orders_count ? Number(data.orders_count) : null,
            notes: data.notes || null,
            user_name: data.user_name || null,
            created_at: (data.created_at as { toDate?: () => Date })?.toDate
              ? (data.created_at as { toDate: () => Date }).toDate().toISOString()
              : (data.created_at as string) || new Date().toISOString(),
            updated_at: (data.updated_at as { toDate?: () => Date })?.toDate
              ? (data.updated_at as { toDate: () => Date }).toDate().toISOString()
              : (data.updated_at as string) || null,
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
