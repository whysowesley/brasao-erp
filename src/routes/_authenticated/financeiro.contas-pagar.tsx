import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Undo2,
  Pencil,
  Trash2,
  ChevronDown,
  Building2,
  ArrowDownRight,
  CalendarDays,
  Table as TableIcon,
  Copy,
  Palette,
  Sparkles,
  Check,
  FolderPlus,
  Tag,
  Eye,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FinanceiroStatCard } from "@/components/financeiro/FinanceiroStatCard";
import { LancamentoDialog } from "@/components/financeiro/LancamentoDialog";
import { MarcarPagoDialog } from "@/components/financeiro/MarcarPagoDialog";
import { QuadrantesVencimentoView } from "@/components/financeiro/QuadrantesVencimentoView";
import { CategoriasDialog } from "@/components/financeiro/CategoriasDialog";
import {
  FiltroListaCheckbox,
  type FilterListItem,
} from "@/components/financeiro/FiltroListaCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import {
  useFinancialTransactions,
  useFinancialCategories,
  useCostCenters,
  useDeleteFinancialTransaction,
  useReversePayment,
  useUpdateFinancialTransaction,
  resolveTransactionStatus,
  getTodayString,
  HIGHLIGHT_COLORS,
  getHighlightRowClass,
  isTransactionNew,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction, HighlightColor } from "@/lib/financeiro-types";

