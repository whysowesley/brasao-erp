import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import type {
  FinancialTransaction,
  FinancialCategory,
  CostCenter,
  PaymentMethod,
  TipoTransacao,
  StatusTransacao,
  TipoRecorrencia,
  CreateFinancialTransactionInput,
  UpdateFinancialTransactionInput,
  FinancialSummary,
  MonthSummary,
  FinancialFilters,
} from "@/lib/financeiro-types";

export type {
  FinancialTransaction,
  FinancialCategory,
  CostCenter,
  PaymentMethod,
  TipoTransacao,
  StatusTransacao,
  TipoRecorrencia,
  CreateFinancialTransactionInput,
  UpdateFinancialTransactionInput,
  FinancialSummary,
  MonthSummary,
  FinancialFilters,
};

export interface QuitarTransacaoInput {
  id: string;
  payment_date: string;
  paid_amount: number;
  payment_method_id?: string | null | undefined;
  notes?: string | null | undefined;
}

/* -------------------------------------------------------------------------- */
/*                                    UTIL                                    */
/* -------------------------------------------------------------------------- */

export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeTransactionStatus(
  statusOrObj:
    | StatusTransacao
    | { status: StatusTransacao; due_date: string; payment_date?: string | null | undefined },
  dueDate?: string,
  todayStr?: string,
): StatusTransacao {
  if (typeof statusOrObj === "object" && statusOrObj !== null) {
    if (statusOrObj.status === "pago" || statusOrObj.status === "cancelado") {
      return statusOrObj.status;
    }
    const today = todayStr || getTodayString();
    if (statusOrObj.due_date < today) {
      return "atrasado";
    }
    return "pendente";
  }

  const rawStatus = statusOrObj;
  if (rawStatus === "pago" || rawStatus === "cancelado") {
    return rawStatus;
  }
  const today = todayStr || getTodayString();
  if (dueDate && dueDate < today) {
    return "atrasado";
  }
  return "pendente";
}

export const resolveTransactionStatus = computeTransactionStatus;

export function getTransactionDisplayTitle(
  t:
    | {
        description?: string | null | undefined;
        supplier_name?: string | null | undefined;
        supplier?: { name?: string | null | undefined } | null | undefined;
        type?: TipoTransacao | undefined;
      }
    | null
    | undefined,
): string {
  if (!t) return "Transação";
  if (t.description && t.description.trim()) {
    return t.description.trim();
  }
  if (t.supplier_name && t.supplier_name.trim()) {
    return t.supplier_name.trim();
  }
  if (t.supplier?.name && t.supplier.name.trim()) {
    return t.supplier.name.trim();
  }
  return t.type === "receita" ? "Receita Diversa" : "Despesa Operacional";
}

/* -------------------------------------------------------------------------- */
/*                                   QUERIES                                  */
/* -------------------------------------------------------------------------- */

