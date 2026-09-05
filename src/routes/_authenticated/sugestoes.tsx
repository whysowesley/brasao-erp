import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Filter, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createOrdersFromSuggestions,
  useInvalidateAll,
  useProducts,
  useRules,
  useSuppliers,
} from "@/lib/data";
import {
  computeProduct,
  DEFAULT_RULES,
  DAYS_OF_WEEK,
  formatQty,
  futureStatusFor,
  getDayOfWeekFromDate,
  type DayOfWeek,
} from "@/lib/inventory";
import { usePostOperationMode } from "@/lib/post-operation";
import { usePurchasePlan } from "@/lib/purchase-plan";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  head: () => ({
    meta: [
      { title: "Sugestões de Compra | Brasão" },
      {
        name: "description",
        content:
          "Produtos que precisam de reposição, com quantidade sugerida e estoque futuro calculados automaticamente.",
      },
      { property: "og:title", content: "Sugestões de Compra | Brasão" },
      {
        property: "og:description",
        content: "Selecione os itens e gere pedidos de compra agrupados por fornecedor.",
      },
    ],
  }),
  component: SugestoesPage,
});

function SugestoesPage() {
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();
  const invalidate = useInvalidateAll();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const { plan, setPlanned, clearPlan } = usePurchasePlan();
  const { data: rules } = useRules();
  const [saving, setSaving] = useState(false);

  // Referencial do dia para cálculo de ciclo (Segunda a Segunda)
  const [selectedRefDay, setSelectedRefDay] = useState<DayOfWeek | "auto">("auto");
  const todayDayOfWeek = getDayOfWeekFromDate();
  const effectiveRefDay = selectedRefDay === "auto" ? todayDayOfWeek : selectedRefDay;

  // Flag de momento da contagem: pós-operação (fechamento, dia de hoje já usado) vs pré-operação
  const [isPostOperation, setIsPostOperation] = usePostOperationMode();

  // Recalcula métricas e sugestões dos produtos com base no dia referencial e no momento da contagem
  const recomputedProducts = useMemo(() => {
    if (!products) return [];
    return products.map((p) =>
      computeProduct(p, rules ?? DEFAULT_RULES, 0, effectiveRefDay, isPostOperation),
    );
  }, [products, rules, effectiveRefDay, isPostOperation]);

  // Filtros
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [showAllStock, setShowAllStock] = useState<boolean>(false);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let list = recomputedProducts;

    if (supplierFilter !== "all") {
      list = list.filter((p) => (p.supplier_id || "sem-fornecedor") === supplierFilter);
    }

    if (!showAllStock) {
      list = list.filter((p) => p.suggestedPurchase > 0);
    }

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.description.toLowerCase().includes(term) ||
          (p.code !== null && p.code !== undefined && String(p.code).includes(term)),
      );
    }

    return list;
  }, [recomputedProducts, supplierFilter, showAllStock, search]);

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);
  const chosen = rows.filter((r) => selected[r.id]);

  async function generateOrders() {
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um produto.");
      return;
    }
    setSaving(true);
    try {
      const bySupplier = new Map<string, typeof chosen>();
      for (const p of chosen) {
        const key = p.supplier_id ?? "sem-fornecedor";
        bySupplier.set(key, [...(bySupplier.get(key) ?? []), p]);
      }

      const groups = Array.from(bySupplier.entries()).map(([supplierId, items]) => ({
        supplierId: supplierId === "sem-fornecedor" ? null : supplierId,
        items: items.map((p) => {
          const plannedVal = plan[p.id];
          const qty =
            plannedVal !== undefined
              ? plannedVal
              : p.suggestedPurchase > 0
                ? p.suggestedPurchase
                : 0;

          return {
            productId: p.id,
            description: p.description,
            quantity: qty,
            unit: p.unit,
          };
        }),
      }));

      await createOrdersFromSuggestions(groups);

      clearPlan(chosen.map((p) => p.id));
      invalidate();
      toast.success(`${bySupplier.size} pedido(s) de compra criado(s).`);
      navigate({ to: "/pedidos" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Sugestões de Compra"
        description="Produtos que precisam de reposição. A compra sugerida analisa o saldo que restará na 2ª feira (estoque atual menos o consumo restante até a entrega) e sugere a quantidade necessária para suprir o giro da semana."
        actions={
          <Button onClick={generateOrders} disabled={saving || chosen.length === 0}>
            <ShoppingCart className="h-4 w-4" />
            Gerar pedido de compra {chosen.length > 0 && `(${chosen.length})`}
          </Button>
        }
      />

      {/* Barra de Filtros */}
      <div className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          {/* Fornecedor */}
          <div className="w-full sm:w-56">
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              Fornecedor
            </Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dia Referencial do Ciclo */}
          <div className="w-full sm:w-56">
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              Dia Referencial do Ciclo
            </Label>
            <Select
              value={selectedRefDay}
              onValueChange={(val) => setSelectedRefDay(val as DayOfWeek | "auto")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Dia de referência" />
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

          {/* Momento da Contagem: Pós-operação (Fechamento) vs Pré-operação */}
          <div className="w-full sm:w-auto">
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">
              Momento da Contagem
            </Label>
            <div
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 h-10 shadow-xs cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setIsPostOperation(!isPostOperation)}
              title="Quando ativo (Pós-operação), o dia de hoje já encerrou e foi consumido. O estoque contado atenderá a partir de amanhã até a 2ª feira. Ex: Sábado à noite conta 2 dias de consumo (Dom e Seg) em vez de 3."
            >
              <Switch
                id="post-op-sugestoes"
                checked={isPostOperation}
                onCheckedChange={setIsPostOperation}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight text-foreground select-none">
                  {isPostOperation ? "Pós-operação (Fechamento)" : "Pré-operação (Abertura)"}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none select-none">
                  {isPostOperation
                    ? "Dia de hoje já consumido"
                    : "Dia de hoje ainda será consumido"}
                </span>
              </div>
            </div>
          </div>

          {/* Flag Opcional: Exibir estoque completo mesmo com sugestão 0 */}
          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            <Switch id="show-all-stock" checked={showAllStock} onCheckedChange={setShowAllStock} />
            <Label
              htmlFor="show-all-stock"
              className="cursor-pointer text-xs font-medium leading-none select-none"
            >
              Exibir estoque completo (mesmo com sugestão 0)
            </Label>
          </div>
        </div>

        {/* Busca rápida */}
        <div className="w-full md:w-64">
          <Label className="mb-1 block text-xs font-medium text-muted-foreground">
            Buscar produto
          </Label>
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) =>
                      setSelected(v ? Object.fromEntries(rows.map((r) => [r.id, true])) : {})
                    }
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Estoque Atual</TableHead>
                <TableHead className="text-right">Saldo p/ 2ª Feira</TableHead>
                <TableHead className="text-right">Giro Semanal</TableHead>
                <TableHead className="text-right">Compra Sugerida</TableHead>
                <TableHead className="text-right">Quero Comprar</TableHead>
                <TableHead className="text-right">Estoque Futuro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Status Futuro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const plannedValue = plan[p.id];
                const wanted =
                  plannedValue !== undefined
                    ? plannedValue
                    : p.suggestedPurchase > 0
                      ? p.suggestedPurchase
                      : 0;
                // Estoque Futuro = Saldo da 2ª Segunda + Valor a comprar para a próxima semana
                const future =
                  Math.round(
                    ((p.projectedCycleEndStock ?? Number(p.current_stock)) +
                      wanted +
                      Number.EPSILON) *
                      1000,
                  ) / 1000;
                return (
                  <TableRow key={p.id} data-state={selected[p.id] ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[p.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [p.id]: !!v }))}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell className="text-muted-foreground">{p.supplierName}</TableCell>
                    <TableCell className="num text-right">
                      {formatQty(p.current_stock, p.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className={`text-xs font-semibold ${
                          (p.projectedCycleEndStock ?? 0) <= 0
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                        title={`Consumo restante (${p.remainingDaysLabel}): ${formatQty(p.remainingConsumption, p.unit)}`}
                      >
                        {formatQty(p.projectedCycleEndStock, p.unit)}
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground"
                        title={p.remainingDaysLabel}
                      >
                        (-{formatQty(p.remainingConsumption, p.unit)} em {p.remainingDaysCount}d)
                      </div>
                    </TableCell>
                    <TableCell className="num text-right">
                      {formatQty(p.avg_weekly_consumption, p.unit)}
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      {p.suggestedPurchase > 0 ? formatQty(p.suggestedPurchase, p.unit) : "0"}
                    </TableCell>
                    <TableCell className="text-right">
                      <PlanInput
                        value={wanted}
                        onChange={(val) => setPlanned(p.id, val)}
                        className="num ml-auto h-8 w-28 text-right font-semibold"
                      />
                    </TableCell>
                    <TableCell className="num text-right">{formatQty(future, p.unit)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={futureStatusFor(future, Number(p.min_stock), rules)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                    {showAllStock
                      ? "Nenhum produto encontrado para os filtros selecionados."
                      : "Nenhum produto precisa de reposição no momento. Ative 'Exibir estoque completo' para visualizar todos os itens."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Os pedidos são criados agrupando os produtos selecionados por fornecedor. Se desejar enviar
        um produto com quantidade 0 para confirmação ao fornecedor, mantenha o item marcado com 0 em
        &quot;Quero Comprar&quot;.
      </p>
    </div>
  );
}
