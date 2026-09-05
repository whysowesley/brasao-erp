import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GripVertical,
  CalendarDays,
  ArrowRight,
  Pencil,
  Trash2,
  Check,
  Undo2,
  DollarSign,
  Building2,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Calendar } from "@/components/ui/calendar";

import {
  useFinancialTransactions,
  useMoveFinancialTransactionDay,
  useDeleteFinancialTransaction,
  useReversePayment,
  resolveTransactionStatus,
  getTransactionDisplayTitle,
  getTodayString,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction, StatusTransacao } from "@/lib/financeiro-types";
import { LancamentoDialog } from "./LancamentoDialog";
import { MarcarPagoDialog } from "./MarcarPagoDialog";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatDateBr(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    return format(d, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    return format(d, "dd-MMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

interface QuadrantesVencimentoViewProps {
  initialDate?: Date;
  onOpenCreate?: (defaultDate?: string) => void;
}

export function QuadrantesVencimentoView({
  initialDate = new Date(),
  onOpenCreate,
}: QuadrantesVencimentoViewProps) {
  const { canWrite } = useAuth();
  const todayStr = getTodayString();

  // Mês selecionado
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendentes" | "pagos">("todos");
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");
  const [dateCriterion, setDateCriterion] = useState<"expected_or_due" | "due_only">(
    "expected_or_due",
  );
  const [showEmptyDays, setShowEmptyDays] = useState<boolean>(false);

  // Estado de Arrastar e Soltar (Drag & Drop)
  const [draggedTx, setDraggedTx] = useState<FinancialTransaction | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Modais de Edição / Pagamento
  const [lancamentoDialogOpen, setLancamentoDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [customDefaultDate, setCustomDefaultDate] = useState<string | undefined>(undefined);

  // Queries
  const { data: suppliers = [] } = useSuppliers();
  const { data: allTransactions = [], isLoading } = useFinancialTransactions({
    type: "despesa", // Focado em contas a pagar e fornecedores
  });

  // Mutações
  const moveDayMutation = useMoveFinancialTransactionDay();
  const deleteMutation = useDeleteFinancialTransaction();
  const reverseMutation = useReversePayment();

  // Dias do mês atual
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd],
  );

  // Transações mapeadas com status atualizado
  const mappedTransactions = useMemo(() => {
    return allTransactions.map((tx) => ({
      ...tx,
      resolvedStatus: resolveTransactionStatus(tx, todayStr),
    }));
  }, [allTransactions, todayStr]);

  // Função para obter a data chave de agendamento de cada transação
  const getTxTargetDate = (tx: FinancialTransaction): string => {
    if (dateCriterion === "expected_or_due") {
      return tx.expected_payment_date || tx.due_date;
    }
    return tx.due_date;
  };

  // Agrupamento vertical por data (dia 1, 2, 3...)
  const groupedByDay = useMemo(() => {
    const map = new Map<string, FinancialTransaction[]>();

    // Inicializa todos os dias do mês
    monthDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      map.set(dateKey, []);
    });

    mappedTransactions.forEach((tx) => {
      const targetDate = getTxTargetDate(tx);
      // Filtros de busca e status
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase().trim();
        const matchDesc = tx.description?.toLowerCase().includes(s);
        const matchSupplier = tx.supplier_name?.toLowerCase().includes(s);
        const matchNotes = tx.notes?.toLowerCase().includes(s);
        const matchCode = String(tx.code ?? "")
          .toLowerCase()
          .includes(s);
        if (!matchDesc && !matchSupplier && !matchNotes && !matchCode) return;
      }

      if (supplierFilter !== "todos" && tx.supplier_id !== supplierFilter) return;

      if (statusFilter === "pendentes" && tx.status === "pago") return;
      if (statusFilter === "pagos" && tx.status !== "pago") return;

      if (map.has(targetDate)) {
        map.get(targetDate)!.push(tx);
      } else {
        // Transação pode estar fora do mês ou com outra data
        const txMonth = targetDate.slice(0, 7);
        const curMonth = format(currentMonthDate, "yyyy-MM");
        if (txMonth === curMonth) {
          map.set(targetDate, [tx]);
        }
      }
    });

    // Ordena cada dia: não pagos primeiro, depois por order_index ou valor
    map.forEach((items, key) => {
      items.sort((a, b) => {
        if (
          a.order_index !== null &&
          a.order_index !== undefined &&
          b.order_index !== null &&
          b.order_index !== undefined
        ) {
          return a.order_index - b.order_index;
        }
        if (a.status === "pago" && b.status !== "pago") return 1;
        if (a.status !== "pago" && b.status === "pago") return -1;
        return (a.supplier_name || "").localeCompare(b.supplier_name || "");
      });
    });

    return map;
  }, [
    mappedTransactions,
    monthDays,
    dateCriterion,
    searchTerm,
    supplierFilter,
    statusFilter,
    currentMonthDate,
  ]);

  // Estatísticas do Mês
  const monthStats = useMemo(() => {
    let totalPagar = 0;
    let totalPago = 0;
    let totalGeral = 0;
    let countTotal = 0;
    let countPendentes = 0;

    groupedByDay.forEach((items) => {
      items.forEach((tx) => {
        totalGeral += tx.amount;
        countTotal++;
        if (tx.status === "pago") {
          totalPago += tx.paid_amount || tx.amount;
        } else {
          totalPagar += tx.amount;
          countPendentes++;
        }
      });
    });

    return { totalPagar, totalPago, totalGeral, countTotal, countPendentes };
  }, [groupedByDay]);

  // Manipulação de Drag & Drop
  const handleDragStart = (e: React.DragEvent, tx: FinancialTransaction) => {
    setDraggedTx(tx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tx.id);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== dateKey) {
      setDragOverDay(dateKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDay(null);

    if (!draggedTx) return;
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar datas.");
      return;
    }

    const sourceDate = getTxTargetDate(draggedTx);
    if (sourceDate === targetDate) {
      setDraggedTx(null);
      return;
    }

    try {
      await moveDayMutation.mutateAsync({
        id: draggedTx.id,
        targetDate,
        mode: dateCriterion === "due_only" ? "due" : "expected",
      });

      const formattedTarget = formatDateBr(targetDate);
      const supplierLabel = draggedTx.supplier_name || draggedTx.description || "Lançamento";
      toast.success(`${supplierLabel} movido para ${formattedTarget}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao mover lançamento.";
      toast.error(msg);
    } finally {
      setDraggedTx(null);
    }
  };

  // Mover via Seletor de Data
  const handleMoveToDate = async (tx: FinancialTransaction, newDate: string) => {
    if (!canWrite) {
      toast.error("Sem permissão para alterar data.");
      return;
    }
    try {
      await moveDayMutation.mutateAsync({
        id: tx.id,
        targetDate: newDate,
        mode: "expected", // Atualiza nova data de pagamento
      });
      toast.success(`Data reagendada para ${formatDateBr(newDate)}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao mover lançamento.";
      toast.error(msg);
    }
  };

  // Abrir diálogo de criação para um dia específico
  const handleAddInDay = (dayKey: string) => {
    setCustomDefaultDate(dayKey);
    setEditingTransaction(null);
    setLancamentoDialogOpen(true);
    if (onOpenCreate) {
      onOpenCreate(dayKey);
    }
  };

  // Dias a exibir (se showEmptyDays for false, esconde dias que não têm transações)
  const displayDays = useMemo(() => {
    const days: string[] = [];
    groupedByDay.forEach((items, dayKey) => {
      if (showEmptyDays || items.length > 0 || dayKey === todayStr) {
        days.push(dayKey);
      }
    });
    return days.sort();
  }, [groupedByDay, showEmptyDays, todayStr]);

  return (
    <div id="quadrantes-vencimentos-view" className="space-y-6">
      {/* Barra de Controles Superior Estilo Planilha */}
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Navegação de Mês */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonthDate((d) => subMonths(d, 1))}
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 text-sm font-semibold capitalize min-w-[150px] text-center">
                {format(currentMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonthDate((d) => addMonths(d, 1))}
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonthDate(new Date())}
              className="text-xs h-9"
            >
              Mês Atual
            </Button>
          </div>

          {/* Resumo Financeiro no Topo */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-muted-foreground block text-[11px] font-medium">
                A Pagar no Mês
              </span>
              <span className="text-amber-700 dark:text-amber-400 font-bold text-sm">
                {formatCurrency(monthStats.totalPagar)}
              </span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-muted-foreground block text-[11px] font-medium">
                Pago no Mês
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                {formatCurrency(monthStats.totalPago)}
              </span>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-muted-foreground block text-[11px] font-medium">
                Total Geral
              </span>
              <span className="text-blue-800 dark:text-blue-300 font-bold text-sm">
                {formatCurrency(monthStats.totalGeral)}
              </span>
            </div>

            {canWrite && (
              <Button
                size="sm"
                onClick={() => handleAddInDay(todayStr)}
                className="gap-1.5 h-9 bg-primary shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Nova Conta
              </Button>
            )}
          </div>
        </div>

        {/* Linha de Filtros e Critérios */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor, código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Filtro Fornecedor */}
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Status */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "todos" | "pendentes" | "pagos")}
          >
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="pendentes">A Pagar / Pendentes</SelectItem>
              <SelectItem value="pagos">Somente Pagos</SelectItem>
            </SelectContent>
          </Select>

          {/* Critério de Agrupamento de Data */}
          <Select
            value={dateCriterion}
            onValueChange={(v) => setDateCriterion(v as "expected_or_due" | "due_only")}
          >
            <SelectTrigger className="w-[220px] h-9 text-xs font-medium">
              <SelectValue placeholder="Critério de Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expected_or_due">Data Prevista / Postergada (ou Venc.)</SelectItem>
              <SelectItem value="due_only">Vencimento Original Apenas</SelectItem>
            </SelectContent>
          </Select>

          {/* Alternar exibição de dias vazios */}
          <Button
            variant={showEmptyDays ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowEmptyDays(!showEmptyDays)}
            className="text-xs h-9"
          >
            {showEmptyDays ? "Ocultar dias vazios" : "Mostrar todos os dias"}
          </Button>
        </div>

        {/* Dica de usabilidade interativa */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>Praticidade Excel:</strong> Arraste qualquer linha verticalmente para outro
              quadrante de dia para reagendar, ou clique na <strong>Nova Data Pgto</strong> para
              ajustar!
            </span>
          </div>
          <span className="hidden sm:inline text-xs font-medium">
            {monthStats.countTotal} conta(s) no mês • {monthStats.countPendentes} pendente(s)
          </span>
        </div>
      </div>

      {/* Lista Vertical de Quadrantes Dia por Dia (Descendo na Vertical) */}
      <div className="space-y-6">
        {displayDays.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground space-y-3">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="font-medium text-sm">
              Nenhum lançamento encontrado para os filtros selecionados neste mês.
            </p>
            <Button variant="outline" size="sm" onClick={() => handleAddInDay(todayStr)}>
              <Plus className="h-4 w-4 mr-1" />
              Lançar Conta em {formatDateBr(todayStr)}
            </Button>
          </div>
        ) : (
          displayDays.map((dayKey) => {
            const items = groupedByDay.get(dayKey) || [];
            const dayDate = parseISO(dayKey);
            const isCurrentDay = isToday(dayDate);
            const isDragTarget = dragOverDay === dayKey;

            // Total do dia
            const dayTotal = items.reduce((acc, curr) => acc + curr.amount, 0);
            const dayPaid = items
              .filter((i) => i.status === "pago")
              .reduce((acc, curr) => acc + (curr.paid_amount || curr.amount), 0);
            const dayPending = dayTotal - dayPaid;

            // Título formatado ex: "02 DE SETEMBRO - QUARTA-FEIRA"
            const dayTitle = format(dayDate, "dd 'DE' MMMM - EEEE", { locale: ptBR }).toUpperCase();

            return (
              <div
                key={dayKey}
                id={`quadrante-dia-${dayKey}`}
                onDragOver={(e) => handleDragOver(e, dayKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dayKey)}
                className={`transition-all duration-200 border rounded-xl overflow-hidden shadow-sm ${
                  isDragTarget
                    ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20"
                    : isCurrentDay
                      ? "border-blue-300 dark:border-blue-700/60 shadow-md"
                      : "border-border bg-card"
                }`}
              >
                {/* Cabeçalho do Quadrante - Azul Real Sólido com Texto em Caixa Alta Conforme Modelo */}
                <div className="bg-[#0047AB] dark:bg-[#1E3A8A] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 select-none">
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="h-4 w-4 text-blue-200" />
                    <span className="font-extrabold tracking-wide text-xs sm:text-sm text-white">
                      {dayTitle}
                    </span>
                    {isCurrentDay && (
                      <Badge className="bg-amber-400 text-black font-bold text-[10px] uppercase hover:bg-amber-300 border-none px-2 py-0">
                        Hoje
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-blue-200 font-medium mr-1.5">
                        Total do dia:
                      </span>
                      <span className="font-extrabold text-sm text-white">
                        {formatCurrency(dayTotal)}
                      </span>
                    </div>

                    {canWrite && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddInDay(dayKey)}
                        className="h-7 text-xs px-2.5 bg-white/20 hover:bg-white/30 text-white border-none font-medium"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-faixa de Resumo do Dia se houver itens */}
                {items.length > 0 && (
                  <div className="bg-muted/40 border-b px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {items.length} conta(s) • {items.filter((i) => i.status !== "pago").length} a
                      vencer
                    </span>
                    <div className="flex items-center gap-3">
                      {dayPending > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Pendente: {formatCurrency(dayPending)}
                        </span>
                      )}
                      {dayPaid > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Pago: {formatCurrency(dayPaid)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Conteúdo da Tabela do Quadrante */}
                {items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10">
                    Nenhum compromisso financeiro para este dia. Arraste uma linha até aqui ou
                    clique em{" "}
                    <button
                      type="button"
                      onClick={() => handleAddInDay(dayKey)}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Adicionar
                    </button>
                    .
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground font-semibold border-b text-[11px]">
                          <th className="w-8 px-2 py-2 text-center">#</th>
                          <th className="px-3 py-2">Emissão</th>
                          <th className="px-2 py-2 w-16">COD</th>
                          <th className="px-3 py-2 min-w-[200px]">DESCRIÇÃO / FORNECEDOR</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-center">Vencimento</th>
                          <th className="px-3 py-2 text-center">Nova Data Pgto</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th
                            className="px-3 py-2 text-center w-12"
                            title="Liquidar / Marcar como pago"
                          >
                            Pago
                          </th>
                          <th className="px-3 py-2">Data Pgto</th>
                          <th className="px-3 py-2">Observações</th>
                          <th className="px-2 py-2 text-right w-16">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {items.map((tx) => {
                          const isPaid = tx.status === "pago";
                          const isLate = tx.status === "atrasado";
                          const hasPostponedDate = Boolean(
                            tx.expected_payment_date && tx.expected_payment_date !== tx.due_date,
                          );

                          return (
                            <tr
                              key={tx.id}
                              draggable={canWrite}
                              onDragStart={(e) => handleDragStart(e, tx)}
                              className={`group hover:bg-muted/40 transition-colors ${
                                isPaid ? "opacity-75 bg-muted/20" : ""
                              }`}
                            >
                              {/* Drag Handle */}
                              <td className="px-2 py-2 text-center text-muted-foreground/50 group-hover:text-foreground cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-4 w-4 mx-auto" />
                              </td>

                              {/* Emissão */}
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {tx.issue_date ? formatShortDate(tx.issue_date) : "—"}
                              </td>

                              {/* COD */}
                              <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">
                                {tx.code ?? tx.id.slice(0, 4)}
                              </td>

                              {/* Descrição / Fornecedor */}
                              <td className="px-3 py-2">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    {tx.supplier_name || tx.description || "Sem descrição"}
                                  </span>
                                  {tx.supplier_name && tx.description && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {tx.description}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Valor */}
                              <td className="px-3 py-2 text-right font-bold text-foreground whitespace-nowrap">
                                {formatCurrency(tx.amount)}
                              </td>

                              {/* Vencimento Original */}
                              <td className="px-3 py-2 text-center whitespace-nowrap text-muted-foreground">
                                {formatDateBr(tx.due_date)}
                              </td>

                              {/* Nova Data Pgto (Postergada / Previsão) com seletor rápido */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 text-xs px-2 font-medium ${
                                        hasPostponedDate
                                          ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                      title="Clique para alterar a data postergada desta conta"
                                    >
                                      <CalendarIcon className="h-3 w-3 mr-1" />
                                      {tx.expected_payment_date
                                        ? formatDateBr(tx.expected_payment_date)
                                        : "—"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-3" align="center">
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold">
                                        Reagendar / Postergada:
                                      </p>
                                      <Calendar
                                        mode="single"
                                        selected={
                                          tx.expected_payment_date
                                            ? parseISO(tx.expected_payment_date)
                                            : parseISO(tx.due_date)
                                        }
                                        onSelect={(newDate) => {
                                          if (newDate) {
                                            handleMoveToDate(tx, format(newDate, "yyyy-MM-dd"));
                                          }
                                        }}
                                        initialFocus
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </td>

                              {/* Status Badge */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                {isPaid ? (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2 py-0.5 uppercase border-none">
                                    PAGO
                                  </Badge>
                                ) : isLate ? (
                                  <Badge
                                    variant="destructive"
                                    className="font-semibold text-[10px] px-2 py-0.5 uppercase"
                                  >
                                    ATRASADO
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-semibold text-[10px] px-2 py-0.5 uppercase border-none"
                                  >
                                    PENDENTE
                                  </Badge>
                                )}
                              </td>

                              {/* Liquidação Checkbox Quadrada Estilo Planilha */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <Checkbox
                                  checked={isPaid}
                                  disabled={!canWrite}
                                  onCheckedChange={() => {
                                    if (isPaid) {
                                      // Reverter pagamento
                                      reverseMutation.mutate(tx.id, {
                                        onSuccess: () =>
                                          toast.success("Pagamento estornado com sucesso!"),
                                      });
                                    } else {
                                      // Abrir modal de pagamento com valores
                                      setPayingTransaction(tx);
                                    }
                                  }}
                                  className="h-4 w-4 rounded data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                  title={isPaid ? "Desmarcar pagamento" : "Marcar como pago"}
                                />
                              </td>

                              {/* Data Efetiva de Pagamento */}
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {tx.payment_date ? formatDateBr(tx.payment_date) : "—"}
                              </td>

                              {/* Observações */}
                              <td
                                className="px-3 py-2 text-muted-foreground max-w-[180px] truncate"
                                title={tx.notes || ""}
                              >
                                {tx.notes || "—"}
                              </td>

                              {/* Menu de Ações */}
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground"
                                    >
                                      •••
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Ações da Linha</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {canWrite && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setEditingTransaction(tx);
                                            setLancamentoDialogOpen(true);
                                          }}
                                        >
                                          <Pencil className="h-3.5 w-3.5 mr-2" />
                                          Editar Conta
                                        </DropdownMenuItem>

                                        {!isPaid && (
                                          <DropdownMenuItem
                                            onClick={() => setPayingTransaction(tx)}
                                          >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                            Liquidar (Marcar Pago)
                                          </DropdownMenuItem>
                                        )}

                                        {isPaid && (
                                          <DropdownMenuItem
                                            onClick={() => {
                                              reverseMutation.mutate(tx.id, {
                                                onSuccess: () =>
                                                  toast.success("Pagamento estornado!"),
                                              });
                                            }}
                                          >
                                            <Undo2 className="h-3.5 w-3.5 mr-2 text-amber-600" />
                                            Estornar Pagamento
                                          </DropdownMenuItem>
                                        )}

                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setDeletingTransaction(tx)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Lançamento / Edição */}
      <LancamentoDialog
        open={lancamentoDialogOpen}
        onOpenChange={setLancamentoDialogOpen}
        transactionToEdit={editingTransaction}
        defaultType="despesa"
      />

      {/* Modal de Liquidação / Pagamento */}
      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta de{" "}
              <strong>
                {deletingTransaction?.supplier_name || deletingTransaction?.description}
              </strong>{" "}
              no valor de{" "}
              <strong>{deletingTransaction && formatCurrency(deletingTransaction.amount)}</strong>?
              Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (deletingTransaction) {
                  try {
                    await deleteMutation.mutateAsync({ id: deletingTransaction.id });
                    toast.success("Conta excluída com sucesso.");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : "Erro ao excluir.";
                    toast.error(msg);
                  } finally {
                    setDeletingTransaction(null);
                  }
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
