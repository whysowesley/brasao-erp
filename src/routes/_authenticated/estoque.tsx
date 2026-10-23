import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Calendar,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  LayoutGrid,
  Table as TableIcon,
  Check,
  RefreshCw,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { ProductDialog } from "@/components/ProductDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppStockImportDialog } from "@/components/WhatsAppStockImportDialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  applyMovement,
  deleteProduct,
  toggleProductActive,
  updateProductConsumption,
  useCategories,
  useInvalidateAll,
  useProducts,
  useRules,
  useSuppliers,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import {
  formatQty,
  futureStatusFor,
  computeProduct,
  DEFAULT_RULES,
  DAYS_OF_WEEK,
  getDayOfWeekFromDate,
  getRemainingDaysLabel,
  type ComputedProduct,
  type DayOfWeek,
} from "@/lib/inventory";
import { usePostOperationMode } from "@/lib/post-operation";
import { usePurchasePlan } from "@/lib/purchase-plan";
import { cn } from "@/lib/utils";

function EstoqueErrorFallback({ error, reset }: { error?: Error; reset: () => void }) {
  const handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem("brasao:purchase-plan-v2");
      localStorage.removeItem("brasao:purchase-plan");
      localStorage.removeItem("brasao:estoque-viewmode");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-lg py-16 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">Não foi possível carregar os produtos do estoque</h2>
      <p className="text-sm text-muted-foreground">
        Houve uma oscilação na conexão com a internet ou banco de dados.
      </p>
      {error?.message && (
        <div className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded max-w-md mx-auto break-words">
          {error.message}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button onClick={() => reset()} variant="outline">
          Tentar novamente
        </Button>
        <Button onClick={handleClearCacheAndReload} variant="secondary">
          Recarregar dados
        </Button>
        <Button asChild>
          <Link to="/">Ir para o Início</Link>
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Controle de Estoque | Brasão" },
      {
        name: "description",
        content:
          "Tabela completa de estoque da Brasão com consumo semanal, compra sugerida, estoque futuro e status automático.",
      },
      { property: "og:title", content: "Controle de Estoque | Brasão" },
      {
        property: "og:description",
        content: "Pesquise, filtre e edite rapidamente os produtos do estoque.",
      },
    ],
  }),
  component: EstoquePage,
  errorComponent: EstoqueErrorFallback,
});

type SortKey =
  | "description"
  | "current_stock"
  | "unit"
  | "supplierName"
  | "avg_weekly_consumption"
  | "suggestedPurchase"
  | "futureStock"
  | "status";

const statusOrder = { critico: 0, atencao: 1, normal: 2 } as const;

function QuickNumericInput({
  value,
  onSave,
  className,
  placeholder,
  ariaLabel,
}: {
  value: number | string;
  onSave: (val: string) => Promise<void> | void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? "0"));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalValue(String(value ?? "0"));
  }, [value]);

  const handleCommit = async () => {
    const cleanLocal = localValue.trim().replace(",", ".");
    const currentStr = String(value ?? "0").trim();
    if (cleanLocal === currentStr) return;
    setIsSaving(true);
    try {
      await onSave(localValue);
    } catch {
      setLocalValue(currentStr);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Input
      aria-label={ariaLabel}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={isSaving}
      placeholder={placeholder}
      inputMode="decimal"
      className={`${className} ${isSaving ? "opacity-60 bg-muted/50" : ""}`}
    />
  );
}

