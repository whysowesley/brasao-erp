import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Undo2,
  Pencil,
  Copy,
  Trash2,
  Settings,
  Calendar,
  Layers,
  Building2,
  Tag,
  CreditCard,
  ChevronDown,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Palette,
  Sparkles,
  Check,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { LancamentoDialog } from "@/components/financeiro/LancamentoDialog";
import { MarcarPagoDialog } from "@/components/financeiro/MarcarPagoDialog";
import { CategoriasDialog } from "@/components/financeiro/CategoriasDialog";
import { ExtratoFinanceiroPdfModal } from "@/components/financeiro/ExtratoFinanceiroPdfModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";

import {
  useFinancialTransactions,
  useFinancialCategories,
  useCostCenters,
  usePaymentMethods,
  useDeleteFinancialTransaction,
  useReversePayment,
  useMoveFinancialTransactionDay,
  useUpdateFinancialTransaction,
  resolveTransactionStatus,
  getTransactionDisplayTitle,
  getTodayString,
  HIGHLIGHT_COLORS,
  getHighlightRowClass,
  isTransactionNew,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type {
  FinancialTransaction,
  StatusTransacao,
  TipoTransacao,
  HighlightColor,
} from "@/lib/financeiro-types";

export const Route = createFileRoute("/_authenticated/financeiro/lancamentos")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa e Lançamentos | Brasão Financeiro" },
      {
        name: "description",
        content: "Controle de entradas, saídas e compromissos financeiros da Brasão.",
      },
    ],
  }),
  component: LancamentosPage,
});

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

type SortField =
  | "due_date"
  | "expected_payment_date"
  | "description"
  | "type"
  | "category"
  | "cost_center"
  | "supplier"
  | "amount"
  | "status";

type SortDirection = "asc" | "desc";

