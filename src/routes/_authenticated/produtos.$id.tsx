import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { ProductDialog } from "@/components/ProductDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMovements, useProduct } from "@/lib/data";
import { formatDateTime, formatQty, movementLabel } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/produtos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do produto | Brasão Estoque" },
      {
        name: "description",
        content:
          "Ficha completa do produto: estoque, consumo semanal, compra sugerida, status e histórico de movimentações.",
      },
      { property: "og:title", content: "Detalhes do produto | Brasão Estoque" },
      {
        property: "og:description",
        content: "Histórico e evolução do estoque do produto.",
      },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { data: product, isLoading } = useProduct(id);
  const { data: movements } = useMovements(id, 200);
  const [open, setOpen] = useState(false);

  if (isLoading || !product) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  const chartData = [...(movements ?? [])]
    .reverse()
    .map((m) => ({
      date: new Date(m.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      estoque: Number(m.quantity_after),
    }));

  const info: Array<[string, string]> = [
    ["Categoria", product.categoryName],
    ["Fornecedor", product.supplierName],
    ["Unidade / embalagem", product.unit],
    ["Estoque atual", formatQty(product.current_stock, product.unit)],
    ["Consumo médio semanal", formatQty(product.avg_weekly_consumption, product.unit)],
    ["Estoque mínimo", formatQty(product.min_stock, product.unit)],
    ["Estoque desejado", formatQty(product.desired_stock, product.unit)],
    ["Estoque projetado (sem compra)", formatQty(product.projectedStock, product.unit)],
    ["Compra sugerida", formatQty(product.suggestedPurchase, product.unit)],
    ["Estoque futuro", formatQty(product.futureStock, product.unit)],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/estoque">
          <ArrowLeft className="h-4 w-4" /> Voltar ao estoque
        </Link>
      </Button>

      <PageHeader
        title={product.description}
        description={`Código ${product.code ?? "—"} · ${product.categoryName}`}
        actions={
          <>
            <StatusBadge status={product.status} className="h-9 px-3 text-sm" />
            <Button onClick={() => setOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 shadow-card lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Ficha do produto</h2>
          <dl className="space-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="num font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {product.notes && (
            <p className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {product.notes}
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Evolução do estoque</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="estoque"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card shadow-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Histórico do produto</h2>
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / hora</TableHead>
                <TableHead>Movimentação</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Movimentado</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(m.created_at)}
                  </TableCell>
                  <TableCell>{movementLabel(m.type)}</TableCell>
                  <TableCell className="num text-right">{formatQty(m.quantity_before)}</TableCell>
                  <TableCell
                    className={`num text-right font-medium ${
                      Number(m.quantity_change) < 0 ? "text-critical" : "text-success"
                    }`}
                  >
                    {Number(m.quantity_change) > 0 ? "+" : ""}
                    {formatQty(m.quantity_change)}
                  </TableCell>
                  <TableCell className="num text-right">{formatQty(m.quantity_after)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.notes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <ProductDialog open={open} onOpenChange={setOpen} product={product} />
    </div>
  );
}
