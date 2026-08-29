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
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { LancamentoDialog } from "@/components/financeiro/LancamentoDialog";
import { MarcarPagoDialog } from "@/components/financeiro/MarcarPagoDialog";
import { CategoriasDialog } from "@/components/financeiro/CategoriasDialog";
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

import {
  useFinancialTransactions,
  useFinancialCategories,
  useCostCenters,
  usePaymentMethods,
  useDeleteFinancialTransaction,
  useReversePayment,
  resolveTransactionStatus,
  getTransactionDisplayTitle,
  getTodayString,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction, StatusTransacao, TipoTransacao } from "@/lib/financeiro-types";

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

  // Período
  const [periodPreset, setPeriodPreset] = useState<string>("mes_atual");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Modais
  const [openLancamento, setOpenLancamento] = useState(false);
  const [openCategorias, setOpenCategorias] = useState(false);
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
    // Abre o modal preenchendo os dados porém sem ID para criar novo
    setEditingTransaction({
      ...t,
      id: "",
      description: `${t.description} (Cópia)`,
      status: "pendente",
      payment_date: null,
      paid_amount: null,
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                    Nenhum lançamento financeiro encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => {
                  const status = resolveTransactionStatus(t.status, t.due_date, today);
                  const isReceita = t.type === "receita";
                  const isPago = status === "pago";

                  return (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      {/* Vencimento */}
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

                      {/* Descrição & Detalhes */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{getTransactionDisplayTitle(t)}</span>
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
                        {t.category ? (
                          <span className="font-medium text-foreground">{t.category.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Centro de Custo */}
                      <TableCell className="text-xs text-muted-foreground">
                        {t.cost_center?.name || "—"}
                      </TableCell>

                      {/* Fornecedor */}
                      <TableCell className="text-xs text-muted-foreground">
                        {t.supplier?.name || t.supplier_name || "—"}
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
        onOpenChange={setOpenLancamento}
        transactionToEdit={editingTransaction}
      />

      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

      <CategoriasDialog open={openCategorias} onOpenChange={setOpenCategorias} />

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