export function useFinancialTransactions(filters?: FinancialFilters) {
  return useQuery({
    queryKey: ["financial_transactions", filters],
    queryFn: async (): Promise<FinancialTransaction[]> => {
      const snap = await getDocs(collection(db, "financial_transactions"));
      const today = getTodayString();

      let transactions: FinancialTransaction[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const createdDate = (data["created_at"] as { toDate?: () => Date })?.toDate
          ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
          : (data["created_at"] as string) || new Date().toISOString();
        const updatedDate = (data["updated_at"] as { toDate?: () => Date })?.toDate
          ? (data["updated_at"] as { toDate: () => Date }).toDate().toISOString()
          : (data["updated_at"] as string) || createdDate;

        return {
          id: d.id,
          description: (data["description"] as string) || null,
          type: (data["type"] || "despesa") as TipoTransacao,
          amount: Number(data["amount"]) || 0,
          due_date: (data["due_date"] as string) || today,
          expected_payment_date: (data["expected_payment_date"] as string) || null,
          issue_date: (data["issue_date"] as string) || null,
          code: (data["code"] as string | number) ?? null,
          order_index: typeof data["order_index"] === "number" ? data["order_index"] : null,
          payment_date: (data["payment_date"] as string) || null,
          paid_amount:
            data["paid_amount"] !== undefined && data["paid_amount"] !== null
              ? Number(data["paid_amount"])
              : null,
          status: (data["status"] || "pendente") as StatusTransacao,
          category_id: (data["category_id"] as string) || null,
          cost_center_id: (data["cost_center_id"] as string) || null,
          payment_method_id: (data["payment_method_id"] as string) || null,
          supplier_id: (data["supplier_id"] as string) || null,
          supplier_name: (data["supplier_name"] as string) || null,
          notes: (data["notes"] as string) || null,
          document_url: (data["document_url"] as string) || null,
          is_recurring: Boolean(data["is_recurring"]),
          recurrence_group_id: (data["recurrence_group_id"] as string) || null,
          installment_current: (data["installment_current"] as number) || null,
          installment_total: (data["installment_total"] as number) || null,
          created_by: (data["created_by"] as string) || null,
          created_at: createdDate,
          updated_at: updatedDate,
          category:
            (data["category"] as FinancialCategory | null | undefined) ||
            (data["category_name"]
              ? {
                  id: (data["category_id"] as string) || "",
                  name: data["category_name"] as string,
                  type: (data["type"] || "despesa") as TipoTransacao,
                  color: null,
                  icon: null,
                  created_at: createdDate,
                }
              : null),
          cost_center:
            (data["cost_center"] as CostCenter | null | undefined) ||
            (data["cost_center_name"]
              ? {
                  id: (data["cost_center_id"] as string) || "",
                  name: data["cost_center_name"] as string,
                  description: null,
                  created_at: createdDate,
                }
              : null),
          payment_method:
            (data["payment_method"] as PaymentMethod | null | undefined) ||
            (data["payment_method_name"]
              ? {
                  id: (data["payment_method_id"] as string) || "",
                  name: data["payment_method_name"] as string,
                  type: "outros",
                  active: true,
                  created_at: createdDate,
                }
              : null),
          supplier:
            (data["supplier"] as { id: string; name: string } | null | undefined) ||
            (data["supplier_name"]
              ? {
                  id: (data["supplier_id"] as string) || "",
                  name: data["supplier_name"] as string,
                  cnpj_cpf: null,
                  pix_key: null,
                  bank_name: null,
                  bank_agency: null,
                  bank_account: null,
                }
              : null),
        };
      });

      transactions = transactions.map((t) => ({
        ...t,
        status: computeTransactionStatus(t),
      }));

      if (filters) {
        if (filters.type && filters.type !== "todas") {
          transactions = transactions.filter((t) => t.type === filters.type);
        }
        if (filters.status && filters.status !== "todos") {
          transactions = transactions.filter((t) => t.status === filters.status);
        }
        if (filters.category_id && filters.category_id !== "todas") {
          transactions = transactions.filter((t) => t.category_id === filters.category_id);
        }
        if (filters.cost_center_id && filters.cost_center_id !== "todos") {
          transactions = transactions.filter((t) => t.cost_center_id === filters.cost_center_id);
        }
        if (filters.payment_method_id && filters.payment_method_id !== "todos") {
          transactions = transactions.filter(
            (t) => t.payment_method_id === filters.payment_method_id,
          );
        }
        if (filters.supplier_id && filters.supplier_id !== "todos") {
          transactions = transactions.filter((t) => t.supplier_id === filters.supplier_id);
        }
        if (filters.startDate) {
          transactions = transactions.filter((t) => t.due_date >= filters.startDate!);
        }
        if (filters.endDate) {
          transactions = transactions.filter((t) => t.due_date <= filters.endDate!);
        }
        if (filters.month !== undefined && filters.year !== undefined) {
          const mStr = String(filters.month + 1).padStart(2, "0");
          const prefix = `${filters.year}-${mStr}`;
          transactions = transactions.filter((t) => t.due_date.startsWith(prefix));
        } else if (filters.year !== undefined) {
          const prefix = `${filters.year}-`;
          transactions = transactions.filter((t) => t.due_date.startsWith(prefix));
        }
        if (filters.search && filters.search.trim()) {
          const s = filters.search.toLowerCase().trim();
          transactions = transactions.filter(
            (t) =>
              (t.description && t.description.toLowerCase().includes(s)) ||
              (t.supplier_name && t.supplier_name.toLowerCase().includes(s)) ||
              (t.notes && t.notes.toLowerCase().includes(s)),
          );
        }
      }

      transactions.sort((a, b) => b.due_date.localeCompare(a.due_date));
      return transactions;
    },
  });
}