export const Route = createFileRoute("/_authenticated/financeiro/contas-pagar")({
  head: () => ({
    meta: [
      { title: "Contas a Pagar | Brasão Financeiro" },
      {
        name: "description",
        content: "Gerenciamento de despesas, vencimentos e quitações com fornecedores da Brasão.",
      },
    ],
  }),
  component: ContasPagarPage,
});

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function ContasPagarPage() {
  const { canWrite } = useAuth();
  const today = getTodayString();

  // Modo de visualização (Quadrantes por Dia estilo Excel vs Tabela Geral)
  const [viewMode, setViewMode] = useState<"quadrantes" | "tabela">("quadrantes");

  // Estados de Filtros
  const [activeTab, setActiveTab] = useState<string>("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedCostCenterIds, setSelectedCostCenterIds] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");

  // Período
  const [periodPreset, setPeriodPreset] = useState<string>("mes_atual");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Modais
  const [openLancamento, setOpenLancamento] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);
  const [openCategorias, setOpenCategorias] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [deleteGroupOption, setDeleteGroupOption] = useState(false);

  // Queries
  const { data: categories = [] } = useFinancialCategories("despesa");
  const { data: costCenters = [] } = useCostCenters();
  const { data: suppliers = [] } = useSuppliers();

  // Mutações
  const deleteMutation = useDeleteFinancialTransaction();
  const reverseMutation = useReversePayment();
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

  // Intervalo de datas
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

  // Consulta fixada em despesas
  const { data: transactions = [], isLoading } = useFinancialTransactions({
    type: "despesa",
    search: searchTerm,
    category_ids: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    cost_center_ids: selectedCostCenterIds.length > 0 ? selectedCostCenterIds : undefined,
    supplier_id: supplierFilter,
    startDate,
    endDate,
  });

  // Métricas dos 4 cards de topo
  const {
    totalVencido,
    qtdVencido,
    totalHoje,
    qtdHoje,
    totalAVencer,
    qtdAVencer,
    totalPago,
    qtdPago,
  } = useMemo(() => {
    let vencido = 0;
    let qVencido = 0;
    let hoje = 0;
    let qHoje = 0;
    let aVencer = 0;
    let qAVencer = 0;
    let pago = 0;
    let qPago = 0;

    for (const t of transactions) {
      if (t.status === "cancelado") continue;
      const dynamicStatus = resolveTransactionStatus(t.status, t.due_date, today);

      if (dynamicStatus === "pago") {
        pago += t.paid_amount || t.amount;
        qPago++;
      } else if (dynamicStatus === "atrasado") {
        vencido += t.amount;
        qVencido++;
      } else if (t.due_date === today) {
        hoje += t.amount;
        qHoje++;
      } else if (t.due_date > today) {
        aVencer += t.amount;
        qAVencer++;
      }
    }

    return {
      totalVencido: vencido,
      qtdVencido: qVencido,
      totalHoje: hoje,
      qtdHoje: qHoje,
      totalAVencer: aVencer,
      qtdAVencer: qAVencer,
      totalPago: pago,
      qtdPago: qPago,
    };
  }, [transactions, today]);

  const categoryFilterItems = useMemo<FilterListItem[]>(() => {
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));
  }, [categories]);

  const costCenterFilterItems = useMemo<FilterListItem[]>(() => {
    return costCenters.map((cc) => ({
      id: cc.id,
      name: cc.name,
    }));
  }, [costCenters]);

  const hasActiveFilters = selectedCategoryIds.length > 0 || selectedCostCenterIds.length > 0;

  // Filtro por Aba Ativa
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status === "cancelado") return false;
      const dynamicStatus = resolveTransactionStatus(t.status, t.due_date, today);

      if (activeTab === "vencidas") return dynamicStatus === "atrasado";
      if (activeTab === "hoje") return dynamicStatus === "pendente" && t.due_date === today;
      if (activeTab === "a_vencer") return dynamicStatus === "pendente" && t.due_date > today;
      if (activeTab === "pagas") return dynamicStatus === "pago";
      return true; // "todas"
    });
  }, [transactions, activeTab, today]);

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
      toast.success("Pagamento estornado.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao estornar.";
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
      toast.success("Despesa excluída com sucesso.");
      setDeletingTransaction(null);
      setDeleteGroupOption(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir.";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Topo */}
      <PageHeader
        title="Contas a Pagar"
        description="Gerenciamento de despesas, vencimentos e quitações com fornecedores"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCategorias(true)}
              className="gap-1.5 h-9"
              title="Configurações Financeiras: Categorias, Centros de Custo e Formas de Pagamento"
            >
              <FolderPlus className="h-4 w-4 text-primary" />
              <span>Configurações</span>
            </Button>
            {canWrite && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="gap-1.5 bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90 h-9"
              >
                <Plus className="h-4 w-4" />
                <span>+ Nova Despesa</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Seletor de Modo de Visualização */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
          <Button
            variant={viewMode === "quadrantes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("quadrantes")}
            className="text-xs h-8 gap-1.5 font-semibold shadow-none"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Quadrantes por Dia (Excel)
          </Button>
          <Button
            variant={viewMode === "tabela" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tabela")}
            className="text-xs h-8 gap-1.5 font-semibold shadow-none"
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tabela Geral de Contas
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {viewMode === "quadrantes"
            ? "Visualização por vencimento diário vertical com facilidade de arrastar e reagendar fornecedores."
            : "Listagem tabular completa com filtros avançados e métricas."}
        </p>
      </div>

      {viewMode === "quadrantes" ? (
        <QuadrantesVencimentoView onOpenCreate={() => handleOpenCreate()} />
      ) : (
        <>
          {/* 4 Cards de Indicadores */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FinanceiroStatCard
              title="Total Vencido"
              value={totalVencido}
              variant={totalVencido > 0 ? "danger" : "default"}
              iconType="atrasado"
              badge={qtdVencido > 0 ? `${qtdVencido} contas` : undefined}
              subtitle="Aguardando regularização"
              onClick={() => setActiveTab("vencidas")}
              className="cursor-pointer"
            />

            <FinanceiroStatCard
              title="Vencendo Hoje"
              value={totalHoje}
              variant={totalHoje > 0 ? "warning" : "default"}
              iconType="pendente"
              badge={qtdHoje > 0 ? `${qtdHoje} contas` : undefined}
              subtitle="Programadas para hoje"
              onClick={() => setActiveTab("hoje")}
              className="cursor-pointer"
            />

            <FinanceiroStatCard
              title="A Vencer"
              value={totalAVencer}
              variant="info"
              iconType="previsto"
              badge={`${qtdAVencer} contas`}
              subtitle="Compromissos futuros"
              onClick={() => setActiveTab("a_vencer")}
              className="cursor-pointer"
            />

            <FinanceiroStatCard
              title="Total Pago"
              value={totalPago}
              variant="success"
              iconType="saldo"
              badge={`${qtdPago} quitadas`}
              subtitle="Liquidado no período"
              onClick={() => setActiveTab("pagas")}
              className="cursor-pointer"
            />
          </div>

          {/* Filtros e Busca */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, descrição, categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

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
                  hasActiveFilters ||
                  supplierFilter !== "todos" ||
                  periodPreset !== "mes_atual") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategoryIds([]);
                      setSelectedCostCenterIds([]);
                      setSupplierFilter("todos");
                      setPeriodPreset("mes_atual");
                    }}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

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

            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
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

              {/* Filtro de Categoria Financeira com Checkbox */}
              <FiltroListaCheckbox
                title="Categoria Financeira"
                icon={<Tag className="h-3.5 w-3.5 text-primary" />}
                items={categoryFilterItems}
                selectedIds={selectedCategoryIds}
                onSelectionChange={setSelectedCategoryIds}
                placeholder="Buscar categoria..."
                allLabel="Todas as Categorias"
              />

              {/* Filtro de Centro de Custo com Checkbox */}
              <FiltroListaCheckbox
                title="Centro de Custo"
                icon={<Building2 className="h-3.5 w-3.5 text-primary" />}
                items={costCenterFilterItems}
                selectedIds={selectedCostCenterIds}
                onSelectionChange={setSelectedCostCenterIds}
                placeholder="Buscar centro de custo..."
                allLabel="Todos os Centros"
              />
            </div>

            {/* Chips de filtros ativos se houver */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-xs">
                <span className="text-[11px] text-muted-foreground font-medium mr-1">
                  Filtro combinado:
                </span>
                {selectedCategoryIds.map((catId) => {
                  const item = categoryFilterItems.find((c) => c.id === catId);
                  return (
                    <Badge
                      key={`t-cat-${catId}`}
                      variant="outline"
                      className="h-5.5 text-[10px] pl-2 pr-1 gap-1 border-primary/40 bg-primary/5 text-primary font-medium"
                    >
                      <Tag className="h-2.5 w-2.5 shrink-0" />
                      <span>{item?.name || catId}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== catId))
                        }
                        className="hover:bg-primary/20 rounded-full p-0.5 text-primary cursor-pointer ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
                {selectedCostCenterIds.map((ccId) => {
                  const item = costCenterFilterItems.find((c) => c.id === ccId);
                  return (
                    <Badge
                      key={`t-cc-${ccId}`}
                      variant="outline"
                      className="h-5.5 text-[10px] pl-2 pr-1 gap-1 border-primary/40 bg-primary/5 text-primary font-medium"
                    >
                      <Building2 className="h-2.5 w-2.5 shrink-0" />
                      <span>{item?.name || ccId}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCostCenterIds(
                            selectedCostCenterIds.filter((id) => id !== ccId),
                          )
                        }
                        className="hover:bg-primary/20 rounded-full p-0.5 text-primary cursor-pointer ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    setSelectedCostCenterIds([]);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-destructive font-medium underline ml-1 cursor-pointer"
                >
                  Ver Tudo (Limpar)
                </button>
              </div>
            )}
          </div>

          {/* Abas de Navegação / Status */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 md:w-auto">
              <TabsTrigger value="todas" className="text-xs">
                Todas ({transactions.length})
              </TabsTrigger>
              <TabsTrigger value="vencidas" className="text-xs text-rose-600 dark:text-rose-400">
                Vencidas ({qtdVencido})
              </TabsTrigger>
              <TabsTrigger value="hoje" className="text-xs text-amber-600 dark:text-amber-400">
                Hoje ({qtdHoje})
              </TabsTrigger>
              <TabsTrigger value="a_vencer" className="text-xs text-blue-600 dark:text-blue-400">
                A Vencer ({qtdAVencer})
              </TabsTrigger>
              <TabsTrigger value="pagas" className="text-xs text-emerald-600 dark:text-emerald-400">
                Pagas ({qtdPago})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 rounded-lg border border-border bg-card shadow-sm">
              <div className="sm:hidden flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground bg-muted/40 border-b">
                <span>Arraste para o lado para ver todas as colunas</span>
                <span className="font-mono text-[10px] text-primary">↔ deslize</span>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Vencimento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Centro Custo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-28 text-center">Status</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={8}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          Nenhuma conta a pagar encontrada para este status/período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((t) => {
                        const status = resolveTransactionStatus(t.status, t.due_date, today);
                        const isPago = status === "pago";

                        return (
                          <TableRow
                            key={t.id}
                            className={`hover:bg-muted/30 transition-colors ${getHighlightRowClass(
                              t.highlight_color,
                            )}`}
                          >
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

                            <TableCell className="text-xs font-medium text-foreground">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{t.supplier?.name || t.supplier_name || "—"}</span>
                                {isTransactionNew(t) && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 shadow-2xs"
                                    title="Lançamento novo (adicionado recentemente)"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    Novo
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-medium text-foreground">{t.description}</span>
                                {t.installment_total && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1.5 border-primary/30 text-[10px] text-primary"
                                  >
                                    {t.installment_current || 1}/{t.installment_total}x
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {t.category?.name ||
                                (t as unknown as { category_name?: string }).category_name ||
                                "—"}
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {t.cost_center?.name ||
                                (t as unknown as { cost_center_name?: string }).cost_center_name ||
                                "—"}
                            </TableCell>

                            <TableCell className="text-right font-semibold text-rose-600 dark:text-rose-400">
                              {formatCurrency(isPago && t.paid_amount ? t.paid_amount : t.amount)}
                            </TableCell>

                            <TableCell className="text-center">
                              {status === "pago" && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                  Pago
                                </Badge>
                              )}
                              {status === "pendente" && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                  Pendente
                                </Badge>
                              )}
                              {status === "atrasado" && (
                                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400">
                                  Atrasado
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              {canWrite ? (
                                <div className="flex items-center justify-end gap-1">
                                  {!isPago ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      onClick={() => setPayingTransaction(t)}
                                    >
                                      Pagar
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs text-amber-600"
                                      onClick={() => handleReverse(t)}
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-36">
                                      <DropdownMenuItem
                                        onClick={() => handleOpenEdit(t)}
                                        className="gap-2"
                                      >
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
                                </div>
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
          </Tabs>
        </>
      )}

      {/* Modais */}
      <LancamentoDialog
        open={openLancamento}
        onOpenChange={(open) => {
          setOpenLancamento(open);
          if (!open) setEditingTransaction(null);
        }}
        transactionToEdit={editingTransaction}
        defaultType="despesa"
      />

      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

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
              <span>Confirmar Exclusão de Despesa</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Deseja realmente excluir a despesa{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;{deletingTransaction?.description}&rdquo;
                </span>{" "}
                no valor de{" "}
                <span className="font-semibold text-foreground">
                  {deletingTransaction && formatCurrency(deletingTransaction.amount)}
                </span>
                ?
              </p>
              {deletingTransaction?.recurrence_group_id && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Esta despesa faz parte de uma série/parcelamento.</p>
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

      <CategoriasDialog open={openCategorias} onOpenChange={setOpenCategorias} />
    </div>
  );
}
