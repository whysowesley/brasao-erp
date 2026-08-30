import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createOrdersFromSuggestions, useInvalidateAll, useProducts, useRules } from "@/lib/data";
import { formatQty, futureStatusFor } from "@/lib/inventory";
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
  const invalidate = useInvalidateAll();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const { plan, setPlanned, clearPlan } = usePurchasePlan();
  const { data: rules } = useRules();
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => (products ?? []).filter((p) => p.suggestedPurchase > 0), [products]);
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
        items: items.map((p) => ({
          productId: p.id,
          quantity: plan[p.id] ?? p.suggestedPurchase,
          unit: p.unit,
        })),
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
        description="Apenas produtos que precisam de reposição, com quantidade calculada automaticamente."
        actions={
          <Button onClick={generateOrders} disabled={saving || chosen.length === 0}>
            <ShoppingCart className="h-4 w-4" />
            Gerar pedido de compra {chosen.length > 0 && `(${chosen.length})`}
          </Button>
        }
      />

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table>
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
                <TableHead className="text-right">Consumo Semanal</TableHead>
                <TableHead className="text-right">Compra Sugerida</TableHead>
                <TableHead className="text-right">Quero Comprar</TableHead>
                <TableHead className="text-right">Estoque Futuro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Status Futuro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const wanted = plan[p.id] ?? p.suggestedPurchase;
                const future = Number(p.current_stock) + wanted - Number(p.avg_weekly_consumption);
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
                    <TableCell className="num text-right">
                      {formatQty(p.avg_weekly_consumption, p.unit)}
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      {formatQty(p.suggestedPurchase, p.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="num ml-auto h-8 w-28 text-right font-semibold"
                        value={String(wanted)}
                        onChange={(e) =>
                          setPlanned(p.id, Number(e.target.value.replace(",", ".")) || 0)
                        }
                        inputMode="decimal"
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
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Nenhum produto precisa de reposição no momento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Os pedidos são criados agrupando os produtos selecionados por fornecedor.
      </p>
    </div>
  );
}
