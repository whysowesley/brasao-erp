import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  getDocs,
} from "firebase/firestore";
import { format, parseISO, subDays } from "date-fns";
import { db } from "@/integrations/firebase/config";
import { parseCurrencyInput } from "@/lib/currency-utils";

export interface BalanceAccount {
  id: string;
  name: string;
  balance: number;
}

export interface BankBalances {
  date?: string;
  accounts: BalanceAccount[];
  jam: number;
  gbm: number;
  ton: number;
  sicredi: number;
  carried_balance?: number; // Saldo anterior transportado (flag editável)
  manual_carried_balance?: number | null; // Se editado manualmente pelo usuário
  is_manually_saved?: boolean;
  is_replicated?: boolean;
  replicated_from_date?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface RollingDayBalance {
  date: string;
  carriedBalance: number; // Flag 'SALDO' (restante transportado do dia anterior ou manual)
  isCarriedFromPrior: boolean;
  priorDate: string | null;
  priorTotal: number;
  priorBills: number;
  priorRemaining: number;
  isManualCarried: boolean;
  accounts: BalanceAccount[]; // Contas (JAM, GBM, TON, SICREDI...) - zeradas para outros dias
  accountsTotal: number; // Soma das contas abastecidas
  total: number; // carriedBalance + accountsTotal
  dayBills: number; // Contas a pagar lançadas neste dia
  diffAfterDay: number; // total - dayBills
  isCovered: boolean; // total >= dayBills
  remainingAfterDay: number; // max(0, total - dayBills)
  isManuallySaved: boolean;
}

export const DEFAULT_ACCOUNTS: BalanceAccount[] = [
  { id: "jam", name: "JAM", balance: 0 },
  { id: "gbm", name: "GBM", balance: 0 },
  { id: "ton", name: "TON", balance: 0 },
  { id: "sicredi", name: "SICREDI", balance: 0 },
];

export const DEFAULT_BALANCES: BankBalances = {
  accounts: DEFAULT_ACCOUNTS,
  jam: 0,
  gbm: 0,
  ton: 0,
  sicredi: 0,
  carried_balance: 0,
  manual_carried_balance: null,
  is_manually_saved: false,
};

function normalizeBalances(
  data?: Record<string, unknown> | null,
  targetDate?: string,
): BankBalances {
  if (!data) return { ...DEFAULT_BALANCES, date: targetDate };

  const jamVal = parseCurrencyInput(data["jam"] as string | number);
  const gbmVal = parseCurrencyInput(data["gbm"] as string | number);
  const tonVal = parseCurrencyInput(data["ton"] as string | number);
  const sicrediVal = parseCurrencyInput(data["sicredi"] as string | number);
  const carriedVal =
    data["carried_balance"] !== undefined
      ? parseCurrencyInput(data["carried_balance"] as string | number)
      : undefined;
  const manualCarriedVal =
    data["manual_carried_balance"] !== undefined && data["manual_carried_balance"] !== null
      ? parseCurrencyInput(data["manual_carried_balance"] as string | number)
      : null;

  let accounts: BalanceAccount[] = [];

  if (Array.isArray(data["accounts"]) && data["accounts"].length > 0) {
    accounts = (data["accounts"] as Array<Record<string, unknown>>)
      .filter((a) => a && typeof a === "object")
      .map((a, idx) => ({
        id: String(a["id"] || `acc_${idx}_${Date.now()}`),
        name: String(a["name"] || `Conta ${idx + 1}`)
          .trim()
          .toUpperCase(),
        balance: parseCurrencyInput(a["balance"] as string | number),
      }));
  } else {
    accounts = [
      { id: "jam", name: "JAM", balance: jamVal },
      { id: "gbm", name: "GBM", balance: gbmVal },
      { id: "ton", name: "TON", balance: tonVal },
      { id: "sicredi", name: "SICREDI", balance: sicrediVal },
    ];
  }

  // Sincroniza campos legados
  const findBalance = (name: string, fallback: number) => {
    const acc = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
    return acc ? acc.balance : fallback;
  };

  return {
    date: (data["date"] as string) || targetDate,
    accounts,
    jam: findBalance("jam", jamVal),
    gbm: findBalance("gbm", gbmVal),
    ton: findBalance("ton", tonVal),
    sicredi: findBalance("sicredi", sicrediVal),
    carried_balance: carriedVal,
    manual_carried_balance: manualCarriedVal,
    is_manually_saved: Boolean(data["is_manually_saved"]),
    is_replicated: Boolean(data["is_replicated"]),
    replicated_from_date: (data["replicated_from_date"] as string) || null,
    updated_at: (data["updated_at"] as string) || null,
    updated_by: (data["updated_by"] as string) || null,
  };
}

function getLocalBalances(dateKey?: string): BankBalances {
  try {
    if (dateKey) {
      const dailyRaw = localStorage.getItem(`financeiro_bank_balances_${dateKey}`);
      if (dailyRaw) {
        return normalizeBalances(JSON.parse(dailyRaw), dateKey);
      }
    }
    const raw = localStorage.getItem("financeiro_bank_balances");
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeBalances(parsed, dateKey);
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_BALANCES, date: dateKey };
}

/**
 * Consulta todos os documentos de daily_bank_balances em tempo real.
 */
export function useAllDailyBankBalances() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "daily_bank_balances"),
      (snap) => {
        const map: Record<string, BankBalances> = {};
        snap.forEach((docSnap) => {
          map[docSnap.id] = normalizeBalances(docSnap.data(), docSnap.id);
        });
        queryClient.setQueryData(["all_daily_bank_balances"], map);
      },
      (err) => {
        console.warn("Realtime listener em daily_bank_balances falhou:", err);
      },
    );
    return () => unsub();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["all_daily_bank_balances"],
    queryFn: async (): Promise<Record<string, BankBalances>> => {
      try {
        const snap = await getDocs(collection(db, "daily_bank_balances"));
        const map: Record<string, BankBalances> = {};
        snap.forEach((docSnap) => {
          map[docSnap.id] = normalizeBalances(docSnap.data(), docSnap.id);
        });
        return map;
      } catch (err) {
        console.warn("Falha ao buscar daily_bank_balances:", err);
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    balancesMap: query.data || {},
    isLoading: query.isLoading,
  };
}

