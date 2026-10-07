export type TipoTransacao = "receita" | "despesa";

export type StatusTransacao = "pendente" | "pago" | "atrasado" | "cancelado";

export type TipoRecorrencia = "unica" | "semanal" | "quinzenal" | "mensal" | "parcelada";

export type HighlightColor =
  "none" | "orange" | "amber" | "blue" | "emerald" | "purple" | "rose" | "yellow";

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

export interface TransactionComment {
  id: string;
  user_id: string;
  user_name: string;
  user_email?: string | null;
  text: string;
  mentions?: string[]; // IDs ou nomes de usuários mencionados (ex: ['Wesley', 'wesleyjunio197@gmail.com'])
  mentioned_user_ids?: string[]; // IDs diretos dos usuários mencionados
  read_by?: string[]; // IDs dos usuários que já leram esta menção
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  description: string | null;
  type: TipoTransacao;
  amount: number;
  due_date: string; // YYYY-MM-DD
  expected_payment_date?: string | null; // Data Prevista Pgmt / Nova Data Pagamento (postergada) YYYY-MM-DD
  issue_date?: string | null; // Data de emissão YYYY-MM-DD
  code?: string | number | null; // Código ou identificador
  order_index?: number | null; // Ordem vertical customizável
  payment_date: string | null; // YYYY-MM-DD
  paid_amount: number | null;
  status: StatusTransacao;
  category_id: string | null;
  cost_center_id: string | null;
  payment_method_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  pix_key?: string | null; // Chave PIX da conta ou fornecedor
  notes: string | null;
  comments?: TransactionComment[] | null; // Comentários e menções da conta
  document_url: string | null;
  highlight_color?: HighlightColor | null; // Cor marcante suave para destacar a linha
  is_new?: boolean | null; // Tag de lançamento novo
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
  expected_payment_date?: string | null | undefined;
  issue_date?: string | null | undefined;
  code?: string | number | null | undefined;
  order_index?: number | null | undefined;
  payment_date?: string | null | undefined;
  paid_amount?: number | null | undefined;
  status?: StatusTransacao | undefined;
  category_id?: string | null | undefined;
  cost_center_id?: string | null | undefined;
  payment_method_id?: string | null | undefined;
  supplier_id?: string | null | undefined;
  supplier_name?: string | null | undefined;
  pix_key?: string | null | undefined;
  notes?: string | null | undefined;
  document_url?: string | null | undefined;
  highlight_color?: HighlightColor | null | undefined;
  is_new?: boolean | null | undefined;
  is_recurring?: boolean | undefined;
  recurrence_type?: TipoRecorrencia | undefined;
  installment_total?: number | undefined; // Para compras parceladas (ex: 3x, 12x)
  recurrence_months?: number | undefined; // Para recorrências mensais fixas geradas adiantadas
  recurrence_weeks?: number | undefined; // Para recorrências semanais fixas (ex: domingos, 12 a 52 semanas)
  recurrence_day_of_week?: number | undefined; // 0 (Domingo) a 6 (Sábado)
}

export interface UpdateFinancialTransactionInput {
  id: string;
  description?: string | null | undefined;
  type?: TipoTransacao | undefined;
  amount?: number | undefined;
  due_date?: string | undefined;
  expected_payment_date?: string | null | undefined;
  issue_date?: string | null | undefined;
  code?: string | number | null | undefined;
  order_index?: number | null | undefined;
  payment_date?: string | null | undefined;
  paid_amount?: number | null | undefined;
  status?: StatusTransacao | undefined;
  category_id?: string | null | undefined;
  category_name?: string | null | undefined;
  cost_center_id?: string | null | undefined;
  cost_center_name?: string | null | undefined;
  payment_method_id?: string | null | undefined;
  payment_method_name?: string | null | undefined;
  supplier_id?: string | null | undefined;
  supplier_name?: string | null | undefined;
  pix_key?: string | null | undefined;
  notes?: string | null | undefined;
  comments?: TransactionComment[] | undefined;
  document_url?: string | null | undefined;
  highlight_color?: HighlightColor | null | undefined;
  is_new?: boolean | null | undefined;
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
  category_ids?: string[] | undefined;
  cost_center_id?: string | "todos" | undefined;
  cost_center_ids?: string[] | undefined;
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

export type QuadrantSortOption =
  | "manual"
  | "valor_desc"
  | "valor_asc"
  | "alfabetico_asc"
  | "alfabetico_desc"
  | "vencimento"
  | "pendentes_primeiro";

export const SORT_LABELS: Record<QuadrantSortOption, string> = {
  manual: "Manual (Arrastar e Soltar)",
  valor_desc: "Maior Valor (R$ ↓)",
  valor_asc: "Menor Valor (R$ ↑)",
  alfabetico_asc: "Fornecedor (A-Z)",
  alfabetico_desc: "Fornecedor (Z-A)",
  vencimento: "Data de Vencimento",
  pendentes_primeiro: "Pendentes Primeiro",
};
