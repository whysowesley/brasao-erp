import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

const ALL_COLLECTIONS = [
  "products",
  "stock_movements",
  "stock_counts",
  "purchase_orders",
  "financial_transactions",
  "financial_categories",
  "cost_centers",
  "payment_methods",
  "suppliers",
  "categories",
  "units",
  "settings",
  "daily_sales",
  "holerites",
  "employees",
  "presence_logs",
] as const;

const COUNTER_COLLECTIONS = [
  "products",
  "stock_movements",
  "stock_counts",
  "categories",
  "units",
  "settings",
] as const;

/**
 * Mantém todas as telas sincronizadas em tempo real com Firestore:
 * Qualquer alteração no estoque, contagem, movimentação, pedidos ou financeiro
 * feita em qualquer sessão/dispositivo invalida as queries ativas e atualiza a UI.
 */
export function useRealtimeSync(enabled = true, isCounter = false) {
  const qc = useQueryClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unsubs: Unsubscribe[] = [];
    const activeCollections = isCounter ? COUNTER_COLLECTIONS : ALL_COLLECTIONS;

    const notifyChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        qc.invalidateQueries();
      }, 150);
    };

    for (const collName of activeCollections) {
      try {
        const collRef = collection(db, collName);
        let isInitial = true;
        const unsub = onSnapshot(
          collRef,
          { includeMetadataChanges: false },
          () => {
            // Ignora a emissão inicial imediata para não duplicar requisições no mount
            if (isInitial) {
              isInitial = false;
              return;
            }
            notifyChange();
          },
          (error) => {
            console.warn(`[RealtimeSync] Listener de ${collName}:`, error.message);
          },
        );
        unsubs.push(unsub);
      } catch (err) {
        console.warn(`[RealtimeSync] Falha ao registrar ${collName}:`, err);
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignora
        }
      });
    };
  }, [enabled, isCounter, qc]);
}
