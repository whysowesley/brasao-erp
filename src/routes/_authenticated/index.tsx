import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Filter,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingDown,
  X,
} from "lucide-react";

import { PageHeader, StatCard } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMovements, useOrders, useProducts } from "@/lib/data";
import {
  OPEN_ORDER_STATUSES,
  formatDateTime,
  formatQty,
  movementLabel,
  orderStatusLabel,
  statusFor,
} from "@/lib/inventory";
import { usePurchasePlan } from "@/lib/purchase-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Brasão Estoque e Compras" },
      {
        name: "description",
        content:
          "Visão geral do estoque da Brasão: produtos críticos, sugestões de compra, pedidos em aberto e últimas movimentações.",
      },
      { property: "og:title", content: "Dashboard | Brasão Estoque e Compras" },
      {
        property: "og:description",
        content: "Indicadores de estoque, compras sugeridas e movimentações recentes.",
      },
    ],
  }),
  component: Dashboard,
});

type SupplierSummary = {
  supplierId: string | null;
  supplierName: string;
  products: number;
  totalStock: number;
  totalConsumption: number;
  totalSuggested: number;
  critical: number;
  attention: number;
  normal: number;
};

type StockFilterPreset =
  | "all"
  | "lte_0"
  | "eq_0"
  | "lt_0"
  | "gt_0"
  | "gt_1"
  | "gte_1"
  | "gt_2"
  | "gte_2"
  | "gt_3"
  | "gte_3"
  | "gt_4"
  | "gte_4"
  | "gt_5"
  | "gte_5"
  | "gt_10"
  | "custom";

type CustomOperator = ">" | ">=" | "=" | "<=" | "<";