export function useFinancialTransaction(id: string | null) {
  return useQuery({
    queryKey: ["financial_transaction", id],
    queryFn: async (): Promise<FinancialTransaction | null> => {
      if (!id) return null;
      const snap = await getDoc(doc(db, "financial_transactions", id));
      if (!snap.exists()) return null;

      const data = snap.data() as Record<string, unknown>;
      const today = getTodayString();
      const createdDate = (data["created_at"] as { toDate?: () => Date })?.toDate
        ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
        : (data["created_at"] as string) || new Date().toISOString();
      const updatedDate = (data["updated_at"] as { toDate?: () => Date })?.toDate
        ? (data["updated_at"] as { toDate: () => Date }).toDate().toISOString()
        : (data["updated_at"] as string) || createdDate;

      const item: FinancialTransaction = {
        id: snap.id,
        description: (data["description"] as string) || null,
        type: (data["type"] || "despesa") as TipoTransacao,
        amount: Number(data["amount"]) || 0,
        due_date: (data["due_date"] as string) || today,
        expected_payment_date: (data["expected_payment_date"] as string) || null,
        issue_date: (data["issue_date"] as string) || null,
        code: (data["code"] as string | number) ?? null,
        order_index: typeof data["order_index"] === "number" ? data["order_index"] : null,
        payment_date: (data["payment_date"] as string) || null,
        paid_amount:
          data["paid_amount"] !== undefined && data["paid_amount"] !== null
            ? Number(data["paid_amount"])
            : null,
        status: (data["status"] || "pendente") as StatusTransacao,
        category_id: (data["category_id"] as string) || null,
        cost_center_id: (data["cost_center_id"] as string) || null,
        payment_method_id: (data["payment_method_id"] as string) || null,
        supplier_id: (data["supplier_id"] as string) || null,
        supplier_name: (data["supplier_name"] as string) || null,
        notes: (data["notes"] as string) || null,
        document_url: (data["document_url"] as string) || null,
        is_recurring: Boolean(data["is_recurring"]),
        recurrence_group_id: (data["recurrence_group_id"] as string) || null,
        installment_current: (data["installment_current"] as number) || null,
        installment_total: (data["installment_total"] as number) || null,
        created_by: (data["created_by"] as string) || null,
        created_at: createdDate,
        updated_at: updatedDate,
        category:
          (data["category"] as FinancialCategory | null | undefined) ||
          (data["category_name"]
            ? {
                id: (data["category_id"] as string) || "",
                name: data["category_name"] as string,
                type: (data["type"] || "despesa") as TipoTransacao,
                color: null,
                icon: null,
                created_at: createdDate,
              }
            : null),
        cost_center:
          (data["cost_center"] as CostCenter | null | undefined) ||
          (data["cost_center_name"]
            ? {
                id: (data["cost_center_id"] as string) || "",
                name: data["cost_center_name"] as string,
                description: null,
                created_at: createdDate,
              }
            : null),
        payment_method:
          (data["payment_method"] as PaymentMethod | null | undefined) ||
          (data["payment_method_name"]
            ? {
                id: (data["payment_method_id"] as string) || "",
                name: data["payment_method_name"] as string,
                type: "outros",
                active: true,
                created_at: createdDate,
              }
            : null),
        supplier:
          (data["supplier"] as { id: string; name: string } | null | undefined) ||
          (data["supplier_name"]
            ? {
                id: (data["supplier_id"] as string) || "",
                name: data["supplier_name"] as string,
                cnpj_cpf: null,
                pix_key: null,
                bank_name: null,
                bank_agency: null,
                bank_account: null,
              }
            : null),
      };

      item.status = computeTransactionStatus(item);
      return item;
    },
    enabled: !!id,
  });
}

