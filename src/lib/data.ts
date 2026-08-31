import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import {
  DEFAULT_RULES,
  computeProduct,
  type ConsumptionMode,
  type DailyConsumption,
  type ProductRow,
  type PurchaseRules,
} from "@/lib/inventory";

export const CURRENT_USER = "Administrador";

export type StockMovementRow = {
  id: string;
  product_id: string;
  product_description: string;
  product_unit: string;
  type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  user_name: string;
  notes: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  products: { description: string; unit: string } | null;
};

export type PurchaseOrderItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  products: { description: string; unit: string } | null;
};

export type PurchaseOrderRow = {
  id: string;
  number?: number | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  user_name: string;
  notes: string | null;
  created_at: string;
  ordered_at?: string | null;
  received_at?: string | null;
  suppliers: { name: string } | null;
  purchase_order_items: PurchaseOrderItemRow[];
};

export type StockCountItemRow = {
  id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number;
  difference: number;
  products: { description: string; unit: string } | null;
};

export type StockCountRow = {
  id: string;
  user_name: string;
  notes: string | null;
  counted_at: string;
  stock_count_items: StockCountItemRow[];
};

/* ---------------------------------- reads --------------------------------- */

export function useRules() {
  return useQuery({
    queryKey: ["settings", "purchase_rules"],
    queryFn: async (): Promise<PurchaseRules> => {
      try {
        const rulesDocRef = doc(db, "settings", "purchase_rules");
        const snap = await getDoc(rulesDocRef);
        if (snap.exists()) {
          const data = snap.data();
          return { ...DEFAULT_RULES, ...(data?.["value"] || data) } as PurchaseRules;
        }
        return DEFAULT_RULES;
      } catch (err) {
        console.error("Erro ao carregar purchase_rules:", err);
        return DEFAULT_RULES;
      }
    },
  });
}

export function useProducts() {
  const { data: rules } = useRules();
  return useQuery({
    queryKey: ["products", rules],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "products"));
      const rawProducts: ProductRow[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          code: d["code"] ?? null,
          description: d["description"] || "",
          unit: d["unit"] || "UN",
          current_stock: Number(d["current_stock"]) || 0,
          avg_weekly_consumption: Number(d["avg_weekly_consumption"]) || 0,
          daily_consumption_mode: d["daily_consumption_mode"] ?? "constant",
          ...(d["daily_consumption"] !== undefined && d["daily_consumption"] !== null
            ? { daily_consumption: d["daily_consumption"] as DailyConsumption }
            : {}),
          ...(d["constant_daily_consumption"] !== undefined &&
          d["constant_daily_consumption"] !== null
            ? { constant_daily_consumption: Number(d["constant_daily_consumption"]) }
            : {}),
          min_stock: Number(d["min_stock"]) || 0,
          desired_stock: Number(d["desired_stock"]) || 0,
          coverage_weeks:
            d["coverage_weeks"] !== undefined && d["coverage_weeks"] !== null
              ? Number(d["coverage_weeks"])
              : null,
          safety_stock: Number(d["safety_stock"]) || 0,
          lead_time_days: Number(d["lead_time_days"]) || 0,
          notes: d["notes"] || null,
          active: d["active"] !== false,
          category_id: d["category_id"] || null,
          supplier_id: d["supplier_id"] || null,
          categories: d["category_name"]
            ? { name: d["category_name"] }
            : d["categories"]
              ? d["categories"]
              : null,
          suppliers: d["supplier_name"]
            ? { name: d["supplier_name"] }
            : d["suppliers"]
              ? d["suppliers"]
              : null,
        };
      });

      // Ordena por descrição
      rawProducts.sort((a, b) => a.description.localeCompare(b.description));

      return rawProducts.map((p) => computeProduct(p, rules ?? DEFAULT_RULES));
    },
    enabled: !!rules,
  });
}