/**
 * Calcula os saldos rolantes de dia a dia conforme solicitado pelo usuário:
 * - Se somando cada conta der um saldo total maior que as contas do dia, sobra = total - contas.
 * - Para o próximo dia, todas as contas bancárias (JAM, GBM, TON, etc.) ZERAM para que o usuário abasteça manualmente.
 * - Uma flag (editável) chamada SALDO recebe o restante do que sobrou do dia anterior.
 * - Se o usuário lançar/editar uma conta esquecida no dia anterior, o saldo do dia seguinte é corrigido imediatamente!
 */
export function calculateRollingBalances(
  dates: string[],
  dayBillsMap: Record<string, number>,
  savedBalancesMap: Record<string, BankBalances>,
): Record<string, RollingDayBalance> {
  const result: Record<string, RollingDayBalance> = {};

  // Descobre template de contas padrão a partir de qualquer dia configurado
  let lastKnownTemplateAccounts = DEFAULT_ACCOUNTS;
  for (const date of dates) {
    const docAccs = savedBalancesMap[date]?.accounts;
    if (docAccs && docAccs.length > 0) {
      lastKnownTemplateAccounts = docAccs.map((a) => ({
        id: a.id,
        name: a.name,
        balance: 0,
      }));
      break;
    }
  }

  // Percorre as datas em ordem cronológica
  for (let i = 0; i < dates.length; i++) {
    const curDate = dates[i];
    const prevDate = i > 0 ? dates[i - 1] : format(subDays(parseISO(curDate), 1), "yyyy-MM-dd");
    const prevDayRolling = i > 0 ? result[prevDate] : null;

    let priorTotal = 0;
    let priorBills = 0;
    let priorRemaining = 0;
    let isCarriedFromPrior = false;
    let actualPriorDate: string | null = null;

    if (prevDayRolling) {
      priorTotal = prevDayRolling.total;
      priorBills = prevDayRolling.dayBills;
      priorRemaining = prevDayRolling.remainingAfterDay;
      isCarriedFromPrior = true;
      actualPriorDate = prevDate;
    } else if (savedBalancesMap[prevDate]) {
      const prevDoc = savedBalancesMap[prevDate];
      const prevAccountsTotal = prevDoc.accounts.reduce((s, a) => s + (a.balance || 0), 0);
      priorTotal = (prevDoc.carried_balance || 0) + prevAccountsTotal;
      priorBills = dayBillsMap[prevDate] || 0;
      priorRemaining = Math.max(0, priorTotal - priorBills);
      isCarriedFromPrior = true;
      actualPriorDate = prevDate;
    }

    const curDoc = savedBalancesMap[curDate];
    const isManuallySaved = Boolean(curDoc?.is_manually_saved);
    const isManualCarried = curDoc?.manual_carried_balance != null;

    // Flag SALDO:
    // Se o usuário editou manualmente neste dia, usa o manual;
    // senão, se veio de dia anterior, usa a sobra do dia anterior calculada dinamicamente!
    let carriedBalance = 0;
    if (isManualCarried) {
      carriedBalance = curDoc!.manual_carried_balance!;
    } else if (isCarriedFromPrior) {
      carriedBalance = priorRemaining;
    } else if (curDoc?.carried_balance != null) {
      carriedBalance = curDoc.carried_balance;
    }

    // Contas bancárias (JAM, GBM, TON, SICREDI, etc.):
    // Se o dia foi salvo manualmente, mantém os saldos que o usuário abasteceu;
    // Se o dia NÃO foi salvo manualmente, as contas ficam ZERADAS para que ele abasteça manualmente!
    let accounts: BalanceAccount[] = [];
    if (isManuallySaved && curDoc?.accounts && curDoc.accounts.length > 0) {
      accounts = curDoc.accounts;
      lastKnownTemplateAccounts = curDoc.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: 0,
      }));
    } else {
      accounts = lastKnownTemplateAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: 0,
      }));
    }

    const accountsTotal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const total = Math.round((carriedBalance + accountsTotal) * 100) / 100;
    const dayBills = Math.round((dayBillsMap[curDate] || 0) * 100) / 100;
    const diffAfterDay = Math.round((total - dayBills) * 100) / 100;
    const isCovered = total >= dayBills;
    const remainingAfterDay = Math.max(0, diffAfterDay);

    result[curDate] = {
      date: curDate,
      carriedBalance,
      isCarriedFromPrior,
      priorDate: actualPriorDate,
      priorTotal,
      priorBills,
      priorRemaining,
      isManualCarried,
      accounts,
      accountsTotal,
      total,
      dayBills,
      diffAfterDay,
      isCovered,
      remainingAfterDay,
      isManuallySaved,
    };
  }

  return result;
}