/** Categorias Financeiras */
export function useFinancialCategories(type?: TipoTransacao) {
  return useQuery({
    queryKey: ["financial_categories", type],
    queryFn: async (): Promise<FinancialCategory[]> => {
      const snap = await getDocs(collection(db, "financial_categories"));
      let list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: (data["name"] as string) || "",
          type: (data["type"] || "despesa") as TipoTransacao,
          color: (data["color"] as string) || null,
          icon: (data["icon"] as string) || null,
          created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
            ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
            : (data["created_at"] as string) || new Date().toISOString(),
        };
      });
      if (type) {
        list = list.filter((c) => c.type === type);
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });
}

/** Centros de Custo */
export function useCostCenters() {
  return useQuery({
    queryKey: ["cost_centers"],
    queryFn: async (): Promise<CostCenter[]> => {
      const snap = await getDocs(collection(db, "cost_centers"));
      const list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: (data["name"] as string) || "",
          description: (data["description"] as string) || null,
          created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
            ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
            : (data["created_at"] as string) || new Date().toISOString(),
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });
}

/** Formas de Pagamento */
export function usePaymentMethods(activeOnly = true) {
  return useQuery({
    queryKey: ["payment_methods", activeOnly],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const snap = await getDocs(collection(db, "payment_methods"));
      let list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: (data["name"] as string) || "",
          type: (data["type"] || "outros") as string,
          active: data["active"] !== false,
          created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
            ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
            : (data["created_at"] as string) || new Date().toISOString(),
        };
      });
      if (activeOnly) {
        list = list.filter((p) => p.active);
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });
}

/** Resumo Mensal / Anual para Tabelas e Gráficos */
export function useMonthlyFinancialSummary(yearParam?: number) {
  const targetYear = yearParam || new Date().getFullYear();
  const { data: transactions = [], isLoading } = useFinancialTransactions({
    year: targetYear,
  });

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const monthsData: MonthSummary[] = Array.from({ length: 12 }, (_, idx) => {
    return {
      month: idx + 1,
      monthLabel: monthNames[idx] || `Mês ${idx + 1}`,
      receitasPrevistas: 0,
      receitasRealizadas: 0,
      despesasPrevistas: 0,
      despesasRealizadas: 0,
      saldoOperacionalRealizado: 0,
      saldoOperacionalPrevisto: 0,
    };
  });

  transactions.forEach((t) => {
    if (t.status === "cancelado") return;
    const m = parseInt(t.due_date.slice(5, 7), 10) - 1;
    if (m >= 0 && m < 12) {
      const monthObj = monthsData[m]!;
      if (t.type === "receita") {
        monthObj.receitasPrevistas += t.amount;
        if (t.status === "pago") {
          monthObj.receitasRealizadas += t.paid_amount ?? t.amount;
        }
      } else {
        monthObj.despesasPrevistas += t.amount;
        if (t.status === "pago") {
          monthObj.despesasRealizadas += t.paid_amount ?? t.amount;
        }
      }
    }
  });

  monthsData.forEach((m) => {
    m.saldoOperacionalRealizado = m.receitasRealizadas - m.despesasRealizadas;
    m.saldoOperacionalPrevisto = m.receitasPrevistas - m.despesasPrevistas;
  });

  return { monthsData, isLoading, transactions };
}