function LancamentosPage() {
  const { canWrite } = useAuth();

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("todos");
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("todos");

  // Ordenação da Tabela
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Para texto A-Z por padrão, para data/valor mais recente/maior por padrão
      if (field === "amount" || field === "due_date" || field === "expected_payment_date") {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  }

  function handleResetSort() {
    setSortField("due_date");
    setSortDirection("desc");
  }

  // Período
  const [periodPreset, setPeriodPreset] = useState<string>("mes_atual");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Modais
  const [openLancamento, setOpenLancamento] = useState(false);
  const [openCategorias, setOpenCategorias] = useState(false);
  const [openExtratoPdf, setOpenExtratoPdf] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);

  // Dialog de Exclusão
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [deleteGroupOption, setDeleteGroupOption] = useState(false);

  // Queries
  const { data: categories = [] } = useFinancialCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: suppliers = [] } = useSuppliers();

  // Mutações
  const deleteMutation = useDeleteFinancialTransaction();
  const reverseMutation = useReversePayment();
  const moveDayMutation = useMoveFinancialTransactionDay();
  const updateMutation = useUpdateFinancialTransaction();

  const handleQuickHighlight = async (t: FinancialTransaction, color: HighlightColor) => {
    if (!canWrite) return;
    try {
      await updateMutation.mutateAsync({
        id: t.id,
        highlight_color: color === "none" ? null : color,
      });
      const colorLabel = HIGHLIGHT_COLORS.find((c) => c.id === color)?.name || "Padrão";
      toast.success(
        color === "none"
          ? "Destaque de cor removido."
          : `Cor da linha alterada para ${colorLabel}.`,
      );
    } catch {
      toast.error("Erro ao alterar cor de destaque.");
    }
  };

  const handleToggleNew = async (t: FinancialTransaction) => {
    if (!canWrite) return;
    const currentIsNew = isTransactionNew(t);
    try {
      await updateMutation.mutateAsync({
        id: t.id,
        is_new: !currentIsNew,
      });
      toast.success(!currentIsNew ? "Marcado com tag Novo!" : "Tag Novo removida.");
    } catch {
      toast.error("Erro ao atualizar tag Novo.");
    }
  };

  // Resolve intervalo de datas pelo Preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (periodPreset === "mes_atual") {
      return {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "mes_anterior") {
      const prev = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(prev), "yyyy-MM-dd"),
        endDate: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "proximo_mes") {
      const next = addMonths(now, 1);
      return {
        startDate: format(startOfMonth(next), "yyyy-MM-dd"),
        endDate: format(endOfMonth(next), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "ano_atual") {
      return {
        startDate: `${now.getFullYear()}-01-01`,
        endDate: `${now.getFullYear()}-12-31`,
      };
    }
    if (periodPreset === "custom") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [periodPreset, customStartDate, customEndDate]);

  // Rótulo textual amigável do período selecionado para o Extrato
  const periodLabelFormatted = useMemo(() => {
    if (periodPreset === "mes_atual") {
      return `Mês Atual (${format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })})`;
    }
    if (periodPreset === "mes_anterior") {
      const prev = subMonths(new Date(), 1);
      return `Mês Anterior (${format(prev, "MMMM 'de' yyyy", { locale: ptBR })})`;
    }
    if (periodPreset === "proximo_mes") {
      const next = addMonths(new Date(), 1);
      return `Próximo Mês (${format(next, "MMMM 'de' yyyy", { locale: ptBR })})`;
    }
    if (periodPreset === "ano_atual") {
      return `Ano Atual (${new Date().getFullYear()})`;
    }
    if (periodPreset === "custom" && customStartDate && customEndDate) {
      return `${format(parseISO(customStartDate), "dd/MM/yyyy")} até ${format(parseISO(customEndDate), "dd/MM/yyyy")}`;
    }
    return "Todos os Lançamentos";
  }, [periodPreset, customStartDate, customEndDate]);

  // Consulta transações com os filtros aplicados
  const { data: transactions = [], isLoading } = useFinancialTransactions({
    search: searchTerm,
    type: typeFilter as TipoTransacao | "todas",
    status: statusFilter as StatusTransacao | "todos",
    category_id: categoryFilter,
    cost_center_id: costCenterFilter,
    supplier_id: supplierFilter,
    payment_method_id: paymentMethodFilter,
    startDate,
    endDate,
  });

  const today = getTodayString();

  // Métricas rápidas da seleção filtrada
  const { totalReceitas, totalDespesas, saldoPeriodo } = useMemo(() => {
    let rec = 0;
    let desp = 0;
    for (const t of transactions) {
      if (t.status === "cancelado") continue;
      const amt = t.status === "pago" && t.paid_amount ? t.paid_amount : t.amount;
      if (t.type === "receita") rec += amt;
      else desp += amt;
    }
    return {
      totalReceitas: rec,
      totalDespesas: desp,
      saldoPeriodo: rec - desp,
    };
  }, [transactions]);

  // Lista ordenada pelos cabeçalhos interativos da tabela (A-Z, Maior/Menor, Datas, etc.)
  const sortedTransactions = useMemo(() => {
    if (!transactions.length) return [];
    const list = [...transactions];

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "due_date":
          comparison = a.due_date.localeCompare(b.due_date);
          break;
        case "expected_payment_date": {
          const dateA = a.expected_payment_date || a.due_date;
          const dateB = b.expected_payment_date || b.due_date;
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case "description": {
          const descA = a.description || "";
          const descB = b.description || "";
          comparison = descA.localeCompare(descB, "pt-BR", { sensitivity: "base" });
          break;
        }
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "category": {
          const catA = a.category?.name || a.category_name || "";
          const catB = b.category?.name || b.category_name || "";
          comparison = catA.localeCompare(catB, "pt-BR", { sensitivity: "base" });
          break;
        }
        case "cost_center": {
          const ccA = a.cost_center?.name || a.cost_center_name || "";
          const ccB = b.cost_center?.name || b.cost_center_name || "";
          comparison = ccA.localeCompare(ccB, "pt-BR", { sensitivity: "base" });
          break;
        }
        case "supplier": {
          const supA = a.supplier?.name || a.supplier_name || "";
          const supB = b.supplier?.name || b.supplier_name || "";
          comparison = supA.localeCompare(supB, "pt-BR", { sensitivity: "base" });
          break;
        }
        case "amount": {
          const amtA = a.status === "pago" && a.paid_amount ? a.paid_amount : a.amount;
          const amtB = b.status === "pago" && b.paid_amount ? b.paid_amount : b.amount;
          comparison = amtA - amtB;
          break;
        }
        case "status": {
          const statusA = resolveTransactionStatus(a.status, a.due_date, today);
          const statusB = resolveTransactionStatus(b.status, b.due_date, today);
          comparison = statusA.localeCompare(statusB);
          break;
        }
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [transactions, sortField, sortDirection, today]);

  function handleOpenCreate() {
    if (!canWrite) return;
    setEditingTransaction(null);
    setOpenLancamento(true);
  }

  function handleOpenEdit(t: FinancialTransaction) {
    if (!canWrite) return;
    setEditingTransaction(t);
    setOpenLancamento(true);
  }

  function handleDuplicate(t: FinancialTransaction) {
    if (!canWrite) return;
    const baseDesc = t.description?.trim() || t.supplier?.name || t.supplier_name || "";
    // Abre o modal preenchendo os dados porém sem ID para criar novo lançamento cópia
    setEditingTransaction({
      ...t,
      id: "",
      description: baseDesc ? `${baseDesc} (Cópia)` : "",
      status: "pendente",
      payment_date: null,
      paid_amount: null,
      is_recurring: false,
      recurrence_group_id: null,
      installment_current: null,
      installment_total: null,
    });
    setOpenLancamento(true);
  }

  async function handleReverse(t: FinancialTransaction) {
    if (!canWrite) return;
    try {
      await reverseMutation.mutateAsync(t.id);
      toast.success("Pagamento estornado com sucesso. Lançamento voltou a ficar pendente.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao estornar pagamento.";
      toast.error(msg);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingTransaction || !canWrite) return;
    try {
      await deleteMutation.mutateAsync({
        id: deletingTransaction.id,
        deleteAllInGroup: deleteGroupOption,
      });
      toast.success("Lançamento excluído com sucesso.");
      setDeletingTransaction(null);
      setDeleteGroupOption(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir lançamento.";
      toast.error(msg);
    }
  }

  function clearAllFilters() {
    setSearchTerm("");
    setTypeFilter("todas");
    setStatusFilter("todos");
    setCategoryFilter("todas");
    setCostCenterFilter("todos");
    setSupplierFilter("todos");
    setPaymentMethodFilter("todos");
    setPeriodPreset("mes_atual");
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Topo */}
      <PageHeader
        title="Fluxo de Caixa"
        description="Controle de entradas, saídas e compromissos financeiros"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenExtratoPdf(true)}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
              title="Gerar e imprimir extrato financeiro completo em folha A4 com paginação automática"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>Extrato em PDF (A4)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCategorias(true)}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              <span>Categorias & Centros</span>
            </Button>
            {canWrite && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="gap-1.5 bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span>+ Novo Lançamento</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Resumo do Período Filtrado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Entradas no Filtro</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalReceitas)}
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-emerald-500" />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 p-3.5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Saídas no Filtro</p>
            <p className="mt-0.5 text-lg font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(totalDespesas)}
            </p>
          </div>
          <ArrowDownRight className="h-5 w-5 text-rose-500" />
        </div>

        <div
          className={`flex items-center justify-between rounded-lg border p-3.5 ${
            saldoPeriodo >= 0
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">Saldo do Filtro</p>
            <p className="mt-0.5 text-lg font-bold">{formatCurrency(saldoPeriodo)}</p>
          </div>
          <span className="text-xs font-semibold">
            {transactions.length} {transactions.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor, categoria, observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Seletor de Período Rápido */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodPreset} onValueChange={setPeriodPreset}>
              <SelectTrigger className="w-[160px] text-xs">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="proximo_mes">Próximo Mês</SelectItem>
                <SelectItem value="ano_atual">Ano Atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
                <SelectItem value="todos">Todo o Histórico</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm ||
              typeFilter !== "todas" ||
              statusFilter !== "todos" ||
              categoryFilter !== "todas" ||
              costCenterFilter !== "todos" ||
              supplierFilter !== "todos" ||
              paymentMethodFilter !== "todos" ||
              periodPreset !== "mes_atual") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>

        {/* Datas Customizadas quando período é Personalizado */}
        {periodPreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">De:</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Até:</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          </div>
        )}

        {/* Filtros Secundários */}
        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3 md:grid-cols-6">
          {/* Tipo */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Tipos (Todos)</SelectItem>
              <SelectItem value="receita">Apenas Receitas</SelectItem>
              <SelectItem value="despesa">Apenas Despesas</SelectItem>
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status (Todos)</SelectItem>
              <SelectItem value="pago">Pago / Recebido</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {/* Categoria */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Categorias (Todas)</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.type === "receita" ? "Rec." : "Desp."})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Centro de Custo */}
          <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Centros (Todos)</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Fornecedor */}
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Fornecedores (Todos)</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Forma de Pagamento */}
          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Forma Pgto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Formas (Todas)</SelectItem>
              {paymentMethods.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  {pm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela Principal */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {/* Barra de Status da Ordenação */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 flex-wrap">
            <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
            <span>Ordenado por:</span>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-background py-0 h-5 gap-1"
            >
              {sortField === "due_date" && "Dia de Vencimento"}
              {sortField === "expected_payment_date" && "Nova Data Pgto (Postergada)"}
              {sortField === "description" && "Descrição"}
              {sortField === "type" && "Tipo"}
              {sortField === "category" && "Categoria"}
              {sortField === "cost_center" && "Centro de Custo"}
              {sortField === "supplier" && "Fornecedor"}
              {sortField === "amount" && "Valor (R$)"}
              {sortField === "status" && "Status"}
              <span className="text-primary font-bold">
                ({sortDirection === "asc" ? "A-Z / Menor / Antigo" : "Z-A / Maior / Recente"})
              </span>
            </Badge>
          </div>

          {(sortField !== "due_date" || sortDirection !== "desc") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetSort}
              className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
            >
              Restaurar padrão
            </Button>
          )}
        </div>

        <div className="sm:hidden flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground bg-muted/40 border-b">
          <span>Arraste para o lado para ver todas as colunas</span>
          <span className="font-mono text-[10px] text-primary">↔ deslize</span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="w-32 cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("due_date")}
                  title="Ordenar por Dia de Vencimento"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Dia de Vencimento</span>
                    {sortField === "due_date" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="w-36 cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("expected_payment_date")}
                  title="Ordenar por Nova Data Prevista de Pagamento"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Nova Data Pgto</span>
                    {sortField === "expected_payment_date" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("description")}
                  title="Ordenar por Descrição (A-Z ou Z-A)"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Descrição</span>
                    {sortField === "description" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="w-24 cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("type")}
                  title="Ordenar por Tipo (Receita / Despesa)"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Tipo</span>
                    {sortField === "type" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("category")}
                  title="Ordenar por Categoria (A-Z)"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Categoria</span>
                    {sortField === "category" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("cost_center")}
                  title="Ordenar por Centro de Custo (A-Z)"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Centro de Custo</span>
                    {sortField === "cost_center" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("supplier")}
                  title="Ordenar por Fornecedor (A-Z)"
                >
                  <div className="flex items-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Fornecedor</span>
                    {sortField === "supplier" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="text-right cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("amount")}
                  title="Ordenar por Valor (Maior para menor ou menor para maior)"
                >
                  <div className="flex items-center justify-end gap-1 font-semibold text-xs text-foreground group">
                    <span>Valor</span>
                    {sortField === "amount" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead
                  className="w-28 text-center cursor-pointer select-none hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort("status")}
                  title="Ordenar por Status"
                >
                  <div className="flex items-center justify-center gap-1 font-semibold text-xs text-foreground group">
                    <span>Status</span>
                    {sortField === "status" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-75 transition-opacity ml-1 shrink-0" />
                    )}
                  </div>
                </TableHead>

                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    Nenhum lançamento financeiro encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransactions.map((t) => {
                  const status = resolveTransactionStatus(t.status, t.due_date, today);
                  const isReceita = t.type === "receita";
                  const isPago = status === "pago";
                  const hasPostponedDate = Boolean(
                    t.expected_payment_date && t.expected_payment_date !== t.due_date,
                  );

                  return (
                    <TableRow
                      key={t.id}
                      className={`hover:bg-muted/30 transition-colors ${getHighlightRowClass(
                        t.highlight_color,
                      )}`}
                    >
                      {/* Dia de Vencimento (Original) */}
                      <TableCell className="text-xs font-medium">
                        <div>
                          <span>{format(parseISO(t.due_date), "dd/MM/yyyy")}</span>
                          {isPago && t.payment_date && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              Pago em {format(parseISO(t.payment_date), "dd/MM")}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Nova Data Pgto (Postergada / Previsão) */}
                      <TableCell className="text-xs">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canWrite}
                              className={`h-7 px-2 text-xs font-medium ${
                                hasPostponedDate
                                  ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Clique para alterar a data postergada de pagamento"
                            >
                              <Calendar className="mr-1 h-3 w-3" />
                              {t.expected_payment_date
                                ? format(parseISO(t.expected_payment_date), "dd/MM/yyyy")
                                : "—"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="start">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Nova Data de Pagamento:</p>
                              <CalendarPicker
                                mode="single"
                                selected={
                                  t.expected_payment_date
                                    ? parseISO(t.expected_payment_date)
                                    : parseISO(t.due_date)
                                }
                                onSelect={async (newDate) => {
                                  if (newDate) {
                                    const formatted = format(newDate, "yyyy-MM-dd");
                                    await moveDayMutation.mutateAsync({
                                      id: t.id,
                                      targetDate: formatted,
                                      mode: "expected",
                                    });
                                    toast.success(
                                      `Data reagendada para ${format(newDate, "dd/MM/yyyy")}!`,
                                    );
                                  }
                                }}
                                initialFocus
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      {/* Descrição & Detalhes */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-foreground flex-wrap">
                            <span>{getTransactionDisplayTitle(t)}</span>
                            {isTransactionNew(t) && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 shadow-2xs"
                                title="Lançamento novo (adicionado recentemente)"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                                Novo
                              </span>
                            )}
                            {t.installment_total && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 bg-primary/5 text-[10px] text-primary"
                              >
                                {t.installment_current || 1}/{t.installment_total}x
                              </Badge>
                            )}
                            {t.is_recurring && !t.installment_total && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                Recorrente
                              </Badge>
                            )}
                          </div>
                          {t.notes && (
                            <p className="line-clamp-1 text-xs text-muted-foreground/80">
                              {t.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            isReceita
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isReceita ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {isReceita ? "Receita" : "Despesa"}
                        </span>
                      </TableCell>

                      {/* Categoria */}
                      <TableCell className="text-xs">
                        {(() => {
                          const catName =
                            t.category?.name ||
                            categories.find((c) => c.id === t.category_id)?.name ||
                            (t as unknown as { category_name?: string }).category_name;
                          return catName ? (
                            <span className="font-medium text-foreground">{catName}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          );
                        })()}
                      </TableCell>

                      {/* Centro de Custo */}
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {t.cost_center?.name ||
                          costCenters.find((c) => c.id === t.cost_center_id)?.name ||
                          (t as unknown as { cost_center_name?: string }).cost_center_name ||
                          "—"}
                      </TableCell>

                      {/* Fornecedor */}
                      <TableCell className="text-xs text-muted-foreground">
                        {(suppliers.find((s) => s.id === t.supplier_id) || t.supplier)?.name ||
                          t.supplier_name ||
                          "—"}
                      </TableCell>

                      {/* Valor */}
                      <TableCell className="text-right">
                        <div className="font-semibold">
                          <span
                            className={
                              isReceita
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {isReceita ? "+ " : "- "}
                            {formatCurrency(t.amount)}
                          </span>
                          {isPago && t.paid_amount && t.paid_amount !== t.amount && (
                            <p className="text-[10px] text-muted-foreground">
                              Efetivo: {formatCurrency(t.paid_amount)}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {status === "pago" && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400">
                            {isReceita ? "Recebido" : "Pago"}
                          </Badge>
                        )}
                        {status === "pendente" && (
                          <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400">
                            Pendente
                          </Badge>
                        )}
                        {status === "atrasado" && (
                          <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-400">
                            Atrasado
                          </Badge>
                        )}
                        {status === "cancelado" && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Cancelado
                          </Badge>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        {canWrite ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
                              {!isPago ? (
                                <DropdownMenuItem
                                  onClick={() => setPayingTransaction(t)}
                                  className="gap-2 text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{isReceita ? "Marcar Recebido" : "Marcar Pago"}</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleReverse(t)}
                                  className="gap-2 text-amber-600 focus:text-amber-600"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  <span>Estornar Baixa</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenEdit(t)} className="gap-2">
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(t)}
                                className="gap-2"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>Duplicar</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Quick Color Picker */}
                              <div className="px-2 py-1.5 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Palette className="h-3 w-3" />
                                    Cor de Destaque
                                  </span>
                                  {t.highlight_color && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickHighlight(t, "none")}
                                      className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                                    >
                                      Limpar
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                                  {HIGHLIGHT_COLORS.map((c) => {
                                    const isCur = (t.highlight_color || "none") === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleQuickHighlight(t, c.id)}
                                        className={`h-6 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                                          isCur
                                            ? "border-primary ring-1 ring-primary shadow-xs font-bold"
                                            : "border-border/60 hover:border-border hover:bg-muted/50"
                                        }`}
                                        title={c.label}
                                      >
                                        <span
                                          className={`h-3 w-3 rounded-full shrink-0 ${c.dotClass}`}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <DropdownMenuItem
                                onClick={() => handleToggleNew(t)}
                                className="text-xs"
                              >
                                <Sparkles className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                {isTransactionNew(t)
                                  ? "Remover tag 'Novo'"
                                  : "Marcar com tag 'Novo'"}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingTransaction(t)}
                                className="gap-2 text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Excluir</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modais Compartilhados */}
      <LancamentoDialog
        open={openLancamento}
        onOpenChange={(open) => {
          setOpenLancamento(open);
          if (!open) setEditingTransaction(null);
        }}
        transactionToEdit={editingTransaction}
      />

      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

      <CategoriasDialog open={openCategorias} onOpenChange={setOpenCategorias} />

      {/* Modal de Extrato Financeiro em PDF A4 */}
      <ExtratoFinanceiroPdfModal
        open={openExtratoPdf}
        onOpenChange={setOpenExtratoPdf}
        transactions={sortedTransactions}
        periodLabel={periodLabelFormatted}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Alert Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!deletingTransaction}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTransaction(null);
            setDeleteGroupOption(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Confirmar Exclusão</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir o lançamento{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;{getTransactionDisplayTitle(deletingTransaction)}&rdquo;
                </span>{" "}
                no valor de{" "}
                <span className="font-semibold text-foreground">
                  {deletingTransaction && formatCurrency(deletingTransaction.amount)}
                </span>
                ?
              </p>
              {deletingTransaction?.recurrence_group_id && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">
                    Este lançamento faz parte de uma série/parcelamento.
                  </p>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteGroupOption}
                      onChange={(e) => setDeleteGroupOption(e.target.checked)}
                      className="rounded border-amber-400"
                    />
                    <span>Excluir todas as parcelas/ocorrências futuras deste grupo</span>
                  </label>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
