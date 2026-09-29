import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

export interface BankBalances {
  jam: number;
  gbm: number;
  ton: number;
  sicredi: number;
  updated_at?: string | null;
  updated_by?: string | null;
}

export const DEFAULT_BALANCES: BankBalances = {
  jam: 0,
  gbm: 0,
  ton: 0,
  sicredi: 0,
};

function getLocalBalances(): BankBalances {
  try {
    const raw = localStorage.getItem("financeiro_bank_balances");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        jam: Number(parsed.jam) || 0,
        gbm: Number(parsed.gbm) || 0,
        ton: Number(parsed.ton) || 0,
        sicredi: Number(parsed.sicredi) || 0,
        updated_at: parsed.updated_at || null,
        updated_by: parsed.updated_by || null,
      };
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
          const synced: BankBalances = {
            jam: Number(data["jam"]) || 0,
            gbm: Number(data["gbm"]) || 0,
            ton: Number(data["ton"]) || 0,
            sicredi: Number(data["sicredi"]) || 0,
            updated_at: data["updated_at"] || null,
            updated_by: data["updated_by"] || null,
          };
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
        const res: BankBalances = {
          jam: Number(data["jam"]) || 0,
          gbm: Number(data["gbm"]) || 0,
          ton: Number(data["ton"]) || 0,
          sicredi: Number(data["sicredi"]) || 0,
          updated_at: data["updated_at"] || null,
          updated_by: data["updated_by"] || null,
        };
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
  const total =
    (balances.jam || 0) + (balances.gbm || 0) + (balances.ton || 0) + (balances.sicredi || 0);

  return {
    balances,
    total,
    isLoading: query.isLoading,
  };
}

export function useUpdateBankBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newBalances: Partial<BankBalances>) => {
      const docRef = doc(db, "settings", "bank_balances");
      const cleanData: BankBalances = {
        jam: Number(newBalances.jam) || 0,
        gbm: Number(newBalances.gbm) || 0,
        ton: Number(newBalances.ton) || 0,
        sicredi: Number(newBalances.sicredi) || 0,
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
