import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Edit3, History, Save, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { AdjustCountDialog } from "@/components/AdjustCountDialog";
import { PageHeader } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { WhatsAppStockImportDialog } from "@/components/WhatsAppStockImportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useMe } from "@/lib/auth";
import {
  recordStockCount,
  useCounts,
  useInvalidateAll,
  useProducts,
  useRules,
  type StockCountRow,
} from "@/lib/data";
import {
  computeProduct,
  DEFAULT_RULES,
  formatDateTime,
  formatQty,
  getDayOfWeekFromDate,
} from "@/lib/inventory";
import { usePostOperationMode } from "@/lib/post-operation";
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
  const { data: me } = useMe();
  const { isCounter } = useAuth();
  const { data: products } = useProducts();
  const { data: counts } = useCounts();
  const { data: rules } = useRules();
  const invalidate = useInvalidateAll();
  const [isPostOperation, setIsPostOperation] = usePostOperationMode();
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { plan, setPlanned } = usePurchasePlan();

  // Estados para alteração/ajuste e expansão de detalhes
  const [adjustingCount, setAdjustingCount] = useState<StockCountRow | null>(null);
  const [expandedCountIds, setExpandedCountIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedCountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

      await recordStockCount(notes.trim() || null, itemsToRecord, {
        name: me?.fullName,
        email: me?.email,
        userId: me?.userId,
      });

      setValues({});
      setNotes("");
      invalidate();
      toast.success("Contagem registrada com sucesso e estoque atualizado!");
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
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs cursor-pointer shadow-xs hover:bg-muted/40 transition-colors"
              onClick={() => setIsPostOperation(!isPostOperation)}
              title="Pós-operação: o dia de hoje já encerrou e foi consumido. O estoque contado atenderá a partir de amanhã até a 2ª feira. Ex: Sábado à noite conta 2 dias de consumo (Dom e Seg) em vez de 3."
            >
              <Switch
                id="post-op-contagens"
                checked={isPostOperation}
                onCheckedChange={setIsPostOperation}
                onClick={(e) => e.stopPropagation()}
              />
              <Label
                htmlFor="post-op-contagens"
                className="cursor-pointer font-medium select-none text-[11px] leading-tight text-foreground"
              >
                {isPostOperation
                  ? "Pós-operação (Hoje já usado)"
                  : "Pré-operação (Hoje ainda será usado)"}
              </Label>
            </div>
            <WhatsAppStockImportDialog
              onApplyToTable={(newValues) => {
                setValues((prev) => ({ ...prev, ...newValues }));
              }}
            />
            <Button onClick={confirm} disabled={saving || filled.length === 0}>
              <Save className="h-4 w-4" /> Confirmar contagem ({filled.length})
            </Button>
          </div>
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
                {!isCounter && <TableHead className="text-right">Quero comprar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const raw = values[p.id] ?? "";
                const hasCount = raw.trim() !== "";
                const countedNum = hasCount
                  ? Number(raw.replace(",", ".")) || 0
                  : Number(p.current_stock);
                const diff = hasCount ? countedNum - Number(p.current_stock) : null;
                const computedItem = computeProduct(
                  { ...p, current_stock: countedNum },
                  rules ?? DEFAULT_RULES,
                  0,
                  getDayOfWeekFromDate(),
                  isPostOperation,
                  hasCount,
                );
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
                    {!isCounter && (
                      <TableCell className="text-right">
                        <PlanInput
                          className="num ml-auto h-8 w-24 text-right"
                          value={plan[p.id] ?? computedItem.suggestedPurchase}
                          onChange={(val) => setPlanned(p.id, val)}
                        />
                        <div
                          className="text-[10px] text-muted-foreground mt-0.5"
                          title={`Saldo 2ª: ${formatQty(computedItem.projectedCycleEndStock, p.unit)} (${computedItem.remainingDaysLabel})`}
                        >
                          sug: {formatQty(computedItem.suggestedPurchase, p.unit)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Contagens Anteriores &amp; Histórico Auditado</h2>
          <p className="text-xs text-muted-foreground">
            Visualize lançamentos passados, consulte a auditoria de alterações ou corrija
            quantidades digitadas erroneamente.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {counts?.map((c) => {
          const isExpanded = expandedCountIds.has(c.id);
          const hasAudits = Boolean(c.audit_logs && c.audit_logs.length > 0);

          return (
            <div
              key={c.id}
              className="rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {formatDateTime(c.counted_at)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {c.stock_count_items?.length ?? 0} item(ns)
                    </Badge>
                    {hasAudits && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        <History className="h-3 w-3 mr-1" />
                        {c.audit_logs?.length} alteração(ões) auditada(s)
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Responsável: <strong>{c.user_name}</strong>
                      {c.user_email ? ` (${c.user_email})` : ""}
                    </span>
                  </div>
                  {c.notes && (
                    <p className="text-xs text-muted-foreground italic">Observação: {c.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => toggleExpand(c.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span>Ver Itens</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 text-xs font-medium border border-border"
                    onClick={() => setAdjustingCount(c)}
                    title="Corrigir quantidade digitada nesta contagem"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-primary" />
                    <span>Alterar Contagem</span>
                  </Button>
                </div>
              </div>

              {/* Seção expandida de itens e auditoria */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Produtos Lançados nesta Contagem
                    </h3>
                    <div className="rounded-md border max-h-60 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-right text-xs">Estoque Anterior</TableHead>
                            <TableHead className="text-right text-xs">Qtd Contada</TableHead>
                            <TableHead className="text-right text-xs">Diferença Gerada</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {c.stock_count_items.map((it) => {
                            const diff = it.difference;
                            return (
                              <TableRow key={it.id}>
                                <TableCell className="text-xs font-medium">
                                  {it.products?.description || "Produto"}
                                </TableCell>
                                <TableCell className="text-right text-xs num text-muted-foreground">
                                  {formatQty(it.expected_quantity, it.products?.unit || "UN")}
                                </TableCell>
                                <TableCell className="text-right text-xs num font-semibold">
                                  {formatQty(it.counted_quantity, it.products?.unit || "UN")}
                                </TableCell>
                                <TableCell
                                  className={`text-right text-xs font-semibold num ${
                                    diff < 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : diff > 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {diff > 0 ? "+" : ""}
                                  {formatQty(diff, it.products?.unit || "UN")}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Log de Auditoria de quem alterou */}
                  {hasAudits && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>Histórico de Alterações / Ajustes (Log de Auditoria)</span>
                      </div>
                      <div className="space-y-2">
                        {c.audit_logs?.map((audit, aIdx) => (
                          <div
                            key={aIdx}
                            className="rounded-md border bg-card p-2.5 text-xs shadow-xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                              <span>
                                <strong>Data do Ajuste:</strong> {formatDateTime(audit.adjusted_at)}
                              </span>
                              <span>
                                <strong>Quem Alterou:</strong> {audit.user_name}
                                {audit.user_email ? ` (${audit.user_email})` : ""}
                              </span>
                            </div>
                            <div className="text-xs">
                              <span className="font-semibold text-foreground">Justificativa: </span>
                              <span className="text-muted-foreground italic">"{audit.reason}"</span>
                            </div>
                            {audit.items_changed && audit.items_changed.length > 0 && (
                              <div className="mt-1 pt-1 border-t text-[11px] space-y-0.5">
                                <span className="font-semibold text-foreground">
                                  Itens retificados:
                                </span>
                                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                                  {audit.items_changed.map((ic, iIdx) => (
                                    <li key={iIdx}>
                                      <strong>{ic.product_description}</strong>: alterado de{" "}
                                      <span className="line-through">
                                        {formatQty(ic.previous_counted, ic.unit)}
                                      </span>{" "}
                                      para{" "}
                                      <strong className="text-foreground">
                                        {formatQty(ic.new_counted, ic.unit)}
                                      </strong>{" "}
                                      (impacto no estoque:{" "}
                                      <span
                                        className={
                                          ic.difference_delta > 0
                                            ? "text-emerald-600 font-semibold"
                                            : "text-rose-600 font-semibold"
                                        }
                                      >
                                        {ic.difference_delta > 0 ? "+" : ""}
                                        {formatQty(ic.difference_delta, ic.unit)}
                                      </span>
                                      )
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(counts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma contagem registrada ainda.</p>
        )}
      </div>

      {/* Diálogo de alteração de contagem com auditoria */}
      <AdjustCountDialog
        count={adjustingCount}
        open={Boolean(adjustingCount)}
        onOpenChange={(isOpen) => !isOpen && setAdjustingCount(null)}
        onSuccess={() => {
          invalidate();
        }}
      />
    </div>
  );
}