/** Dashboard consolidado do Financeiro */
export function useFinancialDashboard(monthParam?: number, yearParam?: number) {
  const today = getTodayString();
  const targetYear = yearParam !== undefined ? yearParam : new Date().getFullYear();
  const targetMonth = monthParam !== undefined ? monthParam : new Date().getMonth();

  const { data: allTransactions = [], isLoading: loadingTrans } = useFinancialTransactions({
    year: targetYear,
  });

  const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
  const monthTransactions = allTransactions.filter((t) => t.due_date.startsWith(monthStr));

  const summary: FinancialSummary = {
    saldoRealizado: 0,
    saldoPrevisto: 0,
    totalReceitasRealizadas: 0,
    totalReceitasPendentes: 0,
    totalDespesasRealizadas: 0,
    totalDespesasPendentes: 0,
    totalContasVencidas: 0,
    qtdContasVencidas: 0,
    totalContasAVencerHoje: 0,
    qtdContasAVencerHoje: 0,
    totalMesReceitas: 0,
    totalMesDespesas: 0,
    resultadoLiquidoMes: 0,
  };

  monthTransactions.forEach((t) => {
    if (t.status === "cancelado") return;
    if (t.type === "receita") {
      summary.totalMesReceitas += t.amount;
      if (t.status === "pago") {
        summary.totalReceitasRealizadas += t.paid_amount ?? t.amount;
      } else {
        summary.totalReceitasPendentes += t.amount;
      }
    } else {
      summary.totalMesDespesas += t.amount;
      if (t.status === "pago") {
        summary.totalDespesasRealizadas += t.paid_amount ?? t.amount;
      } else {
        summary.totalDespesasPendentes += t.amount;
      }
    }
  });

  // Todas as transações do ano para contas vencidas ou vencendo hoje
  allTransactions.forEach((t) => {
    if (t.status === "cancelado" || t.status === "pago") return;
    if (t.type === "despesa") {
      const dynamicStatus = computeTransactionStatus(t.status, t.due_date, today);
      if (dynamicStatus === "atrasado") {
        summary.totalContasVencidas += t.amount;
        summary.qtdContasVencidas += 1;
      } else if (t.due_date === today) {
        summary.totalContasAVencerHoje += t.amount;
        summary.qtdContasAVencerHoje += 1;
      }
    }
  });

  summary.saldoRealizado = summary.totalReceitasRealizadas - summary.totalDespesasRealizadas;
  summary.saldoPrevisto =
    summary.saldoRealizado + summary.totalReceitasPendentes - summary.totalDespesasPendentes;
  summary.resultadoLiquidoMes = summary.totalReceitasRealizadas - summary.totalDespesasRealizadas;

  return {
    summary,
    isLoading: loadingTrans,
    transactions: monthTransactions,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   MUTATIONS                                */
/* -------------------------------------------------------------------------- */

export function useInvalidateFinancial() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["financial_transactions"] });
    qc.invalidateQueries({ queryKey: ["financial_transaction"] });
    qc.invalidateQueries({ queryKey: ["financial_categories"] });
    qc.invalidateQueries({ queryKey: ["cost_centers"] });
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };
}

