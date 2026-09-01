import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PlanInput } from "@/components/PlanInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { recordStockCount, useInvalidateAll, useProducts } from "@/lib/data";
import { formatQty } from "@/lib/inventory";
import {
  parseWhatsAppStockMessage,
  unitsAreCompatible,
  type ParsedStockItem,
} from "@/lib/whatsapp-stock-parser";

const SAMPLE_WHATSAPP_TEXT = `ABÓBORA: 2 PORÇÃO
ALFACE: 1 UND
ALHO: 13kg KG
BATATA INGLESA: 0 SACO
BETERRABA: 3 UND
CEBOLA: 0 CX
CENOURA: 1 PORÇÃO
CHUCHU: 4 UND
COENTRO: 2 saco 
COLORAU: 5 UND
FARINHA DE ROSCA: 4.370KG
LARANJA: 0 UND
LIMÃO: 0 UND
LOURO: 1.390 GRAMA
MACAXEIRA: 15 KG
ORÉGANO: 0.890 GRAMA
OVOS: 5 BDJ
PIMENTA DE CHEIRO: 13UND
PIMENTÃO: 1 PORÇÃO
REPOLHO: 3 PORÇÃO
TEMPERO: 2.060 KG
TOMATE: 0 CX
VINAGRE: 33 UND`;

interface WhatsAppStockImportDialogProps {
  triggerButton?: React.ReactNode;
  onApplyToTable?: (values: Record<string, string>) => void;
  defaultOpen?: boolean;
}

function isReadyForImport(item: ParsedStockItem, duplicateProductIds: Set<string>): boolean {
  return Boolean(
    item.selectedProductId &&
    item.matchedProduct &&
    unitsAreCompatible(item.detectedUnit, item.matchedProduct.unit) &&
    !duplicateProductIds.has(item.selectedProductId),
  );
}