function buildSupplierSummary(products: ReturnType<typeof useProducts>["data"]): SupplierSummary[] {
  const map = new Map<string | null, SupplierSummary>();
  for (const p of products ?? []) {
    const key = p.supplier_id ?? null;
    const existing = map.get(key);
    if (existing) {
      existing.products += 1;
      existing.totalStock += Number(p.current_stock) || 0;
      existing.totalConsumption += Number(p.avg_weekly_consumption) || 0;
      existing.totalSuggested += Number(p.suggestedPurchase) || 0;
      if (p.status === "critico") existing.critical += 1;
      else if (p.status === "atencao") existing.attention += 1;
      else existing.normal += 1;
    } else {
      map.set(key, {
        supplierId: key,
        supplierName: p.supplierName ?? "—",
        products: 1,
        totalStock: Number(p.current_stock) || 0,
        totalConsumption: Number(p.avg_weekly_consumption) || 0,
        totalSuggested: Number(p.suggestedPurchase) || 0,
        critical: p.status === "critico" ? 1 : 0,
        attention: p.status === "atencao" ? 1 : 0,
        normal: p.status === "normal" ? 1 : 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalSuggested - a.totalSuggested);
}

function Dashboard() {
  const { data: products, isLoading } = useProducts();
  const { data: orders } = useOrders();
  const { data: movements } = useMovements(undefined, 8);

  const [stockFilter, setStockFilter] = useState<StockFilterPreset>("all");
  const [customOperator, setCustomOperator] = useState<CustomOperator>(">");
  const [customValue, setCustomValue] = useState<string>("1");
  const [onlyNeedsReplenishment, setOnlyNeedsReplenishment] = useState(true);
  const [replenishmentSearch, setReplenishmentSearch] = useState("");
  const [showAllReplenishmentRows, setShowAllReplenishmentRows] = useState(false);

  const critical = products?.filter((p) => p.status === "critico") ?? [];
  const attention = products?.filter((p) => p.status === "atencao") ?? [];
  const toBuy = products?.filter((p) => p.suggestedPurchase > 0) ?? [];
  const openOrders = orders?.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)) ?? [];
  const supplierSummary = buildSupplierSummary(products);

  const filteredReplenishmentProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((p) => {
      // 1. Escopo de reposição (apenas itens que precisam de compra/atenção/estoque <= 0, ou todos)
      if (onlyNeedsReplenishment) {
        const needsReplenish =
          (Number(p.suggestedPurchase) || 0) > 0 ||
          p.status === "critico" ||
          p.status === "atencao" ||
          (Number(p.current_stock) || 0) <= 0;
        if (!needsReplenish) return false;
      }

      // 2. Busca por texto (descrição ou código)
      if (replenishmentSearch.trim()) {
        const q = replenishmentSearch.toLowerCase().trim();
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesCode = p.code?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesCode) return false;
      }

      // 3. Filtro de estoque
      const stock = Number(p.current_stock) || 0;
      switch (stockFilter) {
        case "all":
          return true;
        case "lte_0":
          return stock <= 0;
        case "eq_0":
          return stock === 0;
        case "lt_0":
          return stock < 0;
        case "gt_0":
          return stock > 0;
        case "gt_1":
          return stock > 1;
        case "gte_1":
          return stock >= 1;
        case "gt_2":
          return stock > 2;
        case "gte_2":
          return stock >= 2;
        case "gt_3":
          return stock > 3;
        case "gte_3":
          return stock >= 3;
        case "gt_4":
          return stock > 4;
        case "gte_4":
          return stock >= 4;
        case "gt_5":
          return stock > 5;
        case "gte_5":
          return stock >= 5;
        case "gt_10":
          return stock > 10;
        case "custom": {
          const val = parseFloat(customValue);
          if (isNaN(val)) return true;
          if (customOperator === ">") return stock > val;
          if (customOperator === ">=") return stock >= val;
          if (customOperator === "=") return stock === val;
          if (customOperator === "<=") return stock <= val;
          if (customOperator === "<") return stock < val;
          return true;
        }
        default:
          return true;
      }
    });
  }, [
    products,
    onlyNeedsReplenishment,
    replenishmentSearch,
    stockFilter,
    customOperator,
    customValue,
  ]);

  const displayedReplenishment = showAllReplenishmentRows
    ? filteredReplenishmentProducts
    : filteredReplenishmentProducts.slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="O que temos, o que está acabando e o que precisa ser comprado."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/contagens">Nova contagem</Link>
            </Button>
            <Button asChild>
              <Link to="/sugestoes">Ver sugestões de compra</Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-24 sm:h-28 rounded-lg", i === 4 ? "col-span-2 sm:col-span-1" : "")}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Produtos cadastrados"
            value={products?.length ?? 0}
            hint="Itens ativos no estoque"
            icon={<Boxes className="h-4 w-4" />}
          />
          <StatCard
            label="Produtos críticos"
            value={critical.length}
            tone="critical"
            hint="Necessitam compra urgente"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <StatCard
            label="Produtos em atenção"
            value={attention.length}
            tone="warning"
            hint="Próximos do estoque mínimo"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatCard
            label="Compras sugeridas"
            value={toBuy.length}
            tone="accent"
            hint="Itens com quantidade sugerida"
            icon={<ShoppingCart className="h-4 w-4" />}
          />
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <StatCard
              label="Pedidos em aberto"
              value={openOrders.length}
              hint="Ainda não recebidos"
              icon={<FileText className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-5">
        <section className="rounded-lg border bg-card shadow-card lg:col-span-3">
          <header className="border-b px-3 sm:px-4 py-2.5 sm:py-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold">
                  Produtos que precisam de reposição
                </h2>
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 font-medium tabular-nums"
                >
                  {filteredReplenishmentProducts.length}
                </Badge>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Link to="/sugestoes">Ver todos em sugestões</Link>
              </Button>
            </div>

            {/* Atalhos rápidos por chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtro:
              </span>
              {[
                { id: "all", label: "Todos" },
                { id: "lte_0", label: "≤ 0 (Zerados)", alert: true },
                { id: "eq_0", label: "= 0" },
                { id: "gt_1", label: "> 1" },
                { id: "gt_2", label: "> 2" },
                { id: "gt_3", label: "> 3" },
                { id: "gt_4", label: "> 4" },
                { id: "gt_5", label: "> 5" },
              ].map((chip) => {
                const active = stockFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStockFilter(chip.id as StockFilterPreset)}
                    className={cn(
                      "h-6 px-2 text-[11px] rounded-full transition-all shrink-0 font-medium flex items-center border",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted border-border hover:text-foreground",
                      !active && chip.alert && "text-critical hover:text-critical font-semibold",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Controles detalhados do filtro */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
              <div className="w-full sm:w-auto min-w-[180px] flex-1">
                <Select
                  value={stockFilter}
                  onValueChange={(val) => setStockFilter(val as StockFilterPreset)}
                >
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue placeholder="Filtrar por estoque..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos com reposição</SelectItem>
                    <SelectItem value="lte_0">Estoque ≤ 0 (Zerado ou negativo)</SelectItem>
                    <SelectItem value="eq_0">Estoque = 0 (Apenas zerados)</SelectItem>
                    <SelectItem value="lt_0">Estoque &lt; 0 (Apenas negativos)</SelectItem>
                    <SelectItem value="gt_0">Estoque &gt; 0 (Com saldo positivo)</SelectItem>
                    <SelectItem value="gt_1">Estoque &gt; 1 (Acima de 1)</SelectItem>
                    <SelectItem value="gte_1">Estoque ≥ 1 (A partir de 1)</SelectItem>
                    <SelectItem value="gt_2">Estoque &gt; 2 (Acima de 2)</SelectItem>
                    <SelectItem value="gte_2">Estoque ≥ 2 (A partir de 2)</SelectItem>
                    <SelectItem value="gt_3">Estoque &gt; 3 (Acima de 3)</SelectItem>
                    <SelectItem value="gte_3">Estoque ≥ 3 (A partir de 3)</SelectItem>
                    <SelectItem value="gt_4">Estoque &gt; 4 (Acima de 4)</SelectItem>
                    <SelectItem value="gte_4">Estoque ≥ 4 (A partir de 4)</SelectItem>
                    <SelectItem value="gt_5">Estoque &gt; 5 (Acima de 5)</SelectItem>
                    <SelectItem value="gte_5">Estoque ≥ 5 (A partir de 5)</SelectItem>
                    <SelectItem value="gt_10">Estoque &gt; 10 (Acima de 10)</SelectItem>
                    <SelectItem value="custom">Valor personalizado...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {stockFilter === "custom" && (
                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md border text-xs">
                  <span className="text-[11px] text-muted-foreground">Estoque</span>
                  <Select
                    value={customOperator}
                    onValueChange={(val) => setCustomOperator(val as CustomOperator)}
                  >
                    <SelectTrigger className="h-6 w-14 text-xs px-1.5 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">&gt;</SelectItem>
                      <SelectItem value=">=">≥</SelectItem>
                      <SelectItem value="=">=</SelectItem>
                      <SelectItem value="<=">≤</SelectItem>
                      <SelectItem value="<">&lt;</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="any"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Qtd"
                    className="h-6 w-16 text-xs px-1.5 bg-background"
                  />
                </div>
              )}

              <div className="relative flex-1 min-w-[130px]">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={replenishmentSearch}
                  onChange={(e) => setReplenishmentSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="h-7 text-xs pl-7 pr-6 bg-background"
                />
                {replenishmentSearch && (
                  <button
                    type="button"
                    onClick={() => setReplenishmentSearch("")}
                    className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOnlyNeedsReplenishment((prev) => !prev)}
                className={cn(
                  "h-7 px-2 text-[11px] rounded border transition-colors shrink-0 font-medium",
                  onlyNeedsReplenishment
                    ? "bg-muted/70 text-foreground border-border hover:bg-muted"
                    : "bg-primary/10 text-primary border-primary/30 font-semibold",
                )}
                title={
                  onlyNeedsReplenishment
                    ? "Mostrando produtos que precisam de reposição ou com estoque zerado/negativo"
                    : "Mostrando todo o cadastro de produtos com o filtro de estoque selecionado"
                }
              >
                {onlyNeedsReplenishment ? "Filtro: Reposição" : "Filtro: Todo o estoque"}
              </button>
            </div>
          </header>

          <div className="overflow-x-auto">
            <Table className="min-w-[480px] sm:min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Consumo/sem</TableHead>
                  <TableHead className="text-right">Compra sugerida</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedReplenishment.map((p) => {
                  const isZeroOrNeg = Number(p.current_stock) <= 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/produtos/$id"
                          params={{ id: p.id }}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span className="truncate max-w-[180px] sm:max-w-xs">
                            {p.description}
                          </span>
                          {isZeroOrNeg && (
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0",
                                Number(p.current_stock) < 0
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {Number(p.current_stock) < 0 ? "Negativo" : "Zerado"}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="num text-right font-medium">
                        <span className={cn(isZeroOrNeg && "text-destructive font-bold")}>
                          {formatQty(p.current_stock, p.unit)}
                        </span>
                      </TableCell>
                      <TableCell className="num text-right">
                        {formatQty(p.avg_weekly_consumption, p.unit)}
                      </TableCell>
                      <TableCell className="num text-right font-semibold">
                        {p.suggestedPurchase > 0 ? (
                          formatQty(p.suggestedPurchase, p.unit)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredReplenishmentProducts.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      <div className="space-y-1.5">
                        <p>Nenhum produto encontrado com os filtros selecionados.</p>
                        {(stockFilter !== "all" ||
                          replenishmentSearch ||
                          !onlyNeedsReplenishment) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStockFilter("all");
                              setReplenishmentSearch("");
                              setOnlyNeedsReplenishment(true);
                            }}
                            className="h-6 text-xs"
                          >
                            Restaurar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredReplenishmentProducts.length > 8 && (
            <div className="flex items-center justify-between border-t px-3 sm:px-4 py-2 text-xs text-muted-foreground bg-muted/20">
              <span>
                Mostrando {displayedReplenishment.length} de {filteredReplenishmentProducts.length}{" "}
                itens
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => setShowAllReplenishmentRows((prev) => !prev)}
              >
                {showAllReplenishmentRows ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" /> Mostrar todos (
                    {filteredReplenishmentProducts.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Últimas movimentações</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/historico">Histórico</Link>
            </Button>
          </header>
          <ul className="divide-y">
            {movements?.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(m.products as { description: string } | null)?.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movementLabel(m.type)} · {formatDateTime(m.created_at)}
                  </p>
                </div>
                <span
                  className={`num shrink-0 text-sm font-semibold ${
                    Number(m.quantity_change) < 0 ? "text-critical" : "text-success"
                  }`}
                >
                  {Number(m.quantity_change) > 0 ? "+" : ""}
                  {formatQty(m.quantity_change)}
                </span>
              </li>
            ))}
            {movements?.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card shadow-card">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" /> Estoque por fornecedor
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/fornecedores">Gerenciar fornecedores</Link>
          </Button>
        </header>
        <div className="overflow-x-auto">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="text-right">Estoque total</TableHead>
                <TableHead className="text-right">Consumo/sem</TableHead>
                <TableHead className="text-right">Compra sugerida</TableHead>
                <TableHead className="w-48">Status dos produtos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierSummary.map((s) => {
                const totalStatus = s.critical + s.attention + s.normal || 1;
                return (
                  <TableRow key={s.supplierId ?? "sem-fornecedor"}>
                    <TableCell className="font-medium">{s.supplierName}</TableCell>
                    <TableCell className="num text-right">{s.products}</TableCell>
                    <TableCell className="num text-right">{formatQty(s.totalStock)}</TableCell>
                    <TableCell className="num text-right">
                      {formatQty(s.totalConsumption)}
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      {s.totalSuggested > 0 ? formatQty(s.totalSuggested) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-critical"
                            style={{ width: `${(s.critical / totalStatus) * 100}%` }}
                          />
                          <div
                            className="bg-warning"
                            style={{ width: `${(s.attention / totalStatus) * 100}%` }}
                          />
                          <div
                            className="bg-success"
                            style={{ width: `${(s.normal / totalStatus) * 100}%` }}
                          />
                        </div>
                        <span className="num shrink-0 text-xs tabular-nums text-muted-foreground">
                          {s.critical}/{s.attention}/{s.normal}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {supplierSummary.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum fornecedor cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <SupplierFocus products={products} />

      {openOrders.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card shadow-card">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4" /> Pedidos em aberto
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pedidos">Ver pedidos</Link>
            </Button>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openOrders.slice(0, 5).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="num font-medium">
                      #{String(o.number).padStart(4, "0")}
                    </TableCell>
                    <TableCell>{(o.suppliers as { name: string } | null)?.name ?? "—"}</TableCell>
                    <TableCell className="num">{o.purchase_order_items?.length ?? 0}</TableCell>
                    <TableCell>{orderStatusLabel(o.status)}</TableCell>
                    <TableCell>{formatDateTime(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

type Products = NonNullable<ReturnType<typeof useProducts>["data"]>;

/** Análise detalhada: escolha um fornecedor e veja os itens dele com resumo. */
function SupplierFocus({ products }: { products: Products | undefined }) {
  const suppliers = useMemo(() => {
    if (!products) return [];
    const map = new Map<string, string>();
    for (const p of products) map.set(p.supplier_id ?? "sem", p.supplierName ?? "Sem fornecedor");
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [products]);

  const list = products ?? [];

  const [supplierId, setSupplierId] = useState<string>("");
  const { plan, setPlanned } = usePurchasePlan();

  const selected = supplierId || suppliers[0]?.id || "";
  const items = list.filter((p) => (p.supplier_id ?? "sem") === selected);

  const totals = items.reduce(
    (acc, p) => {
      const qty = plan[p.id] ?? p.suggestedPurchase ?? 0;
      acc.stock += Number(p.current_stock) || 0;
      acc.consumption += Number(p.avg_weekly_consumption) || 0;
      acc.suggested += Number(p.suggestedPurchase) || 0;
      acc.buying += qty;
      return acc;
    },
    { stock: 0, consumption: 0, suggested: 0, buying: 0 },
  );

  return (
    <section className="mt-6 rounded-lg border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4" /> Analisar fornecedor
        </h2>
        <Select value={selected} onValueChange={setSupplierId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Escolha um fornecedor" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Resume label="Itens" value={String(items.length)} />
        <Resume label="Estoque total" value={formatQty(totals.stock)} />
        <Resume label="Giro médio / semana" value={formatQty(totals.consumption)} />
        <Resume label="Compra sugerida" value={formatQty(totals.suggested)} />
        <Resume label="Estou comprando" value={formatQty(totals.buying)} />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Giro médio</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="text-right">Quero comprar</TableHead>
              <TableHead className="text-right">Estoque futuro</TableHead>
              <TableHead>Status futuro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => {
              const qty = plan[p.id] ?? p.suggestedPurchase ?? 0;
              const future =
                (Number(p.current_stock) || 0) - (Number(p.avg_weekly_consumption) || 0) + qty;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link to="/produtos/$id" params={{ id: p.id }} className="hover:underline">
                      {p.description}
                    </Link>
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatQty(p.current_stock, p.unit)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatQty(p.avg_weekly_consumption, p.unit)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatQty(p.suggestedPurchase, p.unit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PlanInput
                      className="num ml-auto h-8 w-24 text-right"
                      value={qty}
                      onChange={(val) => setPlanned(p.id, val)}
                    />
                  </TableCell>
                  <TableCell className="num text-right font-semibold">
                    {formatQty(future, p.unit)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={statusFor(future, p.avg_weekly_consumption, p.min_stock)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum item para este fornecedor.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Resume({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num text-lg font-semibold">{value}</p>
    </div>
  );
}
