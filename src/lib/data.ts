import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_RULES,
  computeProduct,
  type ProductRow,
  type PurchaseRules,
} from "@/lib/inventory";

export const CURRENT_USER = "Administrador";

/* ---------------------------------- reads --------------------------------- */

export function useRules() {
  return useQuery({
    queryKey: ["settings", "purchase_rules"],
    queryFn: async (): Promise<PurchaseRules> => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "purchase_rules")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_RULES, ...((data?.value as object) ?? {}) } as PurchaseRules;
    },
  });
}

const PRODUCT_SELECT =
  "id, code, description, unit, current_stock, avg_weekly_consumption, min_stock, desired_stock, coverage_weeks, safety_stock, lead_time_days, notes, active, category_id, supplier_id, categories(name), suppliers(name)";

export function useProducts() {
  const { data: rules } = useRules();
  return useQuery({
    queryKey: ["products", rules],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("description");
      if (error) throw error;
      return (data as unknown as ProductRow[]).map((p) =>
        computeProduct(p, rules ?? DEFAULT_RULES),
      );
    },
    enabled: !!rules,
  });
}

export function useProduct(id: string) {
  const { data: rules } = useRules();
  return useQuery({
    queryKey: ["product", id, rules],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return computeProduct(data as unknown as ProductRow, rules ?? DEFAULT_RULES);
    },
    enabled: !!rules && !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useMovements(productId?: string, limit = 200) {
  return useQuery({
    queryKey: ["movements", productId ?? "all", limit],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("*, products(description, unit)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "*, suppliers(name), purchase_order_items(id, quantity, unit, notes, product_id, products(description, unit))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCounts() {
  return useQuery({
    queryKey: ["counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_counts")
        .select(
          "*, stock_count_items(id, expected_quantity, counted_quantity, difference, products(description, unit))",
        )
        .order("counted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/* -------------------------------- movements -------------------------------- */

export type MovementInput = {
  productId: string;
  type: string;
  newQuantity: number;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
};

/** Aplica uma movimentação: atualiza o estoque e registra o histórico (nunca apagado). */
export async function applyMovement(input: MovementInput) {
  const { data: product, error: e1 } = await supabase
    .from("products")
    .select("id, current_stock")
    .eq("id", input.productId)
    .single();
  if (e1) throw e1;

  const before = Number(product.current_stock) || 0;
  const after = Number(input.newQuantity) || 0;

  const { error: e2 } = await supabase
    .from("products")
    .update({ current_stock: after })
    .eq("id", input.productId);
  if (e2) throw e2;

  const { error: e3 } = await supabase.from("stock_movements").insert({
    product_id: input.productId,
    type: input.type,
    quantity_before: before,
    quantity_change: after - before,
    quantity_after: after,
    user_name: CURRENT_USER,
    notes: input.notes ?? null,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
  });
  if (e3) throw e3;
}

/* --------------------------------- delete --------------------------------- */

/** Remove um produto e todos os registros dependentes (cadastro errado). */
export async function deleteProduct(productId: string) {
  const del = async (table: "stock_movements" | "purchase_order_items" | "stock_count_items") => {
    const { error } = await supabase.from(table).delete().eq("product_id", productId);
    if (error) throw error;
  };
  await del("stock_movements");
  await del("purchase_order_items");
  await del("stock_count_items");
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

/** Remove um pedido de compra e seus itens do histórico. */
export async function deleteOrder(orderId: string) {
  const { error: e1 } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("order_id", orderId);
  if (e1) throw e1;
  const { error } = await supabase.from("purchase_orders").delete().eq("id", orderId);
  if (error) throw error;
}

export function useInvalidateAll() {

  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
  };
}

export function useApplyMovement() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: applyMovement,
    onSuccess: invalidate,
  });
}
