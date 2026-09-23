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
  const { data: products, isLoading } = useProducts();
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
  const { plan, setPlanned, setPlannedBatch, clearPlan } = usePurchasePlan();

  // Flag de momento da contagem: pós-operação (fechamento, dia de hoje já usado) vs pré-operação
  const [isPostOperation, setIsPostOperation] = usePostOperationMode();

  // Recalcula o status e métricas dos produtos com base no dia referencial e momento da contagem
  const recomputedProducts = useMemo(() => {
    if (!products) return [];
    return products.map((p) =>
      computeProduct(p, rules ?? DEFAULT_RULES, 0, effectiveRefDay, isPostOperation),
    );
  }, [products, rules, effectiveRefDay, isPostOperation]);

  // Se o usuário não digitou manualmente um valor em Quero Comprar, o padrão é a compra sugerida,
  // permitindo que o valor recaia automaticamente ao alternar para pós-operação.
  const buyQty = useCallback(
    (p: ComputedProduct) =>
      plan[p.id] !== undefined ? plan[p.id] : p.suggestedPurchase > 0 ? p.suggestedPurchase : 0,
    [plan],
  );

  // O estoque futuro é o saldo projetado (Estoque Atual deduzindo o consumo do ciclo) + pedidos a caminho + quero comprar
  const futureWithBuy = useCallback(
    (p: ComputedProduct) =>
      Math.round(
        ((p.projectedCycleEndStock ?? Number(p.current_stock) - p.remainingConsumption) +
          (p.incoming ?? 0) +
          buyQty(p) +
          Number.EPSILON) *
          1000,
      ) / 1000,
    [buyQty],
  );

  const applyAllSuggestions = useCallback(() => {
    if (!recomputedProducts || recomputedProducts.length === 0) return;
    const batch: Record<string, number> = {};
    let count = 0;
    for (const p of recomputedProducts) {
      if (p.suggestedPurchase > 0) {
        batch[p.id] = p.suggestedPurchase;
        count++;
      }
    }
    if (count === 0) {
      toast.info("Nenhum produto possui sugestão de compra pendente.");
      return;
    }
    setPlannedBatch(batch);
    toast.success(`${count} sugestões de compra aplicadas a 'Quero Comprar'.`);
  }, [recomputedProducts, setPlannedBatch]);

  /** Status do estoque em tempo real conforme o estoque futuro (só fica crítico se <= 0). */
  const stockStatus = useCallback(
    (p: ComputedProduct) => futureStatusFor(futureWithBuy(p), Number(p.min_stock), rules),
    [futureWithBuy, rules],
  );

  const rows = useMemo(() => {
    let list = recomputedProducts;
    if (search.trim())
      list = list.filter((p) => p.description.toLowerCase().includes(search.trim().toLowerCase()));
    if (supplier !== "todos") list = list.filter((p) => p.supplier_id === supplier);
    if (category !== "todas") list = list.filter((p) => p.category_id === category);
    if (status !== "todos") list = list.filter((p) => stockStatus(p) === status);

    const sorted = [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "status")
        return (statusOrder[stockStatus(a)] - statusOrder[stockStatus(b)]) * dir;
      if (sort.key === "futureStock") return (futureWithBuy(a) - futureWithBuy(b)) * dir;
      const av = a[sort.key] as string | number;
      const bv = b[sort.key] as string | number;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "pt-BR") * dir;
    });

    if (!groupBySupplier) return sorted;
    return [...sorted].sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName, "pt-BR") ||
        a.description.localeCompare(b.description, "pt-BR"),
    );
  }, [
    recomputedProducts,
    search,
    supplier,
    category,
    status,
    sort,
    groupBySupplier,
    futureWithBuy,
    stockStatus,
  ]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

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
            title="Pós-operação: o dia de hoje já encerrou e foi consumido. O estoque contado atenderá a partir de amanhã até a 2ª feira. Ex: Sábado à noite conta 2 dias de consumo (Dom e Seg) em vez de 3."
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
                ? "Pós-operação (Hoje já usado)"
                : "Pré-operação (Hoje ainda será usado)"}
            </Label>
          </div>
        </div>
      </div>

      <div className={`mb-4 grid gap-3 ${isCounter ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!isCounter && (
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger>
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
          <SelectTrigger>
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
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isCounter && (
        <div className="mb-3 flex items-center gap-2">
          <Switch
            id="group-supplier"
            checked={groupBySupplier}
            onCheckedChange={setGroupBySupplier}
          />
          <Label htmlFor="group-supplier" className="text-sm text-muted-foreground">
            Ver estoque agrupado por fornecedor
          </Label>
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-card">
        <div className="sm:hidden flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground bg-muted/40 border-b">
          <span>Arraste para o lado para ver todas as métricas</span>
          <span className="font-mono text-[10px] text-primary">↔ deslize</span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <Th k="description">Produto</Th>
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
                      (Saldo 2ª + Comprar)
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
              {rows.map((p, i) => (
                <Fragment key={p.id}>
                  {!isCounter &&
                    groupBySupplier &&
                    rows[i - 1]?.supplierName !== p.supplierName && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={12} className="py-2 text-xs font-semibold uppercase">
                          {p.supplierName}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {rows.filter((r) => r.supplierName === p.supplierName).length}{" "}
                            produto(s)
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  <TableRow>
                    <TableCell className="font-medium">
                      <Link to="/produtos/$id" params={{ id: p.id }} className="hover:underline">
                        {p.description}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{p.categoryName}</span>
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
                          Pós-op: {formatQty(p.effectiveCurrentStock ?? p.current_stock, p.unit)}
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
                      {p.suggestedPurchase > 0 ? formatQty(p.suggestedPurchase, p.unit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <PlanInput
                        value={buyQty(p)}
                        placeholder={p.suggestedPurchase > 0 ? String(p.suggestedPurchase) : "0"}
                        onChange={(val) => setPlanned(p.id, val)}
                        className="num ml-auto h-8 w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      <span
                        className={
                          futureWithBuy(p) <= 0
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : futureWithBuy(p) < Number(p.min_stock)
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-foreground"
                        }
                      >
                        {formatQty(futureWithBuy(p), p.unit)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={stockStatus(p)} />
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {p.notes ?? ""}
                    </TableCell>
                    {!isCounter && canWrite && (
                      <TableCell>
                        <div className="flex items-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-critical" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Apagar {p.description}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O produto será removido junto com seu histórico de movimentações,
                                  itens de pedidos e de contagens. Essa ação não pode ser desfeita.
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
              ))}
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
      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length} produto(s) exibido(s). Edições de estoque geram movimentação automática no
        histórico. A coluna "Quero comprar" fica salva e aparece igual nas telas de Sugestões,
        Contagem e Dashboard.
      </p>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
    </div>
  );
}
