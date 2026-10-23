import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, CheckCircle2, Lock, Pencil, Unlock } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  toggleProductActive,
  useInvalidateAll,
  useMovements,
  useProduct,
  useRules,
} from "@/lib/data";
import {
  computeProduct,
  DAYS_OF_WEEK,
  DEFAULT_RULES,
  formatDateTime,
  formatQty,
  getDailyConsumptionFromProduct,
  getDayOfWeekFromDate,
  movementLabel,
} from "@/lib/inventory";
import { usePostOperationMode } from "@/lib/post-operation";
import { useAuth } from "@/lib/auth";

function ProductErrorFallback({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <ArrowLeft className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">Não foi possível carregar o produto</h2>
      <p className="text-sm text-muted-foreground">
        Houve uma oscilação na conexão com o banco de dados. Tente atualizar ou volte ao estoque.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Button onClick={() => reset()} variant="outline">
          Tentar novamente
        </Button>
        <Button asChild>
          <Link to="/estoque">Voltar ao Estoque</Link>
        </Button>
      </div>
    </div>
  );
}

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
  errorComponent: ProductErrorFallback,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { isCounter, canWrite } = useAuth();
  const { data: rawProduct, isLoading, isError, refetch } = useProduct(id);
  const { data: rules } = useRules();
  const [isPostOperation] = usePostOperationMode();
  const { data: movements } = useMovements(id, 200);
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateAll();

  async function handleToggleActive() {
    if (!product) return;
    const nextActive = product.active === false;
    try {
      await toggleProductActive(product.id, nextActive);
      invalidate();
      refetch();
      toast.success(
        nextActive
          ? `Produto ${product.description} reativado.`
          : `Produto ${product.description} desativado. Trava de compra acionada!`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const product = useMemo(() => {
    if (!rawProduct) return null;
    return computeProduct(
      rawProduct,
      rules ?? DEFAULT_RULES,
      0,
      getDayOfWeekFromDate(),
      isPostOperation,
    );
  }, [rawProduct, rules, isPostOperation]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-lg lg:col-span-1" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Produto não encontrado</h2>
        <p className="text-sm text-muted-foreground">
          O produto solicitado pode ter sido excluído ou você não possui conexão no momento.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => refetch()} variant="outline">
            Tentar novamente
          </Button>
          <Button asChild>
            <Link to="/estoque">Voltar ao Estoque</Link>
          </Button>
        </div>
      </div>
    );
  }

  const chartData = (movements ?? [])
    .slice()
    .reverse()
    .map((m) => {
      let dateLabel = "—";
      try {
        const d = new Date(m.created_at);
        if (!isNaN(d.getTime())) {
          dateLabel = d.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          });
        }
      } catch {
        dateLabel = "—";
      }
      return {
        date: dateLabel,
        estoque: Number(m.quantity_after) || 0,
      };
    });

  const daily = getDailyConsumptionFromProduct(product);

  const info: Array<[string, string]> = [
    ["Categoria", product.categoryName],
    ["Fornecedor", product.supplierName],
    ["Unidade / embalagem", product.unit],
    [
      "Status no Sistema",
      product.active !== false
        ? "Ativo (Liberado para compras)"
        : "Inativo (Trava de compra ativa)",
    ],
    ["Estoque atual", formatQty(product.current_stock, product.unit)],
    ["Consumo médio semanal", formatQty(product.avg_weekly_consumption, product.unit)],
    [
      "Modo de consumo",
      product.daily_consumption_mode === "custom"
        ? "Personalizado por dia"
        : "Constante todos os dias",
    ],
    ["Estoque mínimo", formatQty(product.min_stock, product.unit)],
    ["Estoque de segurança", formatQty(product.safety_stock, product.unit)],
    ["Saldo 2ª previsto (sem compra)", formatQty(product.projectedStock, product.unit)],
    [
      "Compra sugerida (para zerar na 2ª)",
      product.active === false
        ? "Bloqueada (Item Inativo)"
        : formatQty(product.suggestedPurchase, product.unit),
    ],
    [
      "Estoque futuro na 2ª feira (com compra sugerida)",
      formatQty(product.futureStockWithSuggestion, product.unit),
    ],
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
          <div className="flex flex-wrap items-center gap-2">
            {product.active === false ? (
              <Badge
                variant="outline"
                className="border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold gap-1 text-xs py-1 px-2.5"
              >
                <Lock className="h-3.5 w-3.5" /> Inativo (Bloqueado)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold gap-1 text-xs py-1 px-2.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
              </Badge>
            )}

            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
              <span className="text-xs text-muted-foreground mr-1">Status Atual:</span>
              <StatusBadge status={product.status} className="h-8 px-2.5 text-xs" />
              <span className="text-xs text-muted-foreground ml-2 mr-1">Status Futuro:</span>
              <StatusBadge status={product.futureStatus} className="h-8 px-2.5 text-xs" />
            </div>

            {!isCounter && canWrite && (
              <div className="flex items-center gap-2 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  className={
                    product.active === false
                      ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300"
                      : "text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                  }
                >
                  {product.active === false ? (
                    <>
                      <Unlock className="h-4 w-4 mr-1.5" /> Reativar
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-1.5" /> Desativar
                    </>
                  )}
                </Button>
                <Button onClick={() => setOpen(true)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              </div>
            )}
          </div>
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

          {/* Consumo Diário por Dia da Semana (Segunda a Segunda) */}
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Consumo Diário (8 dias)
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {product.daily_consumption_mode === "custom" ? "Por dia" : "Constante"}
              </Badge>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-center">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d.key} className="rounded bg-muted/50 p-1">
                  <div className="text-[10px] font-semibold text-muted-foreground">{d.short}</div>
                  <div className="num text-xs font-bold mt-0.5">{formatQty(daily[d.key])}</div>
                </div>
              ))}
            </div>
          </div>

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

      {!isCounter && canWrite && (
        <ProductDialog open={open} onOpenChange={setOpen} product={product} />
      )}
    </div>
  );
}