export function useProduct(id: string) {
  const { data: rules } = useRules();
  return useQuery({
    queryKey: ["product", id, rules],
    queryFn: async () => {
      const docRef = doc(db, "products", id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error("Produto não encontrado.");
      const d = snap.data();
      const p: ProductRow = {
        id: snap.id,
        code: d["code"] ?? null,
        description: d["description"] || "",
        unit: d["unit"] || "UN",
        current_stock: Number(d["current_stock"]) || 0,
        avg_weekly_consumption: Number(d["avg_weekly_consumption"]) || 0,
        daily_consumption_mode: d["daily_consumption_mode"] ?? "constant",
        ...(d["daily_consumption"] !== undefined && d["daily_consumption"] !== null
          ? { daily_consumption: d["daily_consumption"] as DailyConsumption }
          : {}),
        ...(d["constant_daily_consumption"] !== undefined &&
        d["constant_daily_consumption"] !== null
          ? { constant_daily_consumption: Number(d["constant_daily_consumption"]) }
          : {}),
        min_stock: Number(d["min_stock"]) || 0,
        desired_stock: Number(d["desired_stock"]) || 0,
        coverage_weeks:
          d["coverage_weeks"] !== undefined && d["coverage_weeks"] !== null
            ? Number(d["coverage_weeks"])
            : null,
        safety_stock: Number(d["safety_stock"]) || 0,
        lead_time_days: Number(d["lead_time_days"]) || 0,
        notes: d["notes"] || null,
        active: d["active"] !== false,
        category_id: d["category_id"] || null,
        supplier_id: d["supplier_id"] || null,
        categories: d["category_name"]
          ? { name: d["category_name"] }
          : d["categories"]
            ? d["categories"]
            : null,
        suppliers: d["supplier_name"]
          ? { name: d["supplier_name"] }
          : d["suppliers"]
            ? d["suppliers"]
            : null,
      };
      return computeProduct(p, rules ?? DEFAULT_RULES);
    },
    enabled: !!rules && !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "categories"));
      const items = snap.docs.map((d) => ({
        id: d.id,
        name: d.data()["name"] || "",
      })) as Array<{ id: string; name: string }>;
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return items;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "suppliers"));
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data["name"] || "",
          contact_name: data["contact_name"] ?? data["contact"] ?? null,
          contact: data["contact"] ?? null,
          phone: data["phone"] ?? null,
          email: data["email"] ?? null,
          cnpj_cpf: data["cnpj_cpf"] ?? null,
          pix_key: data["pix_key"] ?? null,
          bank_name: data["bank_name"] ?? null,
          bank_agency: data["bank_agency"] ?? null,
          bank_account: data["bank_account"] ?? null,
          bank_account_type: data["bank_account_type"] ?? null,
          notes: data["notes"] ?? null,
        };
      });
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return items;
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "units"));
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          code: data["code"] || d.id,
          name: data["name"] || d.id,
        };
      });
      items.sort((a, b) => a.code.localeCompare(b.code));
      return items;
    },
  });
}

