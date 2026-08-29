import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { recordStockCount, useCounts, useInvalidateAll, useProducts } from "@/lib/data";
import { formatDateTime, formatQty } from "@/lib/inventory";
import { usePurchasePlan } from "@/lib/purchase-plan";

export const Route = createFileRoute("/_authenticated/contagens")({
  head: () => ({
    meta: [
      { title: "Contagens de Estoque | Brasão" },
      {
        name: "description",
        content:
          "Realize contagens periódicas do estoque da Brasão, registre diferenças e atualize o estoque automaticamente.",
      },
      { property: "og:title", content: "Contagens de Estoque | Brasão" },
      {
        property: "og:description",
        content: "Nova contagem com cálculo automático de diferenças e histórico completo.",
      },
    ],
  }),
  component: ContagensPage,
});

function ContagensPage() {
  const { data: products } = useProducts();
  const { data: counts } = useCounts();
  const invalidate = useInvalidateAll();
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { plan, setPlanned } = usePurchasePlan();

  const rows = useMemo(() => {
    const list = products ?? [];
    if (!search.trim()) return list;
    return list.filter((p) => p.description.toLowerCase().includes(search.trim().toLowerCase()));
  }, [products, search]);

  const filled = Object.entries(values).filter(([, v]) => v.trim() !== "");

  async function confirm() {
    if (filled.length === 0) {
      toast.error("Informe ao menos uma quantidade encontrada.");
      return;
    }
    setSaving(true);
    try {
      const itemsToRecord: Array<{ productId: string; expected: number; counted: number }> = [];
      for (const [productId, raw] of filled) {
        const product = (products ?? []).find((p) => p.id === productId);
        if (!product) continue;
        const counted = Number(raw.replace(",", ".")) || 0;
        const expected = Number(product.current_stock);
        itemsToRecord.push({
          productId,
          expected,
          counted,
        });
      }

      await recordStockCount(notes.trim() || null, itemsToRecord);

      setValues({});
      setNotes("");
      invalidate();
      toast.success("Contagem registrada e estoque atualizado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Nova Contagem"
        description="Informe a quantidade encontrada. A diferença é calculada e registrada no histórico."
        actions={
          <Button onClick={confirm} disabled={saving || filled.length === 0}>
            <Save className="h-4 w-4" /> Confirmar contagem ({filled.length})
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Textarea
          rows={1}
          placeholder="Observação da contagem"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Estoque registrado</TableHead>
                <TableHead className="text-right">Quantidade encontrada</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Quero comprar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const raw = values[p.id] ?? "";
                const diff =
                  raw.trim() === ""
                    ? null
                    : (Number(raw.replace(",", ".")) || 0) - Number(p.current_stock);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell className="num text-right">
                      {formatQty(p.current_stock, p.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="num ml-auto h-8 w-28 text-right"
                        inputMode="decimal"
                        value={raw}
                        onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell
                      className={`num text-right font-medium ${
                        diff === null ? "" : diff < 0 ? "text-critical" : "text-success"
                      }`}
                    >
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff, p.unit)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="num ml-auto h-8 w-24 text-right"
                        inputMode="decimal"
                        value={String(plan[p.id] ?? p.suggestedPurchase)}
                        onChange={(e) =>
                          setPlanned(p.id, Number(e.target.value.replace(",", ".")) || 0)
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Contagens anteriores</h2>
      <div className="space-y-3">
        {counts?.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{formatDateTime(c.counted_at)}</p>
              <p className="text-xs text-muted-foreground">
                {c.stock_count_items?.length ?? 0} item(ns) · {c.user_name}
              </p>
            </div>
            {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
          </div>
        ))}
        {(counts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma contagem registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
