import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
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
  is_replicated?: boolean;
  replicated_from_date?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
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
 * Consulta os saldos bancários de um dia específico ou do dia atual.
 * Se o dia ainda não tiver um saldo cadastrado, replica automaticamente do dia anterior mais próximo
 * mantendo o dia anterior como histórico intocado.
 */
export function useBankBalances(targetDate?: string) {
  const queryClient = useQueryClient();
  const dateKey = targetDate || new Date().toISOString().split("T")[0] || "2026-10-01";

  // Sincronização em tempo real via onSnapshot no documento do dia
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
      () => {
        // Fallback silencioso se offline ou regras
      },
    );
    return () => unsub();
  }, [queryClient, dateKey]);

  const query = useQuery({
    queryKey: ["bank_balances", dateKey],
    queryFn: async (): Promise<BankBalances> => {
      try {
        // 1. Tenta buscar o saldo específico deste dia
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

        // 2. Se este dia ainda não tem saldo próprio, busca o dia anterior mais recente para replicar
        try {
          const { collection, getDocs } = await import("firebase/firestore");
          const allDailySnap = await getDocs(collection(db, "daily_bank_balances"));

          // Procura o dia mais recente que seja estritamente anterior a dateKey
          const priorDocs = allDailySnap.docs
            .filter((d) => d.id < dateKey)
            .sort((a, b) => b.id.localeCompare(a.id));

          const priorDoc = priorDocs[0];
          if (priorDoc && priorDoc.exists()) {
            const priorData = priorDoc.data();
            const replicated = normalizeBalances(priorData, dateKey);
            return {
              ...replicated,
              date: dateKey,
              is_replicated: true,
              replicated_from_date: priorDoc.id,
            };
          }
        } catch {
          // ignore fallback
        }

        // 3. Fallback para settings/bank_balances geral
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
  const total = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  return {
    date: dateKey,
    balances,
    accounts,
    total: Math.round(total * 100) / 100,
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
        // Salva no histórico do dia específico
        await setDoc(
          dailyDocRef,
          {
            ...cleanData,
            updated_at_server: serverTimestamp(),
          },
          { merge: true },
        );

        // Atualiza settings/bank_balances apenas se o dia salvo for hoje ou futuro
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
    },
  });
}