export function useMovements(productId?: string, limitCount = 200) {
  return useQuery({
    queryKey: ["movements", productId ?? "all", limitCount],
    queryFn: async (): Promise<StockMovementRow[]> => {
      const movementsRef = collection(db, "stock_movements");
      let q = query(movementsRef, orderBy("created_at", "desc"), firestoreLimit(limitCount));
      if (productId) {
        q = query(
          movementsRef,
          where("product_id", "==", productId),
          orderBy("created_at", "desc"),
          firestoreLimit(limitCount),
        );
      }

      try {
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          const createdDate = data["created_at"]?.toDate
            ? data["created_at"].toDate().toISOString()
            : data["created_at"] || new Date().toISOString();
          return {
            id: d.id,
            product_id: data["product_id"] || "",
            product_description: data["product_description"] || "",
            product_unit: data["product_unit"] || "UN",
            type: data["type"] || "ajuste",
            quantity_before: Number(data["quantity_before"]) || 0,
            quantity_change: Number(data["quantity_change"]) || 0,
            quantity_after: Number(data["quantity_after"]) || 0,
            user_name: data["user_name"] || "Administrador",
            notes: data["notes"] ?? null,
            reference_type: data["reference_type"] ?? null,
            reference_id: data["reference_id"] ?? null,
            created_at: createdDate,
            products: data["product_description"]
              ? { description: data["product_description"], unit: data["product_unit"] || "UN" }
              : data["products"] || null,
          };
        });
      } catch {
        const snap = await getDocs(movementsRef);
        let items: StockMovementRow[] = snap.docs.map((d) => {
          const data = d.data();
          const createdDate = data["created_at"]?.toDate
            ? data["created_at"].toDate().toISOString()
            : data["created_at"] || new Date().toISOString();
          return {
            id: d.id,
            product_id: data["product_id"] || "",
            product_description: data["product_description"] || "",
            product_unit: data["product_unit"] || "UN",
            type: data["type"] || "ajuste",
            quantity_before: Number(data["quantity_before"]) || 0,
            quantity_change: Number(data["quantity_change"]) || 0,
            quantity_after: Number(data["quantity_after"]) || 0,
            user_name: data["user_name"] || "Administrador",
            notes: data["notes"] ?? null,
            reference_type: data["reference_type"] ?? null,
            reference_id: data["reference_id"] ?? null,
            created_at: createdDate,
            products: data["product_description"]
              ? { description: data["product_description"], unit: data["product_unit"] || "UN" }
              : data["products"] || null,
          };
        });
        if (productId) {
          items = items.filter((x) => x.product_id === productId);
        }
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return items.slice(0, limitCount);
      }
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async (): Promise<PurchaseOrderRow[]> => {
      const [snap, productsSnap] = await Promise.all([
        getDocs(collection(db, "purchase_orders")),
        getDocs(collection(db, "products")),
      ]);

      const productMap = new Map<string, { description: string; unit: string }>();
      productsSnap.docs.forEach((pDoc) => {
        const pData = pDoc.data();
        productMap.set(pDoc.id, {
          description: pData["description"] || "",
          unit: pData["unit"] || "UN",
        });
      });

      // Ordenar cronologicamente em ordem crescente para calcular fallback de número caso algum pedido antigo não tenha `number` gravado
      const sortedAsc = [...snap.docs].sort((a, b) => {
        const da = a.data()["created_at"]?.toDate ? a.data()["created_at"].toDate().getTime() : 0;
        const dbTime = b.data()["created_at"]?.toDate
          ? b.data()["created_at"].toDate().getTime()
          : 0;
        return da - dbTime;
      });

      // Mapear números já atribuídos e preencher os ausentes
      const assignedNumbers = new Map<string, number>();
      let maxKnown = 0;
      sortedAsc.forEach((d) => {
        const num = Number(d.data()["number"]);
        if (Number.isFinite(num) && num > 0) {
          assignedNumbers.set(d.id, num);
          if (num > maxKnown) maxKnown = num;
        }
      });
      sortedAsc.forEach((d) => {
        if (!assignedNumbers.has(d.id)) {
          maxKnown++;
          assignedNumbers.set(d.id, maxKnown);
        }
      });

      const items: PurchaseOrderRow[] = snap.docs.map((d) => {
        const data = d.data();
        const createdDate = data["created_at"]?.toDate
          ? data["created_at"].toDate().toISOString()
          : data["created_at"] || new Date().toISOString();
        const rawItems = data["items"] || data["purchase_order_items"] || [];
        const orderNum = assignedNumbers.get(d.id) ?? (data["number"] ? Number(data["number"]) : 1);
        return {
          id: d.id,
          number: orderNum,
          supplier_id: data["supplier_id"] || null,
          supplier_name: data["supplier_name"] || null,
          status: data["status"] || "rascunho",
          user_name: data["user_name"] || "Administrador",
          notes: data["notes"] || null,
          created_at: createdDate,
          ordered_at: data["ordered_at"] || null,
          received_at: data["received_at"] || null,
          suppliers: data["supplier_name"]
            ? { name: data["supplier_name"] }
            : data["suppliers"] || null,
          purchase_order_items: rawItems.map((it: Record<string, unknown>, idx: number) => {
            const pId = (it["product_id"] as string) || "";
            const matched = productMap.get(pId);
            const desc =
              (it["product_description"] as string) ||
              (it["description"] as string) ||
              (it["product_name"] as string) ||
              (it["name"] as string) ||
              (it["products"] as { description?: string })?.description ||
              matched?.description ||
              "Produto";
            const unit =
              (it["unit"] as string) ||
              (it["products"] as { unit?: string })?.unit ||
              matched?.unit ||
              "UN";

            return {
              id: (it["id"] as string) || `${d.id}_${idx}`,
              product_id: pId,
              quantity: Number(it["quantity"]) || 0,
              unit: unit,
              notes: (it["notes"] as string) || null,
              products: {
                description: desc,
                unit: unit,
              },
            };
          }),
        };
      });
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items;
    },
  });
}

