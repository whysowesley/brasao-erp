import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Eye,
  MessageSquare,
  QrCode,
  Copy,
  Layers,
  Tag,
  Palette,
  FolderPlus,
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
  useCostCenters,
  useFinancialCategories,
  useMoveFinancialTransactionDay,
  useDeleteFinancialTransaction,
  useReversePayment,
  useBatchUpdateTransactionOrder,
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
  CostCenter,
  FinancialCategory,
  HighlightColor,
} from "@/lib/financeiro-types";
import { LancamentoDialog } from "./LancamentoDialog";
import { MarcarPagoDialog } from "./MarcarPagoDialog";
import { TransactionPixPopover } from "./TransactionPixPopover";
import { TransactionObservationDialog } from "./TransactionObservationDialog";
import { TransactionCommentsDialog } from "./TransactionCommentsDialog";
import { BankBalancesBar } from "./BankBalancesBar";
import { MentionsNotificationPopup } from "./MentionsNotificationPopup";
import { CategoriasDialog } from "./CategoriasDialog";
import { QuadrantesThemeDialog } from "./QuadrantesThemeDialog";
import { useAllDailyBankBalances, calculateRollingBalances } from "@/lib/bank-balances";
import { useQuadrantesTheme } from "@/lib/theme-manager";

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

/** Identifica se uma transação pertence ao Centro de Custo, Categoria ou Lançamento de "Avulso ISA" */
export function matchesAvulsoIsa(
  tx: FinancialTransaction,
  costCenters: CostCenter[] = [],
  categories: FinancialCategory[] = [],
): boolean {
  const ccName = (
    tx.cost_center?.name ||
    costCenters.find((c) => c.id === tx.cost_center_id)?.name ||
    ""
  )
    .toLowerCase()
    .trim();

  const catName = (tx.category?.name || categories.find((c) => c.id === tx.category_id)?.name || "")
    .toLowerCase()
    .trim();

  const supName = (tx.supplier_name || "").toLowerCase().trim();
  const desc = (tx.description || "").toLowerCase().trim();
  const notes = (tx.notes || "").toLowerCase().trim();

  // Verifica centro de custo
  if (ccName.includes("isa") || (ccName.includes("avulso") && ccName.includes("isa"))) {
    return true;
  }
  // Verifica categoria
  if (catName.includes("isa") || (catName.includes("avulso") && catName.includes("isa"))) {
    return true;
  }
  // Verifica fornecedor, descrição ou observações
  if (
    desc.includes("avulso isa") ||
    desc.includes("avulsos isa") ||
    notes.includes("avulso isa") ||
    notes.includes("avulsos isa") ||
    supName.includes("avulso isa") ||
    supName.includes("avulsos isa") ||
    supName === "isa" ||
    supName.startsWith("isa ")
  ) {
    return true;
  }

  return false;
}

export type QuadrantSortOption =
  | "manual"
  | "valor_desc"
  | "valor_asc"
  | "alfabetico_asc"
  | "alfabetico_desc"
  | "vencimento"
  | "emissao"
  | "pendentes_primeiro";

export const SORT_LABELS: Record<QuadrantSortOption, string> = {
  manual: "Manual (Livre)",
  valor_desc: "Maior Valor (R$)",
  valor_asc: "Menor Valor (R$)",
  alfabetico_asc: "Fornecedor (A-Z)",
  alfabetico_desc: "Fornecedor (Z-A)",
  vencimento: "Data de Vencimento",
  emissao: "Data de Emissão",
  pendentes_primeiro: "Pendentes Primeiro",
};

interface QuadrantesVencimentoViewProps {
  initialDate?: Date;
  onOpenCreate?: (defaultDate?: string) => void;
}