/**
 * Consulta os saldos bancários de um dia específico ou do dia atual (compatibilidade legada).
 */
export function useBankBalances(targetDate?: string) {
  const queryClient = useQueryClient();
  const dateKey = targetDate || new Date().toISOString().split("T")[0] || "2026-10-01";

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "daily_bank_balances", dateKey),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const synced = normalizeBalances(data, dateKey);
          try {
            localStorage.setItem(`financeiro_bank_balances_${dateKey}`, JSON.stringify(synced));
          } catch {
            // ignore
          }
          queryClient.setQueryData(["bank_balances", dateKey], synced);
        }
      },
      () => {},
    );
    return () => unsub();
  }, [queryClient, dateKey]);

  const query = useQuery({
    queryKey: ["bank_balances", dateKey],
    queryFn: async (): Promise<BankBalances> => {
      try {
        const daySnap = await getDoc(doc(db, "daily_bank_balances", dateKey));
        if (daySnap.exists()) {
          const res = normalizeBalances(daySnap.data(), dateKey);
          try {
            localStorage.setItem(`financeiro_bank_balances_${dateKey}`, JSON.stringify(res));
          } catch {
            // ignore
          }
          return res;
        }

        const generalSnap = await getDoc(doc(db, "settings", "bank_balances"));
        if (generalSnap.exists()) {
          const res = normalizeBalances(generalSnap.data(), dateKey);
          return {
            ...res,
            date: dateKey,
            is_replicated: true,
          };
        }

        return getLocalBalances(dateKey);
      } catch {
        return getLocalBalances(dateKey);
      }
    },
    initialData: () => getLocalBalances(dateKey),
    staleTime: 1000 * 60 * 2,
  });

  const balances = query.data || getLocalBalances(dateKey);
  const accounts = balances.accounts || DEFAULT_ACCOUNTS;
  const accountsTotal = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);
  const total = Math.round(((balances.carried_balance || 0) + accountsTotal) * 100) / 100;

  return {
    date: dateKey,
    balances,
    accounts,
    carriedBalance: balances.carried_balance || 0,
    total,
    isReplicated: Boolean(balances.is_replicated),
    replicatedFromDate: balances.replicated_from_date || null,
    isLoading: query.isLoading,
  };
}