export function useCounts() {
  return useQuery({
    queryKey: ["counts"],
    queryFn: async (): Promise<StockCountRow[]> => {
      const [snap, productsSnap] = await Promise.all([
        getDocs(collection(db, "stock_counts")),
        getDocs(collection(db, "products")),
      ]);

      const productMap = new Map<string, { description: string; unit: string }>();
      productsSnap.docs.forEach((pDoc) => {
        const pData = pDoc.data();
        productMap.set(pDoc.id, {
          description: pData["description"] || "",
          unit: pData["unit"] || "UN",
        });
      });

      const items: StockCountRow[] = snap.docs.map((d) => {
        const data = d.data();
        const countedDate = data["counted_at"]?.toDate
          ? data["counted_at"].toDate().toISOString()
          : data["counted_at"] || data["created_at"] || new Date().toISOString();
        const rawItems = data["items"] || data["stock_count_items"] || [];
        return {
          id: d.id,
          user_name: data["user_name"] || "Administrador",
          notes: data["notes"] || null,
          counted_at: countedDate,
          stock_count_items: rawItems.map((it: Record<string, unknown>, idx: number) => {
            const pId = (it["product_id"] as string) || "";
            const matched = productMap.get(pId);
            const desc =
              (it["product_description"] as string) ||
              (it["description"] as string) ||
              (it["product_name"] as string) ||
              (it["name"] as string) ||
              (it["products"] as { description?: string })?.description ||
              matched?.description ||
              "Produto";
            const unit =
              (it["unit"] as string) ||
              (it["products"] as { unit?: string })?.unit ||
              matched?.unit ||
              "UN";

            return {
              id: (it["id"] as string) || `${d.id}_${idx}`,
              product_id: pId,
              expected_quantity: Number(it["expected_quantity"]) || 0,
              counted_quantity: Number(it["counted_quantity"]) || 0,
              difference: Number(it["difference"]) || 0,
              products: {
                description: desc,
                unit: unit,
              },
            };
          }),
        };
      });
      items.sort((a, b) => new Date(b.counted_at).getTime() - new Date(a.counted_at).getTime());
      return items;
    },
  });
}

/* --------------------------------- writes --------------------------------- */

export type ProductInput = {
  description: string;
  code?: number | null;
  category_id?: string | null;
  supplier_id?: string | null;
  unit: string;
  avg_weekly_consumption: number;
  daily_consumption_mode?: ConsumptionMode;
  daily_consumption?: DailyConsumption;
  constant_daily_consumption?: number;
  min_stock: number;
  desired_stock: number;
  safety_stock: number;
  coverage_weeks?: number | null;
  lead_time_days: number;
  notes?: string | null;
  current_stock?: number;
};

export async function saveProduct(
  input: ProductInput,
  existingProduct?: { id: string; current_stock: number },
) {
  let categoryName: string | null = null;
  let supplierName: string | null = null;

  if (input.category_id) {
    try {
      const catSnap = await getDoc(doc(db, "categories", input.category_id));
      if (catSnap.exists()) categoryName = catSnap.data()["name"] || null;
    } catch {
      // ignora
    }
  }

  if (input.supplier_id) {
    try {
      const supSnap = await getDoc(doc(db, "suppliers", input.supplier_id));
      if (supSnap.exists()) supplierName = supSnap.data()["name"] || null;
    } catch {
      // ignora
    }
  }

  const payload = {
    description: input.description.trim(),
    code: input.code ?? null,
    category_id: input.category_id || null,
    category_name: categoryName,
    supplier_id: input.supplier_id || null,
    supplier_name: supplierName,
    unit: input.unit,
    avg_weekly_consumption: input.avg_weekly_consumption,
    daily_consumption_mode: input.daily_consumption_mode ?? "constant",
    daily_consumption: input.daily_consumption ?? null,
    constant_daily_consumption:
      input.constant_daily_consumption !== undefined ? input.constant_daily_consumption : null,
    min_stock: input.min_stock,
    desired_stock: input.desired_stock,
    safety_stock: input.safety_stock,
    coverage_weeks: input.coverage_weeks ?? null,
    lead_time_days: Math.round(input.lead_time_days),
    notes: input.notes?.trim() || null,
    updated_at: serverTimestamp(),
  };

  if (existingProduct) {
    const productRef = doc(db, "products", existingProduct.id);
    await updateDoc(productRef, payload);

    const newStock = Number(input.current_stock) || 0;
    const oldStock = Number(existingProduct.current_stock) || 0;
    if (newStock !== oldStock) {
      await applyMovement({
        productId: existingProduct.id,
        type: newStock > oldStock ? "ajuste_positivo" : "ajuste_negativo",
        newQuantity: newStock,
        notes: "Ajuste manual pelo cadastro do produto",
      });
    }
    return existingProduct.id;
  } else {
    const docRef = await addDoc(collection(db, "products"), {
      ...payload,
      current_stock: 0,
      active: true,
      created_at: serverTimestamp(),
    });

    const initial = Number(input.current_stock) || 0;
    if (initial !== 0) {
      await applyMovement({
        productId: docRef.id,
        type: "contagem",
        newQuantity: initial,
        notes: "Estoque inicial no cadastro",
      });
    }
    return docRef.id;
  }
}