/** Criação de Transação Única, Parcelada ou Recorrente */
export async function createFinancialTransaction(
  input: CreateFinancialTransactionInput,
): Promise<string> {
  const batch = writeBatch(db);

  let categoryName: string | null = null;
  let costCenterName: string | null = null;
  let paymentMethodName: string | null = null;
  let supplierName: string | null = input.supplier_name || null;

  if (input.category_id) {
    try {
      const snap = await getDoc(doc(db, "financial_categories", input.category_id));
      if (snap.exists()) categoryName = (snap.data()["name"] as string) || null;
    } catch {
      // ignora
    }
  }

  if (input.cost_center_id) {
    try {
      const snap = await getDoc(doc(db, "cost_centers", input.cost_center_id));
      if (snap.exists()) costCenterName = (snap.data()["name"] as string) || null;
    } catch {
      // ignora
    }
  }

  if (input.payment_method_id) {
    try {
      const snap = await getDoc(doc(db, "payment_methods", input.payment_method_id));
      if (snap.exists()) paymentMethodName = (snap.data()["name"] as string) || null;
    } catch {
      // ignora
    }
  }

  if (input.supplier_id && !supplierName) {
    try {
      const snap = await getDoc(doc(db, "suppliers", input.supplier_id));
      if (snap.exists()) supplierName = (snap.data()["name"] as string) || null;
    } catch {
      // ignora
    }
  }

  const basePayload = {
    description: input.description?.trim() || null,
    type: input.type,
    expected_payment_date: input.expected_payment_date || null,
    issue_date: input.issue_date || null,
    code: input.code ?? null,
    order_index: typeof input.order_index === "number" ? input.order_index : null,
    category_id: input.category_id || null,
    category_name: categoryName,
    cost_center_id: input.cost_center_id || null,
    cost_center_name: costCenterName,
    payment_method_id: input.payment_method_id || null,
    payment_method_name: paymentMethodName,
    supplier_id: input.supplier_id || null,
    supplier_name: supplierName,
    notes: input.notes?.trim() || null,
    document_url: input.document_url?.trim() || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const isInstallment =
    input.recurrence_type === "parcelada" ||
    (input.installment_total !== undefined && input.installment_total > 1);

  if (isInstallment && (input.installment_total || 0) > 1) {
    const totalParcels = input.installment_total!;
    const recurrenceGroupId = crypto.randomUUID();
    const parcelAmount = Number((input.amount / totalParcels).toFixed(2));
    let firstId = "";

    const parts = input.due_date.split("-");
    const baseYear = parseInt(parts[0] || "2026", 10);
    const baseMonth = parseInt(parts[1] || "1", 10) - 1;
    const baseDay = parseInt(parts[2] || "1", 10);

    for (let i = 1; i <= totalParcels; i++) {
      const nextDate = new Date(baseYear, baseMonth + (i - 1), baseDay);
      const nextDueDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

      const parcelDocRef = doc(collection(db, "financial_transactions"));
      if (i === 1) firstId = parcelDocRef.id;

      const isFirstAndPaid = i === 1 && input.status === "pago";

      batch.set(parcelDocRef, {
        ...basePayload,
        description: input.description
          ? `${input.description} (${i}/${totalParcels})`
          : `Parcela ${i}/${totalParcels}`,
        amount: parcelAmount,
        due_date: nextDueDate,
        payment_date: isFirstAndPaid ? input.payment_date || nextDueDate : null,
        paid_amount: isFirstAndPaid ? input.paid_amount || parcelAmount : null,
        status: isFirstAndPaid ? "pago" : "pendente",
        is_recurring: false,
        recurrence_group_id: recurrenceGroupId,
        installment_current: i,
        installment_total: totalParcels,
      });
    }

    await batch.commit();
    return firstId;
  }

  const isRecurring = input.recurrence_type === "mensal" || input.is_recurring === true;

  if (isRecurring) {
    const occurrences = input.recurrence_months || 12;
    const recurrenceGroupId = crypto.randomUUID();
    let firstId = "";

    const parts = input.due_date.split("-");
    const baseYear = parseInt(parts[0] || "2026", 10);
    const baseMonth = parseInt(parts[1] || "1", 10) - 1;
    const baseDay = parseInt(parts[2] || "1", 10);

    for (let i = 0; i < occurrences; i++) {
      const nextDate = new Date(baseYear, baseMonth + i, baseDay);
      const nextDueDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

      const recDocRef = doc(collection(db, "financial_transactions"));
      if (i === 0) firstId = recDocRef.id;

      const isFirstAndPaid = i === 0 && input.status === "pago";

      batch.set(recDocRef, {
        ...basePayload,
        amount: input.amount,
        due_date: nextDueDate,
        payment_date: isFirstAndPaid ? input.payment_date || nextDueDate : null,
        paid_amount: isFirstAndPaid ? input.paid_amount || input.amount : null,
        status: isFirstAndPaid ? "pago" : "pendente",
        is_recurring: true,
        recurrence_group_id: recurrenceGroupId,
        installment_current: i + 1,
        installment_total: occurrences,
      });
    }

    await batch.commit();
    return firstId;
  }

  const docRef = doc(collection(db, "financial_transactions"));
  const isPaid = input.status === "pago";

  await setDoc(docRef, {
    ...basePayload,
    amount: input.amount,
    due_date: input.due_date,
    payment_date: isPaid ? input.payment_date || input.due_date : null,
    paid_amount: isPaid ? input.paid_amount || input.amount : null,
    status: input.status || "pendente",
    is_recurring: false,
    recurrence_group_id: null,
    installment_current: null,
    installment_total: null,
  });

  return docRef.id;
}

export function useCreateFinancialTransaction() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: createFinancialTransaction,
    onSuccess: invalidate,
  });
}