export function QuadrantesVencimentoView({
  initialDate = new Date(),
  onOpenCreate,
}: QuadrantesVencimentoViewProps) {
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = getTodayString();

  // Mês selecionado
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate);
  const [openCategorias, setOpenCategorias] = useState(false);
  const [openQuadranteThemeDialog, setOpenQuadranteThemeDialog] = useState(false);
  const { themeConfig: quadranteTheme } = useQuadrantesTheme();

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendentes" | "pagos">("todos");
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");
  // Filtro de Escopo pré-fixado como "exceto_avulso_isa" por padrão conforme solicitado
  const [scopeFilter, setScopeFilter] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("financeiro_quadrantes_scope_filter");
      if (saved) return saved;
    } catch {
      // ignore
    }
    return "exceto_avulso_isa";
  });

  const handleScopeFilterChange = (val: string) => {
    setScopeFilter(val);
    try {
      localStorage.setItem("financeiro_quadrantes_scope_filter", val);
    } catch {
      // ignore
    }
  };
  const [dateCriterion, setDateCriterion] = useState<"expected_or_due" | "due_only">(
    "expected_or_due",
  );
  const [showEmptyDays, setShowEmptyDays] = useState<boolean>(false);

  // Estado de Arrastar e Soltar (Drag & Drop com suporte interno e entre dias)
  const [draggedTx, setDraggedTx] = useState<FinancialTransaction | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"above" | "below" | null>(null);

  // Ordenação interna configurável por quadrante
  const [quadrantSort, setQuadrantSort] = useState<Record<string, QuadrantSortOption>>({});

  // Modais de Edição / Pagamento / Detalhes
  const [lancamentoDialogOpen, setLancamentoDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [customDefaultDate, setCustomDefaultDate] = useState<string | undefined>(undefined);
  const [observationTransaction, setObservationTransaction] = useState<FinancialTransaction | null>(
    null,
  );
  const [commentsTransaction, setCommentsTransaction] = useState<FinancialTransaction | null>(null);

  // Queries
  const { balancesMap: allDailyBankBalancesMap } = useAllDailyBankBalances();
  const { data: suppliers = [] } = useSuppliers();
  const { data: costCenters = [] } = useCostCenters();
  const { data: financialCategories = [] } = useFinancialCategories();
  const { data: allTransactions = [], isLoading } = useFinancialTransactions({
    type: "despesa", // Focado em contas a pagar e fornecedores
  });

  // Transações atualizadas para os modais (reativo ao cache/Firestore)
  const currentObservationTx = useMemo(
    () =>
      observationTransaction
        ? allTransactions.find((t) => t.id === observationTransaction.id) || observationTransaction
        : null,
    [allTransactions, observationTransaction],
  );
  const currentCommentsTx = useMemo(
    () =>
      commentsTransaction
        ? allTransactions.find((t) => t.id === commentsTransaction.id) || commentsTransaction
        : null,
    [allTransactions, commentsTransaction],
  );

  // Mutações
  const moveDayMutation = useMoveFinancialTransactionDay();
  const deleteMutation = useDeleteFinancialTransaction();
  const reverseMutation = useReversePayment();
  const batchUpdateOrderMutation = useBatchUpdateTransactionOrder();
  const updateMutation = useUpdateFinancialTransaction();

  const handleQuickHighlight = async (tx: FinancialTransaction, color: HighlightColor) => {
    if (!canWrite) return;
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
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

  const handleToggleNew = async (tx: FinancialTransaction) => {
    if (!canWrite) return;
    const currentIsNew = isTransactionNew(tx);
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
        is_new: !currentIsNew,
      });
      toast.success(!currentIsNew ? "Marcado com tag Novo!" : "Tag Novo removida.");
    } catch {
      toast.error("Erro ao atualizar tag Novo.");
    }
  };

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
  const getTxTargetDate = useCallback(
    (tx: FinancialTransaction): string => {
      if (dateCriterion === "expected_or_due") {
        return tx.expected_payment_date || tx.due_date;
      }
      return tx.due_date;
    },
    [dateCriterion],
  );

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

      // Filtro de Escopo / Centros de Custo (Pré-fixado Exceto Avulsos ISA)
      if (scopeFilter === "exceto_avulso_isa") {
        if (matchesAvulsoIsa(tx, costCenters, financialCategories)) return;
      } else if (scopeFilter === "somente_avulso_isa") {
        if (!matchesAvulsoIsa(tx, costCenters, financialCategories)) return;
      } else if (scopeFilter === "fornecedores") {
        const isSupplier =
          (tx.supplier_id != null && tx.supplier_id !== "" && tx.supplier_id !== "none") ||
          (tx.supplier_name != null && tx.supplier_name.trim() !== "") ||
          (tx.supplier?.name != null && tx.supplier.name.trim() !== "") ||
          (tx.cost_center?.name || "").toLowerCase().includes("fornecedor");
        if (!isSupplier) return;
      } else if (scopeFilter.startsWith("cc_")) {
        const targetCcId = scopeFilter.replace("cc_", "");
        const targetCc = costCenters.find((c) => c.id === targetCcId);
        const targetName = targetCc?.name?.toLowerCase().trim() || "";
        const txCcName = (
          tx.cost_center?.name ||
          costCenters.find((c) => c.id === tx.cost_center_id)?.name ||
          (tx as unknown as { cost_center_name?: string }).cost_center_name ||
          ""
        )
          .toLowerCase()
          .trim();
        const matchesId = tx.cost_center_id === targetCcId || tx.cost_center?.id === targetCcId;
        const matchesName = targetName !== "" && txCcName === targetName;
        if (!matchesId && !matchesName) return;
      } else if (scopeFilter.startsWith("cat_")) {
        const targetCatId = scopeFilter.replace("cat_", "");
        const targetCat = financialCategories.find((c) => c.id === targetCatId);
        const targetName = targetCat?.name?.toLowerCase().trim() || "";
        const txCatName = (
          tx.category?.name ||
          financialCategories.find((c) => c.id === tx.category_id)?.name ||
          (tx as unknown as { category_name?: string }).category_name ||
          ""
        )
          .toLowerCase()
          .trim();
        const matchesId = tx.category_id === targetCatId || tx.category?.id === targetCatId;
        const matchesName = targetName !== "" && txCatName === targetName;
        if (!matchesId && !matchesName) return;
      }

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

    // Ordena cada dia conforme o filtro do quadrante (ou manual por padrão)
    map.forEach((items, key) => {
      const sortOpt = quadrantSort[key] || "manual";
      items.sort((a, b) => {
        switch (sortOpt) {
          case "valor_desc":
            return b.amount - a.amount;
          case "valor_asc":
            return a.amount - b.amount;
          case "alfabetico_asc":
            return (a.supplier_name || a.description || "").localeCompare(
              b.supplier_name || b.description || "",
            );
          case "alfabetico_desc":
            return (b.supplier_name || b.description || "").localeCompare(
              a.supplier_name || a.description || "",
            );
          case "vencimento":
            return (a.due_date || "").localeCompare(b.due_date || "");
          case "emissao":
            return (b.issue_date || "").localeCompare(a.issue_date || "");
          case "pendentes_primeiro":
            if (a.status !== "pago" && b.status === "pago") return -1;
            if (a.status === "pago" && b.status !== "pago") return 1;
            return (a.order_index ?? 9999) - (b.order_index ?? 9999);
          case "manual":
          default: {
            const orderA = typeof a.order_index === "number" ? a.order_index : 999999;
            const orderB = typeof b.order_index === "number" ? b.order_index : 999999;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            if (a.status !== "pago" && b.status === "pago") return -1;
            if (a.status === "pago" && b.status !== "pago") return 1;
            return (a.supplier_name || a.description || "").localeCompare(
              b.supplier_name || b.description || "",
            );
          }
        }
      });
    });

    return map;
  }, [
    mappedTransactions,
    monthDays,
    getTxTargetDate,
    searchTerm,
    supplierFilter,
    statusFilter,
    scopeFilter,
    costCenters,
    financialCategories,
    currentMonthDate,
    quadrantSort,
  ]);

  // Estatísticas de Avulsos ISA no mês
  const avulsosStats = useMemo(() => {
    const list = mappedTransactions.filter((tx) =>
      matchesAvulsoIsa(tx, costCenters, financialCategories),
    );
    const total = list.reduce((acc, curr) => acc + curr.amount, 0);
    return { count: list.length, total };
  }, [mappedTransactions, costCenters, financialCategories]);

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

  // Datas ordenadas de todos os dias do mês
  const sortedMonthDateKeys = useMemo(() => {
    return monthDays.map((d) => format(d, "yyyy-MM-dd")).sort();
  }, [monthDays]);

  // Total das contas a pagar lançadas por dia
  const dayBillsMap = useMemo(() => {
    const map: Record<string, number> = {};
    groupedByDay.forEach((items, dayKey) => {
      map[dayKey] = items.reduce((acc, curr) => acc + curr.amount, 0);
    });
    return map;
  }, [groupedByDay]);

  // Saldos bancários rolantes calculados dinamicamente:
  // - Restante do dia anterior vai para a flag SALDO do dia seguinte;
  // - As contas começam zeradas para abastecimento manual;
  // - Se uma conta for adicionada/corrigida no dia anterior, o saldo do dia seguinte atualiza automaticamente.
  const rollingBalancesMap = useMemo(() => {
    return calculateRollingBalances(sortedMonthDateKeys, dayBillsMap, allDailyBankBalancesMap);
  }, [sortedMonthDateKeys, dayBillsMap, allDailyBankBalancesMap]);

  // Manipulação de Drag & Drop (com suporte interno no quadrante e entre dias)
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

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDay(null);
    }
  };

  const handleRowDragOver = (
    e: React.DragEvent,
    targetTx: FinancialTransaction,
    dayKey: string,
  ) => {
    if (!draggedTx || draggedTx.id === targetTx.id) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isAbove = offsetY < rect.height / 2;

    setDragOverDay(dayKey);
    setDragOverRowId(targetTx.id);
    setDragOverPosition(isAbove ? "above" : "below");
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverRowId(null);
      setDragOverPosition(null);
    }
  };

  // Mover item para cima ou para baixo com 1 clique (▲ / ▼)
  const handleMoveItemUpDown = async (
    tx: FinancialTransaction,
    dayKey: string,
    direction: "up" | "down",
  ) => {
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar ou reordenar lançamentos.");
      return;
    }
    const currentDayItems = groupedByDay.get(dayKey) || [];
    const currentIndex = currentDayItems.findIndex((i) => i.id === tx.id);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= currentDayItems.length) return;

    const reordered = [...currentDayItems];
    const [removed] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, removed);

    // Força ordenação manual neste quadrante
    setQuadrantSort((prev) => ({ ...prev, [dayKey]: "manual" }));

    // Atualização otimista imediata no cache do React Query
    queryClient.setQueriesData({ queryKey: ["financial_transactions"] }, (old: unknown) => {
      if (!Array.isArray(old)) return old;
      const orderMap = new Map<string, number>();
      reordered.forEach((item, idx) => orderMap.set(item.id, idx));
      return old.map((t: FinancialTransaction) =>
        orderMap.has(t.id) ? { ...t, order_index: orderMap.get(t.id)! } : t,
      );
    });

    try {
      await batchUpdateOrderMutation.mutateAsync(
        reordered.map((item, index) => ({ id: item.id, order_index: index })),
      );
      toast.success(direction === "up" ? "Linha movida para cima!" : "Linha movida para baixo!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao reordenar.";
      toast.error(msg);
    }
  };

  // Soltar diretamente em cima de uma linha específica (reordenação interna)
  const handleRowDrop = async (
    e: React.DragEvent,
    targetTx: FinancialTransaction,
    targetDay: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const dropPosition = dragOverPosition || "below";
    setDragOverRowId(null);
    setDragOverPosition(null);
    setDragOverDay(null);

    if (!draggedTx) return;
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar ou reordenar lançamentos.");
      return;
    }

    if (draggedTx.id === targetTx.id) {
      setDraggedTx(null);
      return;
    }

    const sourceDay = getTxTargetDate(draggedTx);
    const isSameDay = sourceDay === targetDay;
    const currentDayItems = groupedByDay.get(targetDay) || [];

    // Remove o item arrastado da lista atual
    const filtered = currentDayItems.filter((item) => item.id !== draggedTx.id);
    const targetIndex = filtered.findIndex((item) => item.id === targetTx.id);
    const insertIndex =
      targetIndex === -1
        ? filtered.length
        : dropPosition === "below"
          ? targetIndex + 1
          : targetIndex;

    const updatedTx: FinancialTransaction = {
      ...draggedTx,
      due_date: dateCriterion === "due_only" ? targetDay : draggedTx.due_date,
      expected_payment_date:
        dateCriterion === "expected_or_due" ? targetDay : draggedTx.expected_payment_date,
    };

    const reorderedList = [
      ...filtered.slice(0, insertIndex),
      updatedTx,
      ...filtered.slice(insertIndex),
    ];

    // Força a ordenação manual naquele quadrante para preservar a posição escolhida pelo usuário
    setQuadrantSort((prev) => ({ ...prev, [targetDay]: "manual" }));

    // Atualização otimista imediata no cache
    queryClient.setQueriesData({ queryKey: ["financial_transactions"] }, (old: unknown) => {
      if (!Array.isArray(old)) return old;
      const orderMap = new Map<string, number>();
      reorderedList.forEach((item, index) => orderMap.set(item.id, index));
      return old.map((item: FinancialTransaction) => {
        if (orderMap.has(item.id)) {
          const newOrder = orderMap.get(item.id)!;
          if (!isSameDay && item.id === draggedTx.id) {
            return {
              ...item,
              order_index: newOrder,
              expected_payment_date:
                dateCriterion === "expected_or_due" ? targetDay : item.expected_payment_date,
              due_date: dateCriterion === "due_only" ? targetDay : item.due_date,
            };
          }
          return { ...item, order_index: newOrder };
        }
        return item;
      });
    });

    try {
      await batchUpdateOrderMutation.mutateAsync(
        reorderedList.map((item, index) => ({
          id: item.id,
          order_index: index,
          targetDate: !isSameDay && item.id === draggedTx.id ? targetDay : undefined,
        })),
      );

      if (isSameDay) {
        toast.success("Ordem interna do quadrante atualizada com sucesso!");
      } else {
        const targetDateBr = formatDateBr(targetDay);
        toast.success(
          `${draggedTx.supplier_name || "Lançamento"} movido para ${targetDateBr} na posição indicada!`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao reordenar.";
      toast.error(msg);
    } finally {
      setDraggedTx(null);
    }
  };

  // Soltar no quadrante (fundo do quadrante)
  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDay(null);
    setDragOverRowId(null);
    setDragOverPosition(null);

    if (!draggedTx) return;
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar datas.");
      return;
    }

    const sourceDate = getTxTargetDate(draggedTx);

    // Se for no mesmo quadrante e soltou no fundo: move para o final
    if (sourceDate === targetDate) {
      const currentDayItems = groupedByDay.get(targetDate) || [];
      if (currentDayItems.length <= 1) {
        setDraggedTx(null);
        return;
      }

      const filtered = currentDayItems.filter((i) => i.id !== draggedTx.id);
      const reordered = [...filtered, draggedTx];
      setQuadrantSort((prev) => ({ ...prev, [targetDate]: "manual" }));

      // Atualização otimista imediata
      queryClient.setQueriesData({ queryKey: ["financial_transactions"] }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        const orderMap = new Map<string, number>();
        reordered.forEach((item, idx) => orderMap.set(item.id, idx));
        return old.map((t: FinancialTransaction) =>
          orderMap.has(t.id) ? { ...t, order_index: orderMap.get(t.id)! } : t,
        );
      });

      try {
        await batchUpdateOrderMutation.mutateAsync(
          reordered.map((item, index) => ({ id: item.id, order_index: index })),
        );
        toast.success("Linha movida para o final do dia!");
      } catch {
        // silencioso
      } finally {
        setDraggedTx(null);
      }
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

            <MentionsNotificationPopup variant="trigger" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenQuadranteThemeDialog(true)}
              className="gap-1.5 h-9"
              title="Personalizar cor dos quadrantes (Vinho, Dourado, Azul, etc.)"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/20 shrink-0 shadow-xs"
                style={{ backgroundColor: quadranteTheme.previewBg }}
              />
              <span className="hidden sm:inline">Cor dos Quadrantes</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCategorias(true)}
              className="gap-1.5 h-9"
              title="Configurações Financeiras: Categorias, Centros de Custo e Formas de Pagamento"
            >
              <FolderPlus className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>

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

        {/* Linha de Filtros de Escopo / Centros de Custo (Pré-fixado: Exceto Avulsos ISA) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Filtrar Contas:
            </span>

            {/* Botão Pré-fixado Padrão */}
            <button
              type="button"
              onClick={() => handleScopeFilterChange("exceto_avulso_isa")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                scopeFilter === "exceto_avulso_isa"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background hover:bg-muted text-muted-foreground border-border/80"
              }`}
            >
              Exceto Avulsos ISA (Padrão)
            </button>

            <button
              type="button"
              onClick={() => handleScopeFilterChange("todos")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                scopeFilter === "todos"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background hover:bg-muted text-muted-foreground border-border/80"
              }`}
            >
              Ver Tudo
            </button>

            <button
              type="button"
              onClick={() => handleScopeFilterChange("somente_avulso_isa")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                scopeFilter === "somente_avulso_isa"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-background hover:bg-muted text-muted-foreground border-border/80"
              }`}
            >
              Apenas Avulsos ISA
              {avulsosStats.count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
                  {avulsosStats.count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleScopeFilterChange("fornecedores")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                scopeFilter === "fornecedores"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background hover:bg-muted text-muted-foreground border-border/80"
              }`}
            >
              Fornecedores
            </button>

            {/* Dropdown com todos os Centros de Custo e Categorias criados */}
            <Select value={scopeFilter} onValueChange={handleScopeFilterChange}>
              <SelectTrigger className="w-[200px] h-7 text-xs bg-background border-border/80 font-medium">
                <SelectValue placeholder="Centro de Custo / Mais..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exceto_avulso_isa">Exceto Avulsos ISA (Padrão)</SelectItem>
                <SelectItem value="todos">Ver Tudo (Todas as Contas)</SelectItem>
                <SelectItem value="somente_avulso_isa">Apenas Avulsos ISA</SelectItem>
                <SelectItem value="fornecedores">Apenas Fornecedores</SelectItem>

                {costCenters.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-1">
                      Centros de Custo
                    </div>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={`cc_${cc.id}`}>
                        {cc.name}
                      </SelectItem>
                    ))}
                  </>
                )}

                {financialCategories.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-1">
                      Categorias Financeiras
                    </div>
                    {financialCategories.map((cat) => (
                      <SelectItem key={cat.id} value={`cat_${cat.id}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {scopeFilter === "exceto_avulso_isa" && avulsosStats.count > 0 && (
            <div className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/60 flex items-center gap-1.5">
              <span>
                {avulsosStats.count} lançamento(s) de Avulso ISA oculto(s) neste mês (
                {formatCurrency(avulsosStats.total)})
              </span>
              <button
                type="button"
                onClick={() => handleScopeFilterChange("somente_avulso_isa")}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                ver avulsos
              </button>
            </div>
          )}
        </div>

        {/* Linha de Filtros e Critérios */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t text-xs">
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
                    ? quadranteTheme.dragRing
                    : isCurrentDay
                      ? `${quadranteTheme.borderHighlight} shadow-md`
                      : "border-border bg-card"
                }`}
              >
                {/* Cabeçalho do Quadrante */}
                <div
                  style={quadranteTheme.headerStyle}
                  className={`${quadranteTheme.headerBgClass} ${quadranteTheme.headerTextClass} px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 select-none transition-colors`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <CalendarClock
                      className={`h-4 w-4 ${quadranteTheme.headerSubtextClass} shrink-0`}
                    />
                    <span className="font-extrabold tracking-wide text-xs sm:text-sm">
                      {dayTitle}
                    </span>
                    {isCurrentDay && (
                      <Badge className="bg-amber-400 text-black font-bold text-[10px] uppercase hover:bg-amber-300 border-none px-2 py-0">
                        Hoje
                      </Badge>
                    )}

                    {/* 4 Opções de saldo sutis ao lado de cada nome do dia da semana (individual por dia) */}
                    <BankBalancesBar
                      date={dayKey}
                      dayPendingAmount={dayPending}
                      dayTotalAmount={dayTotal}
                      canWrite={canWrite}
                      rollingBalance={rollingBalancesMap[dayKey]}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={`text-[11px] ${quadranteTheme.headerSubtextClass} font-medium mr-1.5`}
                      >
                        Total do dia:
                      </span>
                      <span className="font-extrabold text-sm">{formatCurrency(dayTotal)}</span>
                    </div>

                    {canWrite && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddInDay(dayKey)}
                        className={`h-7 text-xs px-2.5 ${quadranteTheme.headerBtnBg} border-none font-medium`}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-faixa de Resumo do Dia e Filtro de Ordenação */}
                {items.length > 0 && (
                  <div className="bg-muted/40 border-b px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>
                        {items.length} conta(s) • {items.filter((i) => i.status !== "pago").length}{" "}
                        a vencer
                      </span>
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

                    {/* Filtro / Seletor de Ordenação Interna do Quadrante */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="hidden xl:flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuadrantSort((prev) => ({ ...prev, [dayKey]: "manual" }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                            (quadrantSort[dayKey] || "manual") === "manual"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                          }`}
                          title="Ordem manual livre: arraste ou use os botões ▲/▼ em cada linha"
                        >
                          Manual
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuadrantSort((prev) => ({ ...prev, [dayKey]: "valor_desc" }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                            quadrantSort[dayKey] === "valor_desc"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                          }`}
                          title="Ordenar do maior valor para o menor"
                        >
                          Maior Valor
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuadrantSort((prev) => ({ ...prev, [dayKey]: "alfabetico_asc" }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                            quadrantSort[dayKey] === "alfabetico_asc"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                          }`}
                          title="Ordenar alfabeticamente pelo fornecedor (A-Z)"
                        >
                          Fornecedor A-Z
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuadrantSort((prev) => ({ ...prev, [dayKey]: "vencimento" }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                            quadrantSort[dayKey] === "vencimento"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                          }`}
                          title="Ordenar por data de vencimento"
                        >
                          Vencimento
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          Ordem:
                        </span>
                        <Select
                          value={quadrantSort[dayKey] || "manual"}
                          onValueChange={(val) => {
                            setQuadrantSort((prev) => ({
                              ...prev,
                              [dayKey]: val as QuadrantSortOption,
                            }));
                            toast.info(`Ordem alterada: ${SORT_LABELS[val as QuadrantSortOption]}`);
                          }}
                        >
                          <SelectTrigger className="h-6.5 text-[11px] px-2 py-0 w-[175px] bg-background border-border/70 font-medium">
                            <SelectValue placeholder="Ordenar quadrante" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="manual">Manual (Livre / Arrastar)</SelectItem>
                            <SelectItem value="valor_desc">Maior Valor (R$)</SelectItem>
                            <SelectItem value="valor_asc">Menor Valor (R$)</SelectItem>
                            <SelectItem value="alfabetico_asc">Fornecedor (A-Z)</SelectItem>
                            <SelectItem value="alfabetico_desc">Fornecedor (Z-A)</SelectItem>
                            <SelectItem value="vencimento">Data de Vencimento</SelectItem>
                            <SelectItem value="emissao">Data de Emissão</SelectItem>
                            <SelectItem value="pendentes_primeiro">Pendentes Primeiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs text-left border-collapse min-w-[960px]">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground font-semibold border-b text-[11px]">
                          <th
                            className="w-12 px-2 py-2 text-center"
                            title="Reordenação manual (arrastar ou botões ▲/▼)"
                          >
                            #
                          </th>
                          <th
                            className="px-3 py-2 cursor-pointer hover:text-foreground select-none transition-colors"
                            onClick={() =>
                              setQuadrantSort((prev) => ({
                                ...prev,
                                [dayKey]: "emissao",
                              }))
                            }
                            title="Clique para ordenar por data de emissão"
                          >
                            <div className="flex items-center gap-1">
                              <span>Emissão</span>
                              {quadrantSort[dayKey] === "emissao" && (
                                <ArrowUpDown className="h-3 w-3 text-blue-600" />
                              )}
                            </div>
                          </th>
                          <th className="px-2 py-2 w-16">COD</th>
                          <th
                            className="px-3 py-2 min-w-[200px] cursor-pointer hover:text-foreground select-none transition-colors"
                            onClick={() =>
                              setQuadrantSort((prev) => ({
                                ...prev,
                                [dayKey]:
                                  prev[dayKey] === "alfabetico_asc"
                                    ? "alfabetico_desc"
                                    : "alfabetico_asc",
                              }))
                            }
                            title="Clique para alternar ordem alfabética A-Z / Z-A"
                          >
                            <div className="flex items-center gap-1">
                              <span>DESCRIÇÃO / FORNECEDOR</span>
                              {quadrantSort[dayKey] === "alfabetico_asc" && (
                                <span className="text-blue-600 text-[10px] font-bold">A-Z</span>
                              )}
                              {quadrantSort[dayKey] === "alfabetico_desc" && (
                                <span className="text-blue-600 text-[10px] font-bold">Z-A</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none transition-colors"
                            onClick={() =>
                              setQuadrantSort((prev) => ({
                                ...prev,
                                [dayKey]:
                                  prev[dayKey] === "valor_desc" ? "valor_asc" : "valor_desc",
                              }))
                            }
                            title="Clique para alternar Maior / Menor Valor"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Valor</span>
                              {quadrantSort[dayKey] === "valor_desc" && (
                                <span className="text-blue-600 text-[10px] font-bold">R$ ↓</span>
                              )}
                              {quadrantSort[dayKey] === "valor_asc" && (
                                <span className="text-blue-600 text-[10px] font-bold">R$ ↑</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-center cursor-pointer hover:text-foreground select-none transition-colors"
                            onClick={() =>
                              setQuadrantSort((prev) => ({
                                ...prev,
                                [dayKey]: "vencimento",
                              }))
                            }
                            title="Clique para ordenar por data de vencimento"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Vencimento</span>
                              {quadrantSort[dayKey] === "vencimento" && (
                                <ArrowUpDown className="h-3 w-3 text-blue-600" />
                              )}
                            </div>
                          </th>
                          <th className="px-3 py-2 text-center">Nova Data Pgto</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-center">Chave PIX</th>
                          <th className="px-3 py-2 text-center">Obs.</th>
                          <th className="px-3 py-2 text-center">Comentários</th>
                          <th
                            className="px-3 py-2 text-center w-12"
                            title="Liquidar / Marcar como pago"
                          >
                            Pago
                          </th>
                          <th className="px-3 py-2">Data Pgto</th>
                          <th className="px-2 py-2 text-right w-16">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {items.map((tx, itemIndex) => {
                          const isPaid = tx.status === "pago";
                          const isLate = tx.status === "atrasado";
                          const hasPostponedDate = Boolean(
                            tx.expected_payment_date && tx.expected_payment_date !== tx.due_date,
                          );
                          const commentsCount = tx.comments?.length || 0;

                          return (
                            <tr
                              key={tx.id}
                              draggable={canWrite}
                              onDragStart={(e) => handleDragStart(e, tx)}
                              onDragOver={(e) => handleRowDragOver(e, tx, dayKey)}
                              onDragLeave={handleRowDragLeave}
                              onDrop={(e) => handleRowDrop(e, tx, dayKey)}
                              className={`group hover:bg-muted/40 transition-colors ${getHighlightRowClass(
                                tx.highlight_color,
                              )} ${isPaid ? "opacity-75 bg-muted/20" : ""} ${
                                dragOverRowId === tx.id
                                  ? dragOverPosition === "above"
                                    ? "border-t-2 border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 shadow-inner"
                                    : "border-b-2 border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 shadow-inner"
                                  : ""
                              }`}
                            >
                              {/* Reorder Handle & Up/Down Arrows */}
                              <td
                                className={`px-1.5 py-2 text-center whitespace-nowrap transition-colors ${
                                  tx.highlight_color && tx.highlight_color !== "none"
                                    ? "border-l-4 " +
                                      (HIGHLIGHT_COLORS.find((c) => c.id === tx.highlight_color)
                                        ?.borderClass || "")
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  <div
                                    className="p-1 text-muted-foreground/50 group-hover:text-foreground cursor-grab active:cursor-grabbing hover:bg-muted rounded"
                                    title="Arraste para mover para cima, para baixo ou para outro dia"
                                  >
                                    <GripVertical className="h-4 w-4 mx-auto" />
                                  </div>
                                  {canWrite && items.length > 1 && (
                                    <div className="flex flex-col -space-y-0.5">
                                      <button
                                        type="button"
                                        disabled={itemIndex === 0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveItemUpDown(tx, dayKey, "up");
                                        }}
                                        className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground hover:text-blue-600 disabled:opacity-20 disabled:hover:text-muted-foreground transition-colors cursor-pointer text-[10px]"
                                        title="Mover linha para cima"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={itemIndex === items.length - 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveItemUpDown(tx, dayKey, "down");
                                        }}
                                        className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground hover:text-blue-600 disabled:opacity-20 disabled:hover:text-muted-foreground transition-colors cursor-pointer text-[10px]"
                                        title="Mover linha para baixo"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  )}
                                </div>
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground flex items-center gap-1">
                                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      {tx.supplier_name || tx.description || "Sem descrição"}
                                    </span>
                                    {isTransactionNew(tx) && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 shadow-2xs"
                                        title="Lançamento novo (adicionado recentemente)"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                                        Novo
                                      </span>
                                    )}
                                    {matchesAvulsoIsa(tx, costCenters, financialCategories) && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium"
                                      >
                                        Avulso ISA
                                      </Badge>
                                    )}
                                  </div>
                                  {tx.supplier_name && tx.description && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {tx.description}
                                    </span>
                                  )}
                                  {(() => {
                                    const ccName =
                                      tx.cost_center?.name ||
                                      costCenters.find((c) => c.id === tx.cost_center_id)?.name ||
                                      (tx as unknown as { cost_center_name?: string })
                                        .cost_center_name;
                                    return ccName ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded w-fit mt-0.5 font-medium">
                                        <Layers className="h-2.5 w-2.5 text-primary" />
                                        {ccName}
                                      </span>
                                    ) : null;
                                  })()}
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

                              {/* Chave PIX (com ação 1-clique para copiar) */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <TransactionPixPopover transaction={tx} canWrite={canWrite} />
                              </td>

                              {/* Observações com ícone de olho para visualização sem abrir edição */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setObservationTransaction(tx)}
                                  className={`h-7 px-2 text-xs gap-1.5 font-normal max-w-[160px] ${
                                    tx.notes
                                      ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                      : "text-muted-foreground/50 hover:text-muted-foreground"
                                  }`}
                                  title={
                                    tx.notes
                                      ? `Observação: ${tx.notes}`
                                      : "Clique para visualizar ou adicionar observação"
                                  }
                                >
                                  <Eye
                                    className={`h-3.5 w-3.5 shrink-0 ${
                                      tx.notes ? "text-blue-600 dark:text-blue-400" : ""
                                    }`}
                                  />
                                  <span className="truncate text-left">{tx.notes || "—"}</span>
                                </Button>
                              </td>

                              {/* Comentários & Menções (@) */}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCommentsTransaction(tx)}
                                  className={`h-7 px-2 text-xs gap-1 ${
                                    commentsCount > 0
                                      ? "text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                      : "text-muted-foreground/60 hover:text-foreground"
                                  }`}
                                  title="Ver comentários ou mencionar outros usuários (@)"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                  {commentsCount > 0 ? (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1.5 text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-none font-bold"
                                    >
                                      {commentsCount}
                                    </Badge>
                                  ) : (
                                    <span className="text-[11px] opacity-70">@</span>
                                  )}
                                </Button>
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

                                        <DropdownMenuItem
                                          onClick={() => {
                                            const baseDesc =
                                              tx.description?.trim() ||
                                              tx.supplier?.name ||
                                              tx.supplier_name ||
                                              "";
                                            setEditingTransaction({
                                              ...tx,
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
                                            setLancamentoDialogOpen(true);
                                          }}
                                        >
                                          <Copy className="h-3.5 w-3.5 mr-2" />
                                          Duplicar Lançamento
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

                                        {/* Quick Color Picker */}
                                        <div className="px-2 py-1.5 space-y-1.5">
                                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                              <Palette className="h-3 w-3" />
                                              Cor de Destaque
                                            </span>
                                            {tx.highlight_color && (
                                              <button
                                                type="button"
                                                onClick={() => handleQuickHighlight(tx, "none")}
                                                className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                                              >
                                                Limpar
                                              </button>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                                            {HIGHLIGHT_COLORS.map((c) => {
                                              const isCur = (tx.highlight_color || "none") === c.id;
                                              return (
                                                <button
                                                  key={c.id}
                                                  type="button"
                                                  onClick={() => handleQuickHighlight(tx, c.id)}
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
                                          onClick={() => handleToggleNew(tx)}
                                          className="text-xs"
                                        >
                                          <Sparkles className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                          {isTransactionNew(tx)
                                            ? "Remover tag 'Novo'"
                                            : "Marcar com tag 'Novo'"}
                                        </DropdownMenuItem>

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
        onOpenChange={(open) => {
          setLancamentoDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        transactionToEdit={editingTransaction}
        defaultType="despesa"
      />

      {/* Modal de Liquidação / Pagamento */}
      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

      {/* Modal de Observações (Ícone de Olho) */}
      <TransactionObservationDialog
        open={!!observationTransaction}
        onOpenChange={(open) => !open && setObservationTransaction(null)}
        transaction={currentObservationTx}
        canWrite={canWrite}
      />

      {/* Modal de Comentários & Menções (@) */}
      <TransactionCommentsDialog
        open={!!commentsTransaction}
        onOpenChange={(open) => !open && setCommentsTransaction(null)}
        transaction={currentCommentsTx}
        canWrite={canWrite}
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

      <CategoriasDialog open={openCategorias} onOpenChange={setOpenCategorias} />
      <QuadrantesThemeDialog
        open={openQuadranteThemeDialog}
        onOpenChange={setOpenQuadranteThemeDialog}
      />
    </div>
  );
}
