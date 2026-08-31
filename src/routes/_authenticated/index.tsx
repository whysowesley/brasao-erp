import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";

import { PageHeader, StatCard } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { StatusBadge } from "@/components/StatusBadge";
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

  const critical = products?.filter((p) => p.status === "critico") ?? [];
  const attention = products?.filter((p) => p.status === "atencao") ?? [];
  const toBuy = products?.filter((p) => p.suggestedPurchase > 0) ?? [];
  const openOrders = orders?.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)) ?? [];
  const supplierSummary = buildSupplierSummary(products);

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <StatCard
            label="Pedidos em aberto"
            value={openOrders.length}
            hint="Ainda não recebidos"
            icon={<FileText className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-lg border bg-card shadow-card lg:col-span-3">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Produtos que precisam de reposição</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sugestoes">Ver todos</Link>
            </Button>
          </header>
          <div className="overflow-x-auto">
            <Table>
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
                {toBuy.slice(0, 8).map((p) => (
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
                    <TableCell className="num text-right font-semibold">
                      {formatQty(p.suggestedPurchase, p.unit)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {toBuy.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum produto precisa de reposição no momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
          <Table>
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
