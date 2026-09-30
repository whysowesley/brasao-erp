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
  accounts: BalanceAccount[];
  jam: number;
  gbm: number;
  ton: number;
  sicredi: number;
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

function normalizeBalances(data?: Record<string, unknown> | null): BankBalances {
  if (!data) return DEFAULT_BALANCES;

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
        name: String(a["name"] || `Conta ${idx + 1}`).trim().toUpperCase(),
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
    accounts,
    jam: findBalance("jam", jamVal),
    gbm: findBalance("gbm", gbmVal),
    ton: findBalance("ton", tonVal),
    sicredi: findBalance("sicredi", sicrediVal),
    updated_at: (data["updated_at"] as string) || null,
    updated_by: (data["updated_by"] as string) || null,
  };
}

function getLocalBalances(): BankBalances {
  try {
    const raw = localStorage.getItem("financeiro_bank_balances");
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeBalances(parsed);
    }
  } catch {
    // fallback
  }
  return DEFAULT_BALANCES;
}

export function useBankBalances() {
  const queryClient = useQueryClient();

  // Sincronização em tempo real via onSnapshot
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "bank_balances"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const synced = normalizeBalances(data);
          try {
            localStorage.setItem("financeiro_bank_balances", JSON.stringify(synced));
          } catch {
            // ignore
          }
          queryClient.setQueryData(["bank_balances"], synced);
        }
      },
      () => {
        // Fallback silencioso se offline ou regras
      },
    );
    return () => unsub();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["bank_balances"],
    queryFn: async (): Promise<BankBalances> => {
      try {
        const snap = await getDoc(doc(db, "settings", "bank_balances"));
        if (!snap.exists()) {
          return getLocalBalances();
        }
        const data = snap.data();
        const res = normalizeBalances(data);
        try {
          localStorage.setItem("financeiro_bank_balances", JSON.stringify(res));
        } catch {
          // ignore
        }
        return res;
      } catch {
        return getLocalBalances();
      }
    },
    initialData: getLocalBalances,
    staleTime: 1000 * 60 * 5,
  });

  const balances = query.data || getLocalBalances();
  const accounts = balances.accounts || DEFAULT_ACCOUNTS;
  const total = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  return {
    balances,
    accounts,
    total: Math.round(total * 100) / 100,
    isLoading: query.isLoading,
  };
}

export function useUpdateBankBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      accounts?: BalanceAccount[];
      jam?: number;
      gbm?: number;
      ton?: number;
      sicredi?: number;
    }) => {
      const docRef = doc(db, "settings", "bank_balances");

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
        accounts,
        jam: findBalance("jam", parseCurrencyInput(payload.jam)),
        gbm: findBalance("gbm", parseCurrencyInput(payload.gbm)),
        ton: findBalance("ton", parseCurrencyInput(payload.ton)),
        sicredi: findBalance("sicredi", parseCurrencyInput(payload.sicredi)),
        updated_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem("financeiro_bank_balances", JSON.stringify(cleanData));
      } catch {
        // ignore
      }

      try {
        await setDoc(
          docRef,
          {
            ...cleanData,
            updated_at_server: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.warn("Saldos salvos localmente, sincronização remota pendente:", err);
      }
      return cleanData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["bank_balances"], data);
      queryClient.invalidateQueries({ queryKey: ["bank_balances"] });
    },
  });
}