export async function updateFinancialTransaction(
  input: UpdateFinancialTransactionInput,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: serverTimestamp(),
  };
  if (input.description !== undefined) updatePayload["description"] = input.description;
  if (input.type !== undefined) updatePayload["type"] = input.type;
  if (input.amount !== undefined) updatePayload["amount"] = input.amount;
  if (input.due_date !== undefined) updatePayload["due_date"] = input.due_date;
  if (input.expected_payment_date !== undefined)
    updatePayload["expected_payment_date"] = input.expected_payment_date;
  if (input.issue_date !== undefined) updatePayload["issue_date"] = input.issue_date;
  if (input.code !== undefined) updatePayload["code"] = input.code;
  if (input.order_index !== undefined) updatePayload["order_index"] = input.order_index;
  if (input.payment_date !== undefined) updatePayload["payment_date"] = input.payment_date;
  if (input.paid_amount !== undefined) updatePayload["paid_amount"] = input.paid_amount;
  if (input.status !== undefined) updatePayload["status"] = input.status;
  if (input.category_id !== undefined) updatePayload["category_id"] = input.category_id;
  if (input.cost_center_id !== undefined) updatePayload["cost_center_id"] = input.cost_center_id;
  if (input.payment_method_id !== undefined)
    updatePayload["payment_method_id"] = input.payment_method_id;
  if (input.supplier_id !== undefined) updatePayload["supplier_id"] = input.supplier_id;
  if (input.supplier_name !== undefined) updatePayload["supplier_name"] = input.supplier_name;
  if (input.notes !== undefined) updatePayload["notes"] = input.notes;
  if (input.document_url !== undefined) updatePayload["document_url"] = input.document_url;

  await updateDoc(doc(db, "financial_transactions", input.id), updatePayload);
}

export function useUpdateFinancialTransaction() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: updateFinancialTransaction,
    onSuccess: invalidate,
  });
}

/** Hook para mover transação de dia/quadrante facilmente (atualiza data prevista ou vencimento) */
export function useMoveFinancialTransactionDay() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: async ({
      id,
      targetDate,
      mode = "expected",
    }: {
      id: string;
      targetDate: string;
      mode?: "expected" | "due" | "both";
    }) => {
      const payload: Record<string, unknown> = {
        updated_at: serverTimestamp(),
      };
      if (mode === "expected" || mode === "both") {
        payload["expected_payment_date"] = targetDate;
      }
      if (mode === "due" || mode === "both") {
        payload["due_date"] = targetDate;
      }
      await updateDoc(doc(db, "financial_transactions", id), payload);
    },
    onSuccess: invalidate,
  });
}

/** Hook para reordenar linhas dentro de um quadrante ou entre quadrantes */
export function useBatchUpdateTransactionOrder() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; order_index: number; targetDate?: string }>) => {
      const batch = writeBatch(db);
      for (const item of items) {
        const updateData: Record<string, unknown> = {
          order_index: item.order_index,
          updated_at: serverTimestamp(),
        };
        if (item.targetDate) {
          updateData["expected_payment_date"] = item.targetDate;
        }
        batch.update(doc(db, "financial_transactions", item.id), updateData);
      }
      await batch.commit();
    },
    onSuccess: invalidate,
  });
}