export async function updateProductConsumption(
  productId: string,
  avgWeeklyConsumption: number,
  dailyConsumption?: DailyConsumption,
  mode?: ConsumptionMode,
) {
  const productRef = doc(db, "products", productId);
  const data: Record<string, unknown> = {
    avg_weekly_consumption: avgWeeklyConsumption,
    updated_at: serverTimestamp(),
  };
  if (dailyConsumption) {
    data["daily_consumption"] = dailyConsumption;
  }
  if (mode) {
    data["daily_consumption_mode"] = mode;
  }
  await updateDoc(productRef, data);
}

export type SupplierInput = {
  name: string;
  cnpj_cpf?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  pix_key?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  notes?: string | null;
};

export async function saveSupplier(input: SupplierInput, supplierId?: string) {
  const payload = {
    name: input.name.trim(),
    cnpj_cpf: input.cnpj_cpf?.trim() || null,
    contact: input.contact?.trim() || null,
    contact_name: input.contact?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    pix_key: input.pix_key?.trim() || null,
    bank_name: input.bank_name?.trim() || null,
    bank_agency: input.bank_agency?.trim() || null,
    bank_account: input.bank_account?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: serverTimestamp(),
  };

  if (supplierId) {
    await updateDoc(doc(db, "suppliers", supplierId), payload);
    return { id: supplierId };
  } else {
    const docRef = await addDoc(collection(db, "suppliers"), {
      ...payload,
      created_at: serverTimestamp(),
    });
    return { id: docRef.id };
  }
}

export async function deleteSupplier(supplierId: string) {
  await deleteDoc(doc(db, "suppliers", supplierId));
}

export async function saveCategory(name: string): Promise<{ id: string }> {
  const docRef = await addDoc(collection(db, "categories"), {
    name: name.trim().toUpperCase(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return { id: docRef.id };
}

export async function updateCategory(id: string, name: string) {
  await updateDoc(doc(db, "categories", id), {
    name: name.trim().toUpperCase(),
    updated_at: serverTimestamp(),
  });
}

export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, "categories", id));
}

export async function saveUnit(code: string, name: string): Promise<{ code: string }> {
  const finalCode = code.trim().toUpperCase();
  await setDoc(doc(db, "units", finalCode), {
    code: finalCode,
    name: name.trim() || finalCode,
    created_at: serverTimestamp(),
  });
  return { code: finalCode };
}

export async function updateUnit(code: string, name: string) {
  await updateDoc(doc(db, "units", code), {
    name: name.trim(),
    updated_at: serverTimestamp(),
  });
}

export async function deleteUnit(code: string) {
  await deleteDoc(doc(db, "units", code));
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  items?: Array<{ id: string; product_id: string; quantity: number }>,
  productsList?: ProductRow[],
) {
  if (status === "recebido" && items && items.length > 0) {
    for (const item of items) {
      let currentStock = 0;

      if (productsList) {
        const p = productsList.find((x) => x.id === item.product_id);
        currentStock = Number(p?.current_stock) || 0;
      } else {
        const pSnap = await getDoc(doc(db, "products", item.product_id));
        if (pSnap.exists()) {
          const pData = pSnap.data();
          currentStock = Number(pData["current_stock"]) || 0;
        }
      }

      await applyMovement({
        productId: item.product_id,
        type: "entrada_compra",
        newQuantity: currentStock + Number(item.quantity),
        notes: "Recebimento de pedido de compra",
        referenceType: "purchase_order",
        referenceId: orderId,
      });
    }
  }

  const patch: Record<string, unknown> = {
    status,
    received_at: status === "recebido" ? new Date().toISOString() : null,
    ordered_at: status === "pedido_realizado" ? new Date().toISOString() : null,
    updated_at: serverTimestamp(),
  };

  await updateDoc(doc(db, "purchase_orders", orderId), patch);
}

