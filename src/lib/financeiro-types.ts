export type TipoTransacao = "receita" | "despesa";

export type StatusTransacao = "pendente" | "pago" | "atrasado" | "cancelado";

export type TipoRecorrencia = "unica" | "mensal" | "parcelada";

export interface FinancialCategory {
  id: string;
  name: string;
  type: TipoTransacao;
  color: string | null;
  icon: string | null;
  created_at: string;
}

export interface CostCenter {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  active: boolean;
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  description: string | null;
  type: TipoTransacao;
  amount: number;
  due_date: string; // YYYY-MM-DD
  payment_date: string | null; // YYYY-MM-DD
  paid_amount: number | null;
  status: StatusTransacao;
  category_id: string | null;
  cost_center_id: string | null;
  payment_method_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  notes: string | null;
  document_url: string | null;
  is_recurring: boolean;
  recurrence_group_id: string | null;
  installment_current: number | null;
  installment_total: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Relações opcionais expandidas
  category?: FinancialCategory | null;
  cost_center?: CostCenter | null;
  payment_method?: PaymentMethod | null;
  supplier?: {
    id: string;
    name: string;
    cnpj_cpf?: string | null;
    pix_key?: string | null;
    bank_name?: string | null;
    bank_agency?: string | null;
    bank_account?: string | null;
  } | null;
}

export interface CreateFinancialTransactionInput {
  description?: string | null | undefined;
  type: TipoTransacao;
  amount: number;
  due_date: string;
  payment_date?: string | null | undefined;
  paid_amount?: number | null | undefined;
  status?: StatusTransacao | undefined;
  category_id?: string | null | undefined;
  cost_center_id?: string | null | undefined;
  payment_method_id?: string | null | undefined;
  supplier_id?: string | null | undefined;
  supplier_name?: string | null | undefined;
  notes?: string | null | undefined;
  document_url?: string | null | undefined;
  is_recurring?: boolean | undefined;
  recurrence_type?: TipoRecorrencia | undefined;
  installment_total?: number | undefined; // Para compras parceladas (ex: 3x, 12x)
  recurrence_months?: number | undefined; // Para recorrências mensais fixas geradas adiantadas
}

export interface UpdateFinancialTransactionInput {
  id: string;
  description?: string | null | undefined;
  type?: TipoTransacao | undefined;
  amount?: number | undefined;
  due_date?: string | undefined;
  payment_date?: string | null | undefined;
  paid_amount?: number | null | undefined;
  status?: StatusTransacao | undefined;
  category_id?: string | null | undefined;
  cost_center_id?: string | null | undefined;
  payment_method_id?: string | null | undefined;
  supplier_id?: string | null | undefined;
  supplier_name?: string | null | undefined;
  notes?: string | null | undefined;
  document_url?: string | null | undefined;
}

export interface QuitarTransacaoInput {
  id: string;
  payment_date: string; // Data efetiva do pagamento
  paid_amount: number; // Valor efetivamente pago (juros/descontos)
  payment_method_id?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface FinancialFilters {
  search?: string | undefined;
  type?: TipoTransacao | "todas" | undefined;
  status?: StatusTransacao | "todos" | undefined;
  category_id?: string | "todas" | undefined;
  cost_center_id?: string | "todos" | undefined;
  payment_method_id?: string | "todos" | undefined;
  supplier_id?: string | "todos" | undefined;
  startDate?: string | undefined; // YYYY-MM-DD
  endDate?: string | undefined; // YYYY-MM-DD
  month?: number | undefined; // 0-11
  year?: number | undefined; // ex: 2026
}

export interface FinancialSummary {
  saldoRealizado: number; // Receitas Pagas - Despesas Pagas
  saldoPrevisto: number; // Saldo Realizado + Receitas Pendentes - Despesas Pendentes
  totalReceitasRealizadas: number;
  totalReceitasPendentes: number;
  totalDespesasRealizadas: number;
  totalDespesasPendentes: number;
  totalContasVencidas: number;
  qtdContasVencidas: number;
  totalContasAVencerHoje: number;
  qtdContasAVencerHoje: number;
  totalMesReceitas: number;
  totalMesDespesas: number;
  resultadoLiquidoMes: number;
}

export interface MonthSummary {
  month: number; // 1-12
  monthLabel: string;
  receitasPrevistas: number;
  receitasRealizadas: number;
  despesasPrevistas: number;
  despesasRealizadas: number;
  saldoOperacionalRealizado: number;
  saldoOperacionalPrevisto: number;
}