export async function deleteFinancialTransaction(
  id: string,
  deleteAllInGroup = false,
): Promise<void> {
  if (deleteAllInGroup) {
    const snap = await getDoc(doc(db, "financial_transactions", id));
    const data = snap.data();
    if (data?.["recurrence_group_id"]) {
      const groupSnap = await getDocs(
        query(
          collection(db, "financial_transactions"),
          where("recurrence_group_id", "==", data["recurrence_group_id"]),
        ),
      );
      const batch = writeBatch(db);
      groupSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return;
    }
  }

  await deleteDoc(doc(db, "financial_transactions", id));
}

export function useDeleteFinancialTransaction() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: ({ id, deleteAllInGroup }: { id: string; deleteAllInGroup?: boolean }) =>
      deleteFinancialTransaction(id, deleteAllInGroup),
    onSuccess: invalidate,
  });
}

export async function payFinancialTransaction(input: QuitarTransacaoInput): Promise<void> {
  const payload: Record<string, unknown> = {
    status: "pago",
    payment_date: input.payment_date,
    paid_amount: input.paid_amount,
    updated_at: serverTimestamp(),
  };
  if (input.payment_method_id) payload["payment_method_id"] = input.payment_method_id;
  if (input.notes) payload["notes"] = input.notes;

  await updateDoc(doc(db, "financial_transactions", input.id), payload);
}

export function usePayFinancialTransaction() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: payFinancialTransaction,
    onSuccess: invalidate,
  });
}

export async function undoPaymentFinancialTransaction(id: string): Promise<void> {
  await updateDoc(doc(db, "financial_transactions", id), {
    status: "pendente",
    payment_date: null,
    paid_amount: null,
    updated_at: serverTimestamp(),
  });
}

export const useReversePayment = () => {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: (id: string) => undoPaymentFinancialTransaction(id),
    onSuccess: invalidate,
  });
};

/* -------------------------------- CADASTROS ------------------------------- */

export async function saveFinancialCategory(
  category: { name: string; type: TipoTransacao; color?: string | null; icon?: string | null },
  id?: string,
) {
  const payload = {
    name: category.name.trim(),
    type: category.type,
    color: category.color || null,
    icon: category.icon || null,
    updated_at: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "financial_categories", id), payload);
    return id;
  }
  const ref = await addDoc(collection(db, "financial_categories"), {
    ...payload,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export function useCreateCategory() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: (cat: {
      name: string;
      type: TipoTransacao;
      color?: string | null;
      icon?: string | null;
    }) => saveFinancialCategory(cat),
    onSuccess: invalidate,
  });
}

export async function deleteFinancialCategory(id: string) {
  await deleteDoc(doc(db, "financial_categories", id));
}

export function useDeleteCategory() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: deleteFinancialCategory,
    onSuccess: invalidate,
  });
}

export async function saveCostCenter(
  center: { name: string; description?: string | null },
  id?: string,
) {
  const payload = {
    name: center.name.trim(),
    description: center.description?.trim() || null,
    updated_at: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "cost_centers", id), payload);
    return id;
  }
  const ref = await addDoc(collection(db, "cost_centers"), {
    ...payload,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export function useCreateCostCenter() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: (cc: { name: string; description?: string | null }) => saveCostCenter(cc),
    onSuccess: invalidate,
  });
}

export async function deleteCostCenter(id: string) {
  await deleteDoc(doc(db, "cost_centers", id));
}

export function useDeleteCostCenter() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: deleteCostCenter,
    onSuccess: invalidate,
  });
}

export async function savePaymentMethod(
  method: { name: string; type: string; active?: boolean },
  id?: string,
) {
  const payload = {
    name: method.name.trim(),
    type: method.type,
    active: method.active !== false,
    updated_at: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "payment_methods", id), payload);
    return id;
  }
  const ref = await addDoc(collection(db, "payment_methods"), {
    ...payload,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export function useCreatePaymentMethod() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: (pm: { name: string; type: string; active?: boolean }) => savePaymentMethod(pm),
    onSuccess: invalidate,
  });
}

export async function deletePaymentMethod(id: string) {
  await deleteDoc(doc(db, "payment_methods", id));
}

export function useDeletePaymentMethod() {
  const invalidate = useInvalidateFinancial();
  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: invalidate,
  });
}
