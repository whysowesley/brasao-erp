import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "products",
  "stock_movements",
  "stock_counts",
  "stock_count_items",
  "purchase_orders",
  "purchase_order_items",
] as const;

/**
 * Mantém todas as telas sincronizadas: qualquer alteração no estoque, contagem,
 * movimentação ou pedido feita em qualquer lugar recarrega os dados na hora.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("app-sync");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        qc.invalidateQueries();
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
