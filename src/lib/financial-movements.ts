import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db, auth } from "@/integrations/firebase/config";
import { safeFormatDate } from "./date-utils";

export type FinancialMovementType =
  "data_postergada" | "vencimento_alterado" | "mudanca_quadrante" | "ambas_datas";

export interface FinancialDateMovement {
  id: string;
  transaction_id: string;
  movement_type: FinancialMovementType;
  movement_label: string;
  title: string;
  description?: string | null;
  amount: number;
  type: "despesa" | "receita";
  source_module: "contas_pagar" | "fluxo_caixa";
  previous_expected_date: string | null;
  new_expected_date: string | null;
  previous_due_date: string | null;
  new_due_date: string | null;
  due_date_original?: string | null;
  summary: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role?: string | null;
  created_at: string;
}

export const MAX_FINANCIAL_MOVEMENTS = 20;
export const FINANCIAL_MOVEMENTS_DOC = "financial_date_movements";

export interface RecordMovementInput {
  transaction_id: string;
  movement_type: FinancialMovementType;
  title: string;
  description?: string | null;
  amount: number;
  type?: "despesa" | "receita";
  source_module: "contas_pagar" | "fluxo_caixa";
  previous_expected_date?: string | null;
  new_expected_date?: string | null;
  previous_due_date?: string | null;
  new_due_date?: string | null;
  due_date_original?: string | null;
  summary?: string;
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
}

export function getMovementTypeLabel(type: FinancialMovementType): string {
  switch (type) {
    case "mudanca_quadrante":
      return "Movido de Quadrante";
    case "data_postergada":
      return "Data Postergada";
    case "vencimento_alterado":
      return "Vencimento Alterado";
    case "ambas_datas":
      return "Vencimento & Previsão";
    default:
      return "Movimentação de Data";
  }
}

/**
 * Registra uma nova movimentação de data/quadrante mantendo rigorosamente
 * apenas os últimos 20 registros interligados entre Contas a Pagar e Fluxo de Caixa.
 */
export async function recordFinancialDateMovement(
  input: RecordMovementInput,
): Promise<FinancialDateMovement> {
  const currentUser = auth.currentUser;
  const userName =
    input.userName?.trim() ||
    currentUser?.displayName?.trim() ||
    currentUser?.email?.split("@")[0] ||
    "Usuário";
  const userEmail = input.userEmail?.trim() || currentUser?.email?.trim() || "sistema";
  const userId = input.userId?.trim() || currentUser?.uid || "unknown";

  const movementLabel = getMovementTypeLabel(input.movement_type);

  // Monta resumo textual humanizado e claro conforme especificação
  let summary = input.summary;
  if (!summary) {
    const formattedPrevDue = input.previous_due_date
      ? safeFormatDate(input.previous_due_date, "dd/MM/yyyy")
      : "—";
    const formattedNewDue = input.new_due_date
      ? safeFormatDate(input.new_due_date, "dd/MM/yyyy")
      : "—";
    const formattedPrevExp = input.previous_expected_date
      ? safeFormatDate(input.previous_expected_date, "dd/MM/yyyy")
      : formattedPrevDue;
    const formattedNewExp = input.new_expected_date
      ? safeFormatDate(input.new_expected_date, "dd/MM/yyyy")
      : formattedNewDue;
    const origDue = input.due_date_original
      ? safeFormatDate(input.due_date_original, "dd/MM/yyyy")
      : formattedPrevDue;

    if (input.movement_type === "mudanca_quadrante") {
      summary = `${userName} moveu "${input.title}" do quadrante ${formattedPrevExp} para ${formattedNewExp} (vencimento original ${origDue} mantido).`;
    } else if (input.movement_type === "data_postergada") {
      summary = `${userName} postergou a data de pagamento de "${input.title}" de ${formattedPrevExp} para ${formattedNewExp}.`;
    } else if (input.movement_type === "vencimento_alterado") {
      summary = `${userName} alterou a data de vencimento de "${input.title}" de ${formattedPrevDue} para ${formattedNewDue}.`;
    } else {
      summary = `${userName} alterou as datas de "${input.title}" para ${formattedNewDue}.`;
    }
  }

  const newRecord: FinancialDateMovement = {
    id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    transaction_id: input.transaction_id,
    movement_type: input.movement_type,
    movement_label: movementLabel,
    title: input.title || "Lançamento",
    description: input.description || null,
    amount: Number(input.amount) || 0,
    type: input.type || "despesa",
    source_module: input.source_module,
    previous_expected_date: input.previous_expected_date || null,
    new_expected_date: input.new_expected_date || null,
    previous_due_date: input.previous_due_date || null,
    new_due_date: input.new_due_date || null,
    due_date_original: input.due_date_original || null,
    summary,
    user_id: userId,
    user_name: userName,
    user_email: userEmail,
    created_at: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, "settings", FINANCIAL_MOVEMENTS_DOC);
    const snap = await getDoc(docRef);
    let existing: FinancialDateMovement[] = [];

    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.["items"])) {
        existing = data["items"] as FinancialDateMovement[];
      }
    }

    // Adiciona ao topo e preserva estritamente os últimos 20
    const updated = [newRecord, ...existing].slice(0, MAX_FINANCIAL_MOVEMENTS);

    await setDoc(docRef, {
      items: updated,
      updated_at: serverTimestamp(),
    });

    // Registra também na coleção independente de histórico para persistência e auditoria
    try {
      await addDoc(collection(db, "financial_movements"), {
        ...newRecord,
        created_at_server: serverTimestamp(),
      });
    } catch {
      // tolerante caso regras da coleção sejam opcionais
    }

    return newRecord;
  } catch (err) {
    console.warn("Aviso ao registrar movimentação financeira:", err);
    return newRecord;
  }
}

/**
 * Hook para consultar em tempo real os últimos 20 registros de movimentações financeiras
 * (compartilhado instantaneamente entre Fluxo de Caixa e Contas a Pagar).
 */
export function useFinancialDateMovements() {
  const query = useQuery({
    queryKey: ["financial_date_movements"],
    queryFn: async (): Promise<FinancialDateMovement[]> => {
      try {
        const snap = await getDoc(doc(db, "settings", FINANCIAL_MOVEMENTS_DOC));
        if (!snap.exists()) return [];
        const data = snap.data();
        if (Array.isArray(data?.["items"])) {
          return (data["items"] as FinancialDateMovement[]).slice(0, MAX_FINANCIAL_MOVEMENTS);
        }
        return [];
      } catch (err) {
        console.warn("Erro ao buscar histórico de movimentações:", err);
        return [];
      }
    },
    staleTime: 1000 * 5, // 5 segundos
    refetchInterval: 1000 * 15, // Polling a cada 15s para garantir sincronização entre usuários
  });

  const list: FinancialDateMovement[] = query.data ?? [];

  return {
    ...query,
    data: list,
    movements: list,
  };
}