export function WhatsAppStockImportDialog({
  triggerButton,
  onApplyToTable,
  defaultOpen = false,
}: WhatsAppStockImportDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [rawText, setRawText] = useState("");
  const [notes, setNotes] = useState("Contagem de estoque importada via WhatsApp");
  const [items, setItems] = useState<ParsedStockItem[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "mapped" | "unmapped">("all");

  const { data: products } = useProducts();
  const invalidate = useInvalidateAll();

  // Quando o texto mudar, analisa as linhas
  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim() || !products) {
      setItems([]);
      return;
    }
    const parsed = parseWhatsAppStockMessage(text, products);
    setItems(parsed);
  };

  const handlePasteExample = () => {
    handleTextChange(SAMPLE_WHATSAPP_TEXT);
  };

  const handleClear = () => {
    setRawText("");
    setItems([]);
  };

  // Alterar produto associado
  const handleSelectProduct = (itemId: string, productId: string) => {
    const product = (products ?? []).find((p) => p.id === productId) || null;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          matchedProduct: product,
          selectedProductId: productId === "none" ? null : productId,
          matchType: productId === "none" ? "none" : "high",
        };
      }),
    );
  };

  // Alterar quantidade manualmente na tabela de conferência
  const handleUpdateQty = (itemId: string, newQty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          parsedQty: newQty,
          rawQtyStr: String(newQty),
        };
      }),
    );
  };

  // Remover item da lista
  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const duplicateProductIds = useMemo(() => {
    const occurrences = new Map<string, number>();

    items.forEach((item) => {
      if (item.selectedProductId && item.matchedProduct) {
        occurrences.set(item.selectedProductId, (occurrences.get(item.selectedProductId) ?? 0) + 1);
      }
    });

    return new Set(
      [...occurrences.entries()].filter(([, count]) => count > 1).map(([productId]) => productId),
    );
  }, [items]);

  // Estatísticas da identificação e da validação
  const stats = useMemo(() => {
    const total = items.length;
    const mapped = items.filter((item) => isReadyForImport(item, duplicateProductIds)).length;
    const unmapped = total - mapped;
    const exact = items.filter((it) => it.matchType === "exact").length;
    const high = items.filter((it) => it.matchType === "high").length;
    const fuzzy = items.filter((it) => it.matchType === "fuzzy").length;
    const unitMismatches = items.filter(
      (item) =>
        item.selectedProductId &&
        item.matchedProduct &&
        !unitsAreCompatible(item.detectedUnit, item.matchedProduct.unit),
    ).length;
    const duplicates = items.filter(
      (item) => item.selectedProductId && duplicateProductIds.has(item.selectedProductId),
    ).length;

    return { total, mapped, unmapped, exact, high, fuzzy, unitMismatches, duplicates };
  }, [duplicateProductIds, items]);

  // Lista filtrada para visualização
  const filteredItems = useMemo(() => {
    if (filterMode === "mapped") {
      return items.filter((item) => isReadyForImport(item, duplicateProductIds));
    }
    if (filterMode === "unmapped") {
      return items.filter((item) => !isReadyForImport(item, duplicateProductIds));
    }
    return items;
  }, [duplicateProductIds, items, filterMode]);

  // Ação 1: Preencher na tabela da página de contagens
  const handleFillTable = () => {
    if (!onApplyToTable) return;
    if (stats.unitMismatches > 0 || stats.duplicates > 0) {
      toast.error("Corrija as unidades divergentes e os produtos duplicados antes de continuar.");
      return;
    }
    if (stats.unmapped > 0) {
      toast.error("Vincule ou remova todos os itens pendentes antes de continuar.");
      return;
    }

    const tableValues: Record<string, string> = {};
    const validItems = items.filter((item) => isReadyForImport(item, duplicateProductIds));

    validItems.forEach((item) => {
      tableValues[item.selectedProductId!] = String(item.parsedQty);
    });

    if (validItems.length === 0) {
      toast.error("Nenhum produto correspondente para preencher na tabela.");
      return;
    }

    onApplyToTable(tableValues);
    toast.success(`${validItems.length} quantidade(s) preenchida(s) na tabela de contagem.`);
    setOpen(false);
  };

  // Ação 2: Atualizar estoque no banco de dados e gravar histórico de contagem
  const handleDirectUpdateStock = async () => {
    if (stats.unitMismatches > 0 || stats.duplicates > 0) {
      toast.error("Corrija as unidades divergentes e os produtos duplicados antes de continuar.");
      return;
    }
    if (stats.unmapped > 0) {
      toast.error("Vincule ou remova todos os itens pendentes antes de continuar.");
      return;
    }

    const validItems = items.filter((item) => isReadyForImport(item, duplicateProductIds));

    if (validItems.length === 0) {
      toast.error("Nenhum produto válido mapeado para atualizar.");
      return;
    }

    setIsApplying(true);
    try {
      const itemsToRecord: Array<{ productId: string; expected: number; counted: number }> = [];

      for (const it of validItems) {
        const prod = it.matchedProduct!;
        const counted = it.parsedQty;
        const expected = Number(prod.current_stock) || 0;

        itemsToRecord.push({
          productId: prod.id,
          expected,
          counted,
        });
      }

      await recordStockCount(notes.trim() || "Importação de contagem via WhatsApp", itemsToRecord);

      invalidate();
      toast.success(
        `Estoque atualizado com sucesso! ${validItems.length} produto(s) atualizado(s) e contagem registrada no histórico.`,
      );
      setOpen(false);
      handleClear();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            className="gap-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Importar do WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0 sm:max-h-[85vh]">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Importar Contagem de Estoque via WhatsApp / Texto
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cole a mensagem de texto do WhatsApp. O sistema reconhece os itens, quantias e
                unidades, associando aos produtos do cadastro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(85vh-140px)] space-y-4 overflow-y-auto px-6 py-4">
          {/* Caixa de Texto */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="whatsapp-text"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                1. Cole a mensagem do WhatsApp
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handlePasteExample}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Preencher Exemplo
                </Button>
                {rawText && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleClear}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="whatsapp-text"
              rows={4}
              placeholder={`Cole aqui a lista enviada pelo WhatsApp, por exemplo:\nABÓBORA: 2 PORÇÃO\nALFACE: 1 UND\nALHO: 13kg KG\nBATATA INGLESA: 0 SACO\nFARINHA DE ROSCA: 4.370KG\nORÉGANO: 0.890 GRAMA`}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Estatísticas e Reconhecimento */}
          {items.length > 0 && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">Resumo do Reconhecimento:</span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {stats.mapped} identificado(s)
                  </Badge>
                  {stats.unmapped > 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    >
                      <HelpCircle className="mr-1 h-3 w-3" />
                      {stats.unmapped} pendente(s)
                    </Badge>
                  )}
                  {stats.unitMismatches > 0 && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {stats.unitMismatches} unidade(s) divergente(s)
                    </Badge>
                  )}
                  {stats.duplicates > 0 && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {stats.duplicates} linha(s) duplicada(s)
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Total lido: {stats.total} linha(s)
                  </span>
                </div>

                {/* Filtros de visualização */}
                <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded px-2 py-1 transition-colors ${
                      filterMode === "all"
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("mapped")}
                    className={`rounded px-2 py-1 transition-colors ${
                      filterMode === "mapped"
                        ? "bg-emerald-600 font-medium text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Identificados ({stats.mapped})
                  </button>
                  {stats.unmapped > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode("unmapped")}
                      className={`rounded px-2 py-1 transition-colors ${
                        filterMode === "unmapped"
                          ? "bg-amber-600 font-medium text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Pendentes ({stats.unmapped})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Conferência dos Itens */}
          {items.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Conferência e Vinculação com Produtos do Estoque
              </Label>
              <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[180px]">Texto Lido</TableHead>
                        <TableHead className="min-w-[220px]">Produto no Sistema</TableHead>
                        <TableHead className="w-[110px] text-right">Qtd Lida</TableHead>
                        <TableHead className="w-[100px] text-right">Estoque Atual</TableHead>
                        <TableHead className="w-[100px] text-right">Diferença</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const product = item.selectedProductId ? item.matchedProduct : null;
                        const suggestedProduct =
                          item.matchType !== "exact" && !item.selectedProductId
                            ? item.matchedProduct
                            : null;
                        const hasUnitMismatch = Boolean(
                          product && !unitsAreCompatible(item.detectedUnit, product.unit),
                        );
                        const isDuplicate = Boolean(
                          item.selectedProductId && duplicateProductIds.has(item.selectedProductId),
                        );
                        const currentStock = product ? Number(product.current_stock) || 0 : null;
                        const diff = currentStock !== null ? item.parsedQty - currentStock : null;

                        return (
                          <TableRow
                            key={item.id}
                            className={
                              !item.selectedProductId || hasUnitMismatch || isDuplicate
                                ? "bg-amber-500/5"
                                : undefined
                            }
                          >
                            <TableCell className="py-2 font-mono text-xs font-medium">
                              <span title={item.rawLine}>{item.rawName}</span>
                              {item.detectedUnit && (
                                <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                  ({item.detectedUnit})
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="py-2">
                              <div className="flex items-center gap-1.5">
                                <Select
                                  value={item.selectedProductId || "none"}
                                  onValueChange={(val) => handleSelectProduct(item.id, val)}
                                >
                                  <SelectTrigger
                                    className={`h-8 text-xs ${!product ? "border-amber-400 bg-amber-50/50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200" : ""}`}
                                  >
                                    <SelectValue placeholder="Selecione o produto..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    <SelectItem
                                      value="none"
                                      className="text-xs text-muted-foreground"
                                    >
                                      — Não vincular (ignorar) —
                                    </SelectItem>
                                    {(products ?? []).map((p) => (
                                      <SelectItem key={p.id} value={p.id} className="text-xs">
                                        {p.description} {p.unit ? `(${p.unit})` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {item.matchType === "exact" && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700"
                                  >
                                    100%
                                  </Badge>
                                )}
                                {item.matchType === "high" && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-blue-500/20 bg-blue-500/10 px-1.5 text-[10px] text-blue-700"
                                  >
                                    Alta
                                  </Badge>
                                )}
                                {item.matchType === "fuzzy" && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] text-amber-700"
                                  >
                                    Aproximada
                                  </Badge>
                                )}
                                {hasUnitMismatch && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive"
                                  >
                                    Unidade divergente
                                  </Badge>
                                )}
                                {isDuplicate && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive"
                                  >
                                    Duplicado
                                  </Badge>
                                )}
                              </div>
                              {suggestedProduct && (
                                <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                                  Sugestão: {suggestedProduct.description}. Confirme no seletor.
                                </p>
                              )}
                              {hasUnitMismatch && product && (
                                <p className="mt-1 text-[10px] text-destructive">
                                  A mensagem usa {item.detectedUnit}; o cadastro usa {product.unit}.
                                </p>
                              )}
                            </TableCell>

                            <TableCell className="py-2 text-right">
                              <PlanInput
                                className="num ml-auto h-8 w-20 text-right text-xs"
                                value={item.parsedQty}
                                onChange={(val) => handleUpdateQty(item.id, val)}
                              />
                            </TableCell>

                            <TableCell className="num py-2 text-right text-xs text-muted-foreground">
                              {product ? formatQty(product.current_stock, product.unit) : "—"}
                            </TableCell>

                            <TableCell
                              className={`num py-2 text-right text-xs font-semibold ${
                                diff === null
                                  ? "text-muted-foreground"
                                  : diff > 0
                                    ? "text-success"
                                    : diff < 0
                                      ? "text-critical"
                                      : "text-muted-foreground"
                              }`}
                            >
                              {diff === null
                                ? "—"
                                : `${diff > 0 ? "+" : ""}${formatQty(diff, product?.unit)}`}
                            </TableCell>

                            <TableCell className="py-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                                title="Remover item da importação"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center text-muted-foreground">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhum item analisado ainda</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Cole a mensagem de texto no campo acima ou clique em &quot;Preencher Exemplo&quot;
                para testar a leitura inteligente.
              </p>
            </div>
          )}

          {/* Observações da Contagem */}
          {items.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="import-notes" className="text-xs text-muted-foreground">
                Observação do registro de contagem:
              </Label>
              <Input
                id="import-notes"
                className="h-8 text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Contagem realizada em 31/08 via WhatsApp"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isApplying}
          >
            Cancelar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {onApplyToTable && (
              <Button
                type="button"
                variant="outline"
                onClick={handleFillTable}
                disabled={isApplying || stats.mapped === 0}
                className="gap-1.5"
                title="Transfere as quantidades para a tabela da tela para conferir antes de salvar"
              >
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Preencher na Tabela de Contagem ({stats.mapped})
              </Button>
            )}

            <Button
              type="button"
              onClick={handleDirectUpdateStock}
              disabled={isApplying || stats.mapped === 0}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Atualizando estoque...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Atualizar Estoque dos Produtos Agora ({stats.mapped})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