function EstoquePage() {
  const { isCounter, canWrite } = useAuth();
  const { data: products, isLoading, isError, refetch } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useCategories();
  const { data: rules } = useRules();
  const invalidate = useInvalidateAll();

  // Referencial do dia para cálculo de ciclo (Segunda a Segunda)
  const [selectedRefDay, setSelectedRefDay] = useState<DayOfWeek | "auto">("auto");
  const todayDayOfWeek = getDayOfWeekFromDate();
  const effectiveRefDay = selectedRefDay === "auto" ? todayDayOfWeek : selectedRefDay;

  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("todos");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "description",
    dir: "asc",
  });
  const [editing, setEditing] = useState<ComputedProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Quantidade que o usuário pretende comprar — compartilhada com as outras telas. */
  const { plan: rawPlan, setPlanned, setPlannedBatch, clearPlan } = usePurchasePlan();
  const plan = useMemo(
    () => (rawPlan && typeof rawPlan === "object" && !Array.isArray(rawPlan) ? rawPlan : {}),
    [rawPlan],
  );

  // Modo de visualização: no celular (< 768px), o padrão é cartões verticais intuitivos
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    try {
      const saved = window.localStorage.getItem("brasao:estoque-viewmode");
      if (saved === "table" || saved === "cards") return saved;
      return window.innerWidth < 768 ? "cards" : "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    try {
      window.localStorage.setItem("brasao:estoque-viewmode", mode);
    } catch {
      // ignore
    }
  };

  // Filtro rápido de 1 toque no celular
  const [quickFilter, setQuickFilter] = useState<
    "todos" | "sugestoes" | "criticos" | "planejados" | "inativos" | "ativos"
  >("todos");

  // Flag de momento da contagem: pós-operação (fechamento, dia de hoje já usado) vs pré-operação
  const [isPostOperation, setIsPostOperation] = usePostOperationMode();

  // Recalcula o status e métricas dos produtos com base no dia referencial e momento da contagem
  const recomputedProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    const effectiveRules = rules || DEFAULT_RULES;
    return products.map((p) =>
      computeProduct(p, effectiveRules, 0, effectiveRefDay, isPostOperation),
    );
  }, [products, rules, effectiveRefDay, isPostOperation]);

  // Se o usuário não digitou manualmente um valor em Quero Comprar, o padrão é a compra sugerida arredondada para cima.
  // Sempre arredonda para cima valores inteiros (ex: 9.8 vira 10). Se inativo, trava em 0.
  const buyQty = useCallback(
    (p: ComputedProduct) => {
      if (!p || p.active === false) return 0;
      if (plan && plan[p.id] !== undefined) {
        const val = plan[p.id];
        return typeof val === "number" && val > 0 ? Math.ceil(val) : 0;
      }
      return p.suggestedPurchase > 0 ? Math.ceil(p.suggestedPurchase) : 0;
    },
    [plan],
  );

  // O estoque futuro é o saldo residual que restará na próxima 2ª feira após o consumo do período:
  // (Estoque disponível + pedidos a caminho + quero comprar) - demanda do período.
  // Fica perto de 0 (0, 1, 2, 3, no máximo 10) quando se compra a quantidade sugerida!
  const futureWithBuy = useCallback(
    (p: ComputedProduct) => {
      if (!p) return 0;
      const incoming = Number(p.incoming) || 0;
      const buy = buyQty(p);

      let targetDemand = Number(p.targetTurnover ?? p.avg_weekly_consumption) || 0;
      let availableStock = Number(p.current_stock) || 0;

      if (p.referenceDay === "seg" && !p.isPostOperation) {
        targetDemand = Number(p.targetTurnover ?? p.avg_weekly_consumption) || 0;
        availableStock = Number(p.current_stock) || 0;
      } else if (p.referenceDay === "dom") {
        targetDemand = Number(p.targetTurnover ?? p.avg_weekly_consumption) || 0;
        availableStock =
          typeof p.projectedCycleEndStock === "number" ? p.projectedCycleEndStock : 0;
      } else {
        targetDemand = Number(p.remainingConsumption) || 0;
        availableStock = Number(p.effectiveCurrentStock ?? p.current_stock) || 0;
      }

      const residual = availableStock + incoming + buy - targetDemand;
      return Math.round((residual + Number.EPSILON) * 1000) / 1000;
    },
    [buyQty],
  );

  const applyAllSuggestions = useCallback(() => {
    if (!recomputedProducts || recomputedProducts.length === 0) return;
    const batch: Record<string, number> = {};
    let count = 0;
    for (const p of recomputedProducts) {
      if (p.active === false) continue; // Pula itens inativos / travados
      const sug = p.suggestedPurchase > 0 ? Math.ceil(p.suggestedPurchase) : 0;
      if (sug > 0) {
        batch[p.id] = sug;
        count++;
      }
    }
    if (count === 0) {
      toast.info("Nenhum produto ativo possui sugestão de compra pendente.");
      return;
    }
    setPlannedBatch(batch);
    toast.success(`${count} sugestões de compra aplicadas a 'Quero Comprar'.`);
  }, [recomputedProducts, setPlannedBatch]);

  /** Status do estoque em tempo real conforme o estoque futuro (só fica crítico se <= 0). */
  const stockStatus = useCallback(
    (p: ComputedProduct) =>
      p
        ? futureStatusFor(futureWithBuy(p), Number(p.min_stock || 0), rules ?? DEFAULT_RULES)
        : "normal",
    [futureWithBuy, rules],
  );

  const rows = useMemo(() => {
    let list = recomputedProducts ?? [];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          String(p?.description ?? "")
            .toLowerCase()
            .includes(term) ||
          String(p?.code ?? "")
            .toLowerCase()
            .includes(term),
      );
    }
    if (supplier !== "todos") list = list.filter((p) => p?.supplier_id === supplier);
    if (category !== "todas") list = list.filter((p) => p?.category_id === category);
    if (status !== "todos") {
      if (status === "inativos") {
        list = list.filter((p) => p?.active === false);
      } else if (status === "ativos") {
        list = list.filter((p) => p?.active !== false);
      } else {
        list = list.filter((p) => stockStatus(p) === status);
      }
    }

    if (quickFilter === "sugestoes") {
      list = list.filter((p) => p?.active !== false && (p?.suggestedPurchase ?? 0) > 0);
    } else if (quickFilter === "criticos") {
      list = list.filter((p) => p?.active !== false && stockStatus(p) !== "normal");
    } else if (quickFilter === "planejados") {
      list = list.filter(
        (p) => p?.active !== false && plan && plan[p?.id] !== undefined && plan[p?.id] > 0,
      );
    } else if (quickFilter === "inativos") {
      list = list.filter((p) => p?.active === false);
    } else if (quickFilter === "ativos") {
      list = list.filter((p) => p?.active !== false);
    }

    const sorted = [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "status") {
        const orderA = a.active === false ? 99 : (statusOrder[stockStatus(a)] ?? 2);
        const orderB = b.active === false ? 99 : (statusOrder[stockStatus(b)] ?? 2);
        return (orderA - orderB) * dir;
      }
      if (sort.key === "futureStock") return (futureWithBuy(a) - futureWithBuy(b)) * dir;
      const av = a[sort.key] as string | number | undefined;
      const bv = b[sort.key] as string | number | undefined;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR") * dir;
    });

    if (!groupBySupplier) return sorted;
    return [...sorted].sort(
      (a, b) =>
        String(a?.supplierName ?? "").localeCompare(String(b?.supplierName ?? ""), "pt-BR") ||
        String(a?.description ?? "").localeCompare(String(b?.description ?? ""), "pt-BR"),
    );
  }, [
    recomputedProducts,
    search,
    supplier,
    category,
    status,
    quickFilter,
    plan,
    sort,
    groupBySupplier,
    futureWithBuy,
    stockStatus,
  ]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  async function handleToggleActive(p: ComputedProduct, nextActive: boolean) {
    try {
      await toggleProductActive(p.id, nextActive);
      if (!nextActive) {
        clearPlan([p.id]);
      }
      invalidate();
      toast.success(
        nextActive
          ? `Produto ${p.description} reativado com sucesso.`
          : `Produto ${p.description} desativado. Trava de compra acionada!`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeProduct(p: ComputedProduct) {
    try {
      await deleteProduct(p.id);
      invalidate();
      toast.success(`Produto ${p.description} apagado.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function quickSaveStock(p: ComputedProduct, value: string) {
    const v = Number(value.replace(",", ".")) || 0;
    if (v === Number(p.current_stock)) return;
    try {
      await applyMovement({
        productId: p.id,
        type: v > Number(p.current_stock) ? "ajuste_positivo" : "ajuste_negativo",
        newQuantity: v,
        notes: "Edição rápida na tela de estoque",
      });
      clearPlan([p.id]);
      invalidate();
      toast.success(`Estoque de ${p.description} atualizado.`);
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function quickSaveConsumption(p: ComputedProduct, value: string) {
    const v = Number(value.replace(",", ".")) || 0;
    if (v === Number(p.avg_weekly_consumption)) return;
    try {
      await updateProductConsumption(p.id, v);
      clearPlan([p.id]);
      invalidate();
      toast.success(`Consumo semanal de ${p.description} atualizado para ${v} ${p.unit}.`);
    } catch (err) {
      toast.error((err as Error).message);
      throw err;
    }
  }

  const Th = ({ k, children, align }: { k: SortKey; children: ReactNode; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Controle de Estoque"
        description="Todos os produtos, com cálculo automático de compra sugerida e estoque futuro."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(plan).length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  clearPlan();
                  toast.info(
                    "Plano de compras limpo. Exibindo projeção real sem compras adicionais.",
                  );
                }}
                className="text-xs sm:text-sm"
              >
                Limpar plano ({Object.keys(plan).length})
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={applyAllSuggestions}
                className="gap-1.5 text-xs sm:text-sm"
                title="Preenche a coluna 'Quero Comprar' com a compra sugerida de cada produto"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Usar Sugestões</span>
              </Button>
            )}
            {!isCounter ? (
              <>
                <WhatsAppStockImportDialog />
                <Link to="/importar">
                  <Button variant="outline" className="gap-1.5 text-xs sm:text-sm">
                    <Upload className="h-4 w-4" />
                    <span>Importar Planilha</span>
                  </Button>
                </Link>
                {canWrite && (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                    className="gap-1.5 text-xs sm:text-sm"
                  >
                    <Plus className="h-4 w-4" /> Novo produto
                  </Button>
                )}
              </>
            ) : (
              <Link to="/contagens">
                <Button className="gap-1.5 text-xs sm:text-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>Ir para Contagens</span>
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Barra de Controle do Ciclo de Giro (Segunda a Segunda) */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 shadow-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-md text-primary mt-0.5 sm:mt-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Cálculo de Criticidade pelo Ciclo (Seg a Seg)
              </span>
              <Badge
                variant="outline"
                className="border-primary/40 bg-background text-[11px] font-semibold text-primary"
              >
                {getRemainingDaysLabel(effectiveRefDay, isPostOperation)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              O estoque crítico é calculado com base no consumo estimado entre o dia referencial e o
              fechamento da próxima segunda-feira.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground whitespace-nowrap">
              Dia Referencial:
            </span>
            <Select
              value={selectedRefDay}
              onValueChange={(val) => setSelectedRefDay(val as DayOfWeek | "auto")}
            >
              <SelectTrigger className="h-8 w-44 bg-background text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Hoje (Automático - {DAYS_OF_WEEK.find((d) => d.key === todayDayOfWeek)?.label})
                </SelectItem>
                {DAYS_OF_WEEK.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs cursor-pointer shadow-xs hover:bg-muted/40 transition-colors"
            onClick={() => setIsPostOperation(!isPostOperation)}
            title="Pré-operação: o consumo de hoje ainda vai acontecer até o encerramento. Pós-operação: deduz o consumo previsto de hoje do estoque, restando suprir até a 2ª feira."
          >
            <Switch
              id="post-op-estoque"
              checked={isPostOperation}
              onCheckedChange={setIsPostOperation}
              onClick={(e) => e.stopPropagation()}
            />
            <Label
              htmlFor="post-op-estoque"
              className="cursor-pointer font-medium select-none text-[11px] leading-tight text-foreground"
            >
              {isPostOperation
                ? "Pós-operação (Deduz giro de hoje do estoque)"
                : "Pré-operação (Giro de hoje ainda a consumir)"}
            </Label>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="mb-4 space-y-3 rounded-lg border bg-card p-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto ou código..."
              className="pl-9 h-9 text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {!isCounter && (
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger className="h-9 text-xs w-full sm:w-44">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os fornecedores</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-40">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                <SelectItem value="ativos">Apenas Ativos</SelectItem>
                <SelectItem value="inativos">Inativos (Bloqueados)</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>

            {/* Alternador de Modo: Tabela vs Cartões */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSetViewMode("cards")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "cards"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Modo Cartões para Celular"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cartões</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("table")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Modo Tabela Completa"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chips de Filtro Rápido no Celular */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              size="sm"
              variant={quickFilter === "todos" ? "default" : "outline"}
              onClick={() => setQuickFilter("todos")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              Todos ({recomputedProducts.length})
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "sugestoes" ? "default" : "outline"}
              onClick={() => setQuickFilter("sugestoes")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              <Sparkles className="h-3 w-3 mr-1 text-primary" />
              Precisam Comprar (
              {
                recomputedProducts.filter((p) => p.active !== false && p.suggestedPurchase > 0)
                  .length
              }
              )
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "criticos" ? "default" : "outline"}
              onClick={() => setQuickFilter("criticos")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              Críticos / Atenção (
              {
                recomputedProducts.filter((p) => p.active !== false && stockStatus(p) !== "normal")
                  .length
              }
              )
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "inativos" ? "default" : "outline"}
              onClick={() => setQuickFilter("inativos")}
              className={cn(
                "h-7 px-2.5 text-[11px] rounded-full gap-1",
                quickFilter === "inativos"
                  ? "bg-rose-700 hover:bg-rose-800 text-white"
                  : "text-rose-700 border-rose-300 dark:text-rose-300 dark:border-rose-800",
              )}
            >
              <Lock className="h-3 w-3 text-rose-500" />
              Inativos ({recomputedProducts.filter((p) => p.active === false).length})
            </Button>
            {Object.keys(plan).length > 0 && (
              <Button
                size="sm"
                variant={quickFilter === "planejados" ? "default" : "outline"}
                onClick={() => setQuickFilter("planejados")}
                className="h-7 px-2.5 text-[11px] rounded-full"
              >
                <Check className="h-3 w-3 mr-1 text-emerald-600" />
                Quero Comprar ({Object.keys(plan).length})
              </Button>
            )}
          </div>

          {!isCounter && (
            <div className="flex items-center gap-2">
              <Switch
                id="group-supplier"
                checked={groupBySupplier}
                onCheckedChange={setGroupBySupplier}
              />
              <Label
                htmlFor="group-supplier"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Agrupar por fornecedor
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Alerta amigável caso ocorra erro ou oscilação de conexão */}
      {isError && (!products || products.length === 0) && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            A conexão com a internet oscilou ao buscar os produtos do estoque.
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar carregar novamente
          </Button>
        </div>
      )}

      {/* Visualização de Cartões Móveis (Deslizar Fácil e Intuitivo no Celular) */}
      {viewMode === "cards" ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const plannedQty = buyQty(p);
            const future = futureWithBuy(p);
            const statusVal = stockStatus(p);
            const sugRounded = p.suggestedPurchase > 0 ? Math.ceil(p.suggestedPurchase) : 0;

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border p-3.5 shadow-xs space-y-3 transition-colors",
                  p.active === false
                    ? "border-rose-500/50 bg-rose-500/5 dark:bg-rose-950/25 border-l-4 border-l-rose-500"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        to="/produtos/$id"
                        params={{ id: p.id }}
                        className={cn(
                          "font-semibold text-sm hover:underline line-clamp-1",
                          p.active === false
                            ? "text-rose-950 dark:text-rose-200"
                            : "text-foreground",
                        )}
                      >
                        {p.description}
                      </Link>
                      {p.active === false && (
                        <Badge
                          variant="outline"
                          className="border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold gap-1 text-[10px] px-1.5 py-0 inline-flex items-center shrink-0"
                        >
                          <Lock className="h-2.5 w-2.5" /> Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {p.unit}
                      </Badge>
                      {p.categoryName && <span>{p.categoryName}</span>}
                      {!isCounter && p.supplierName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{p.supplierName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {p.active === false ? (
                    <Badge
                      variant="outline"
                      className="border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold gap-1 text-xs shrink-0"
                    >
                      <Lock className="h-3 w-3" /> Inativo
                    </Badge>
                  ) : (
                    <StatusBadge status={statusVal} />
                  )}
                </div>

                {/* Métricas Principais em Grade de 3 Colunas */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-md bg-muted/30 border text-center text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Estoque Atual
                    </span>
                    <div className="mt-0.5">
                      {isCounter ? (
                        <span className="num font-bold text-foreground">
                          {formatQty(p.current_stock, p.unit)}
                        </span>
                      ) : (
                        <QuickNumericInput
                          value={p.current_stock}
                          onSave={(val) => quickSaveStock(p, val)}
                          className="num h-7 w-full text-center font-bold text-xs bg-background"
                          ariaLabel={`Estoque atual de ${p.description}`}
                        />
                      )}
                    </div>
                    {isPostOperation && (p.todayConsumption ?? 0) > 0 && (
                      <span className="text-[9px] text-muted-foreground block mt-0.5">
                        Pós: {formatQty(p.effectiveCurrentStock ?? p.current_stock, p.unit)}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Consumo Giro
                    </span>
                    <div className="num font-semibold text-foreground mt-1">
                      {formatQty(p.avg_weekly_consumption, p.unit)}
                    </div>
                    <span
                      className={`text-[9px] block mt-0.5 font-medium ${
                        (p.projectedCycleEndStock ?? 0) <= 0
                          ? "text-rose-600 dark:text-rose-400 font-bold"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                      title="Saldo previsto na 2ª feira"
                    >
                      Saldo 2ª: {formatQty(p.projectedCycleEndStock, p.unit)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Compra Sugerida
                    </span>
                    <div className="mt-1">
                      {p.active === false ? (
                        <Badge
                          variant="outline"
                          className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[11px] px-1.5 py-0 gap-1"
                        >
                          <Lock className="h-2.5 w-2.5" /> Travado
                        </Badge>
                      ) : sugRounded > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-primary/50 bg-primary/10 text-primary font-bold text-xs px-1.5 py-0"
                        >
                          {formatQty(sugRounded, p.unit)}
                        </Badge>
                      ) : (
                        <span className="num text-muted-foreground font-medium">0</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Linha de Quero Comprar e Projeção Futura */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                      Quero Comprar:
                    </span>
                    {p.active === false ? (
                      <div
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                        title="Produto inativo: compra bloqueada para evitar pedidos por engano"
                      >
                        <Lock className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-[11px]">Trava Ativa</span>
                      </div>
                    ) : (
                      <PlanInput
                        value={plannedQty}
                        placeholder={sugRounded > 0 ? String(sugRounded) : "0"}
                        onChange={(val) => setPlanned(p.id, val)}
                        roundUp={true}
                        className="num h-8 w-24 text-center font-bold text-xs"
                      />
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Estoque Futuro (Sobra 2ª)
                    </span>
                    <span
                      className={`num font-bold text-xs ${
                        future < -0.001
                          ? "text-rose-600 dark:text-rose-400 font-bold"
                          : "text-foreground font-semibold"
                      }`}
                      title={`Sobra final prevista na próxima 2ª feira: ${formatQty(future, p.unit)}`}
                    >
                      {formatQty(future, p.unit)}
                    </span>
                  </div>
                </div>

                {/* Ações do Card */}
                {!isCounter && canWrite && (
                  <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-dashed">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(p, p.active === false)}
                      className={cn(
                        "h-7 px-2 text-xs",
                        p.active === false
                          ? "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title={
                        p.active === false
                          ? "Reativar produto (liberar compras)"
                          : "Desativar produto (travar compras)"
                      }
                    >
                      {p.active === false ? (
                        <>
                          <Unlock className="h-3.5 w-3.5 mr-1" /> Reativar
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 mr-1" /> Desativar
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setDialogOpen(true);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-critical hover:bg-critical/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar {p.description}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O produto será removido junto com seu histórico de movimentações, itens
                            de pedidos e de contagens. Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeProduct(p)}>
                            Apagar produto
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}

          {!isLoading && rows.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground rounded-lg border bg-card">
              Nenhum produto encontrado com os filtros aplicados.
            </div>
          )}
        </div>
      ) : (
        /* Visualização em Tabela com Coluna Fixa (Sticky) */
        <div className="rounded-lg border bg-card shadow-card">
          <div className="sm:hidden flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground bg-muted/40 border-b">
            <span>Arraste para o lado para ver todas as métricas</span>
            <span className="font-mono text-[10px] text-primary">↔ deslize</span>
          </div>
          <div className="overflow-x-auto">
            <Table className={isCounter ? "min-w-[640px]" : "min-w-[880px]"}>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 shadow-xs">
                    <button
                      onClick={() => toggleSort("description")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Produto
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                  <Th k="current_stock" align="right">
                    Estoque Atual
                  </Th>
                  <Th k="unit">Embalagem</Th>
                  {!isCounter && <Th k="supplierName">Fornecedor</Th>}
                  <Th k="avg_weekly_consumption" align="right">
                    Consumo Semanal
                  </Th>
                  <TableHead className="text-right">
                    <div className="flex flex-col items-end">
                      <span>Consumo Restante Dias</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({getRemainingDaysLabel(effectiveRefDay, isPostOperation)})
                      </span>
                    </div>
                  </TableHead>
                  <Th k="suggestedPurchase" align="right">
                    Compra Sugerida
                  </Th>
                  <TableHead className="text-right">Quero Comprar</TableHead>
                  <Th k="futureStock" align="right">
                    <div className="flex flex-col items-end">
                      <span>Estoque Futuro</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        (Sobra na Próx. 2ª)
                      </span>
                    </div>
                  </Th>
                  <Th k="status">Status do Estoque</Th>
                  <TableHead>Observação</TableHead>
                  {!isCounter && canWrite && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={isCounter ? 10 : 12}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {rows.map((p, i) => {
                  const sugRounded = p.suggestedPurchase > 0 ? Math.ceil(p.suggestedPurchase) : 0;
                  return (
                    <Fragment key={p.id}>
                      {!isCounter &&
                        groupBySupplier &&
                        rows[i - 1]?.supplierName !== p.supplierName && (
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell
                              colSpan={12}
                              className="py-2 text-xs font-semibold uppercase"
                            >
                              {p.supplierName}
                              <span className="ml-2 font-normal text-muted-foreground">
                                {rows.filter((r) => r.supplierName === p.supplierName).length}{" "}
                                produto(s)
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                      <TableRow
                        className={
                          p.active === false
                            ? "bg-rose-500/5 dark:bg-rose-950/20 border-l-4 border-l-rose-500"
                            : ""
                        }
                      >
                        <TableCell
                          className={cn(
                            "font-medium sticky left-0 z-10 shadow-xs",
                            p.active === false ? "bg-rose-50/70 dark:bg-rose-950/40" : "bg-card",
                          )}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to="/produtos/$id"
                              params={{ id: p.id }}
                              className={cn(
                                "hover:underline font-semibold",
                                p.active === false ? "text-rose-950 dark:text-rose-200" : "",
                              )}
                            >
                              {p.description}
                            </Link>
                            {p.active === false && (
                              <Badge
                                variant="outline"
                                className="border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold gap-1 text-[10px] px-1.5 py-0 inline-flex items-center shrink-0"
                              >
                                <Lock className="h-2.5 w-2.5" /> Inativo
                              </Badge>
                            )}
                          </div>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.categoryName}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {isCounter ? (
                            <span className="num font-semibold text-foreground">
                              {formatQty(p.current_stock, p.unit)}
                            </span>
                          ) : (
                            <QuickNumericInput
                              value={p.current_stock}
                              onSave={(val) => quickSaveStock(p, val)}
                              className="num ml-auto h-8 w-24 text-right"
                              ariaLabel={`Estoque atual de ${p.description}`}
                            />
                          )}
                          {isPostOperation && (p.todayConsumption ?? 0) > 0 && (
                            <div
                              className="text-[10px] text-muted-foreground mt-0.5"
                              title={`Estoque disponível no fechamento de hoje após consumo de ${formatQty(p.todayConsumption ?? 0, p.unit)}`}
                            >
                              Pós-op:{" "}
                              {formatQty(p.effectiveCurrentStock ?? p.current_stock, p.unit)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                        {!isCounter && (
                          <TableCell className="text-muted-foreground">{p.supplierName}</TableCell>
                        )}
                        <TableCell className="text-right">
                          {isCounter ? (
                            <span className="num font-medium text-muted-foreground">
                              {formatQty(p.avg_weekly_consumption, p.unit)}
                            </span>
                          ) : (
                            <QuickNumericInput
                              value={p.avg_weekly_consumption}
                              onSave={(val) => quickSaveConsumption(p, val)}
                              className="num ml-auto h-8 w-20 text-right font-medium"
                              ariaLabel={`Consumo semanal de ${p.description}`}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-xs font-semibold text-foreground">
                            Consumo: {formatQty(p.remainingConsumption, p.unit)}
                          </div>
                          <div
                            className={`text-[11px] font-semibold ${
                              (p.projectedCycleEndStock ?? 0) <= 0
                                ? "text-rose-600 dark:text-rose-400 font-bold"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                            title="Saldo previsto na 2ª feira (Estoque Efetivo - Consumo Restante)"
                          >
                            Saldo 2ª: {formatQty(p.projectedCycleEndStock, p.unit)}
                          </div>
                        </TableCell>
                        <TableCell className="num text-right font-semibold">
                          {p.active === false ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                              title="Produto inativo — compra travada"
                            >
                              <Lock className="h-3 w-3" /> Travado
                            </span>
                          ) : sugRounded > 0 ? (
                            formatQty(sugRounded, p.unit)
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.active === false ? (
                            <div
                              className="flex items-center justify-end gap-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold ml-auto w-fit"
                              title="Produto inativo: compra bloqueada para evitar pedidos por engano"
                            >
                              <Lock className="h-3.5 w-3.5 text-rose-500" />
                              <span className="text-[11px]">Trava Ativa</span>
                            </div>
                          ) : (
                            <PlanInput
                              value={buyQty(p)}
                              placeholder={sugRounded > 0 ? String(sugRounded) : "0"}
                              onChange={(val) => setPlanned(p.id, val)}
                              roundUp={true}
                              className="num ml-auto h-8 w-24 text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="num text-right font-semibold">
                          <span
                            className={
                              futureWithBuy(p) < -0.001
                                ? "text-rose-600 dark:text-rose-400 font-bold"
                                : "text-foreground font-semibold"
                            }
                            title={`Sobra final prevista na próxima 2ª feira após o consumo do período: ${formatQty(futureWithBuy(p), p.unit)}`}
                          >
                            {formatQty(futureWithBuy(p), p.unit)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.active === false ? (
                            <Badge
                              variant="outline"
                              className="border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold gap-1 text-xs"
                            >
                              <Lock className="h-3 w-3" /> Inativo (Bloqueado)
                            </Badge>
                          ) : (
                            <StatusBadge status={stockStatus(p)} />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {p.notes ?? ""}
                        </TableCell>
                        {!isCounter && canWrite && (
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleToggleActive(p, p.active === false)}
                                title={
                                  p.active === false
                                    ? "Reativar produto (liberar compras)"
                                    : "Desativar produto (travar compras)"
                                }
                                className={
                                  p.active === false
                                    ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                                    : "text-muted-foreground hover:text-foreground"
                                }
                              >
                                {p.active === false ? (
                                  <Unlock className="h-4 w-4" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditing(p);
                                  setDialogOpen(true);
                                }}
                                title="Editar produto"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" title="Apagar produto">
                                    <Trash2 className="h-4 w-4 text-critical" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Apagar {p.description}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O produto será removido junto com seu histórico de
                                      movimentações, itens de pedidos e de contagens. Essa ação não
                                      pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeProduct(p)}>
                                      Apagar produto
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    </Fragment>
                  );
                })}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isCounter ? 10 : 12}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Nenhum produto encontrado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length} produto(s) exibido(s). Edições de estoque geram movimentação automática no
        histórico. A coluna "Quero comprar" fica salva e aparece igual nas telas de Sugestões,
        Contagem e Dashboard.
      </p>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
    </div>
  );
}