export function useUpdateBankBalances(targetDate?: string) {
  const queryClient = useQueryClient();
  const dateKey = targetDate || new Date().toISOString().split("T")[0] || "2026-10-01";

  return useMutation({
    mutationFn: async (payload: {
      accounts?: BalanceAccount[];
      jam?: number;
      gbm?: number;
      ton?: number;
      sicredi?: number;
      carried_balance?: number;
      manual_carried_balance?: number | null;
      is_manually_saved?: boolean;
      date?: string;
    }) => {
      const saveDate = payload.date || dateKey;
      const dailyDocRef = doc(db, "daily_bank_balances", saveDate);
      const generalDocRef = doc(db, "settings", "bank_balances");

      let accounts: BalanceAccount[] = [];
      if (Array.isArray(payload.accounts)) {
        accounts = payload.accounts.map((a, idx) => ({
          id: a.id || `acc_${idx}_${Date.now()}`,
          name: (a.name || `Conta ${idx + 1}`).trim().toUpperCase(),
          balance: parseCurrencyInput(a.balance),
        }));
      } else {
        accounts = [
          { id: "jam", name: "JAM", balance: parseCurrencyInput(payload.jam) },
          { id: "gbm", name: "GBM", balance: parseCurrencyInput(payload.gbm) },
          { id: "ton", name: "TON", balance: parseCurrencyInput(payload.ton) },
          { id: "sicredi", name: "SICREDI", balance: parseCurrencyInput(payload.sicredi) },
        ];
      }

      const findBalance = (name: string, fallback: number) => {
        const acc = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
        return acc ? acc.balance : fallback;
      };

      const cleanData: BankBalances = {
        date: saveDate,
        accounts,
        jam: findBalance("jam", parseCurrencyInput(payload.jam)),
        gbm: findBalance("gbm", parseCurrencyInput(payload.gbm)),
        ton: findBalance("ton", parseCurrencyInput(payload.ton)),
        sicredi: findBalance("sicredi", parseCurrencyInput(payload.sicredi)),
        carried_balance:
          payload.carried_balance !== undefined ? parseCurrencyInput(payload.carried_balance) : 0,
        manual_carried_balance:
          payload.manual_carried_balance !== undefined
            ? payload.manual_carried_balance !== null
              ? parseCurrencyInput(payload.manual_carried_balance)
              : null
            : undefined,
        is_manually_saved:
          payload.is_manually_saved !== undefined ? payload.is_manually_saved : true,
        is_replicated: false,
        replicated_from_date: null,
        updated_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`financeiro_bank_balances_${saveDate}`, JSON.stringify(cleanData));
        localStorage.setItem("financeiro_bank_balances", JSON.stringify(cleanData));
      } catch {
        // ignore
      }

      try {
        await setDoc(
          dailyDocRef,
          {
            ...cleanData,
            updated_at_server: serverTimestamp(),
          },
          { merge: true },
        );

        const todayStr = new Date().toISOString().split("T")[0];
        if (saveDate >= todayStr) {
          await setDoc(
            generalDocRef,
            {
              ...cleanData,
              updated_at_server: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } catch (err) {
        console.warn("Saldos diários salvos localmente, sincronização remota pendente:", err);
      }
      return cleanData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["bank_balances", data.date || dateKey], data);
      queryClient.setQueryData(["bank_balances"], data);
      queryClient.invalidateQueries({ queryKey: ["bank_balances"] });
      queryClient.invalidateQueries({ queryKey: ["all_daily_bank_balances"] });
    },
  });
}