export async function recordStockCount(
  notes: string | null,
  items: Array<{ productId: string; expected: number; counted: number }>,
) {
  const countDocRef = doc(collection(db, "stock_counts"));
  const countId = countDocRef.id;

  const countItems = [];

  for (const item of items) {
    countItems.push({
      id: crypto.randomUUID(),
      count_id: countId,
      product_id: item.productId,
      expected_quantity: item.expected,
      counted_quantity: item.counted,
      difference: item.counted - item.expected,
    });

    if (item.counted !== item.expected) {
      await applyMovement({
        productId: item.productId,
        type: "contagem",
        newQuantity: item.counted,
        notes: `Contagem de estoque (diferença ${item.counted - item.expected})`,
        referenceType: "stock_count",
        referenceId: countId,
      });
    }
  }

  await setDoc(countDocRef, {
    user_name: CURRENT_USER,
    notes: notes?.trim() || null,
    items: countItems,
    counted_at: new Date().toISOString(),
    created_at: serverTimestamp(),
  });
}

export async function createOrdersFromSuggestions(
  groups: Array<{
    supplierId: string | null;
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      description?: string;
    }>;
  }>,
) {
  // Buscar o maior número de pedido atual para continuar a sequência numérica
  let nextNumber = 1;
  try {
    const existingOrdersSnap = await getDocs(collection(db, "purchase_orders"));
    existingOrdersSnap.docs.forEach((docSnap) => {
      const num = Number(docSnap.data()["number"]);
      if (Number.isFinite(num) && num >= nextNumber) {
        nextNumber = num + 1;
      }
    });
  } catch {
    // se falhar, utiliza 1 como base
  }

  for (const group of groups) {
    let supplierName: string | null = null;
    if (group.supplierId) {
      try {
        const supSnap = await getDoc(doc(db, "suppliers", group.supplierId));
        if (supSnap.exists()) supplierName = supSnap.data()["name"] || null;
      } catch {
        // ignora
      }
    }

    const orderDocRef = doc(collection(db, "purchase_orders"));
    const orderItems = group.items.map((it) => ({
      id: crypto.randomUUID(),
      order_id: orderDocRef.id,
      product_id: it.productId,
      product_description: it.description || "",
      quantity: it.quantity,
      unit: it.unit,
    }));

    const currentOrderNum = nextNumber++;

    await setDoc(orderDocRef, {
      number: currentOrderNum,
      supplier_id: group.supplierId,
      supplier_name: supplierName,
      status: "rascunho",
      user_name: CURRENT_USER,
      notes: "Gerado a partir das sugestões de compra",
      items: orderItems,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }
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

export async function applyMovement(input: MovementInput) {
  const productRef = doc(db, "products", input.productId);
  const movementRef = doc(collection(db, "stock_movements"));

  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error(`Produto não encontrado para movimentação: ${input.productId}`);
    }

    const productData = productSnap.data();
    const before = Number(productData["current_stock"]) || 0;
    const after = Number(input.newQuantity) || 0;
    const change = after - before;

    transaction.update(productRef, {
      current_stock: after,
      updated_at: serverTimestamp(),
    });

    transaction.set(movementRef, {
      product_id: input.productId,
      product_description: productData["description"] || "",
      product_unit: productData["unit"] || "UN",
      type: input.type,
      quantity_before: before,
      quantity_change: change,
      quantity_after: after,
      user_name: CURRENT_USER,
      notes: input.notes ?? null,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      created_at: serverTimestamp(),
    });
  });
}

/* --------------------------------- delete --------------------------------- */

export async function deleteProduct(productId: string) {
  const batch = writeBatch(db);

  const movSnap = await getDocs(
    query(collection(db, "stock_movements"), where("product_id", "==", productId)),
  );
  movSnap.docs.forEach((d) => batch.delete(d.ref));

  batch.delete(doc(db, "products", productId));
  await batch.commit();
}

export async function deleteOrder(orderId: string) {
  await deleteDoc(doc(db, "purchase_orders", orderId));
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
