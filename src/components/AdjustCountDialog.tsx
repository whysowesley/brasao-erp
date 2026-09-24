import { useEffect, useMemo, useState } from "react";
import { AlertCircle, History, RotateCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adjustStockCount, type StockCountRow } from "@/lib/data";
import { formatDateTime, formatQty } from "@/lib/inventory";
import { useMe } from "@/lib/auth";

interface AdjustCountDialogProps {
  count: StockCountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ItemEditState {
  productId: string;
  description: string;
  unit: string;
  expected: number;
  originalCounted: number;
  newCountedStr: string;
}

export function AdjustCountDialog({
  count,
  open,
  onOpenChange,
  onSuccess,
}: AdjustCountDialogProps) {
  const { data: me } = useMe();
  const [items, setItems] = useState<ItemEditState[]>([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!count) {
      setItems([]);
      setReason("");
      return;
    }

    const initial = (count.stock_count_items || []).map((it) => ({
      productId: it.product_id,
      description: it.products?.description || "Produto",
      unit: it.products?.unit || "UN",
      expected: it.expected_quantity,
      originalCounted: it.counted_quantity,
      newCountedStr: String(it.counted_quantity),
    }));

    setItems(initial);
    setReason("");
    setSearch("");
  }, [count, open]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((it) => it.description.toLowerCase().includes(term));
  }, [items, search]);

  const changesCount = useMemo(() => {
    return items.filter((it) => {
      const parsed = Number(it.newCountedStr.replace(",", "."));
      return !isNaN(parsed) && parsed !== it.originalCounted;
    }).length;
  }, [items]);

  const handleQtyChange = (productId: string, val: string) => {
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, newCountedStr: val } : it)),
    );
  };

  const handleResetItem = (productId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId ? { ...it, newCountedStr: String(it.originalCounted) } : it,
      ),
    );
  };

  const handleSave = async () => {
    if (!count) return;

    if (changesCount === 0) {
      toast.info("Nenhuma quantidade foi alterada nesta contagem.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Informe a justificativa/motivo da alteração para o registro de auditoria.");
      return;
    }

    // Validações
    const alteredList: Array<{ productId: string; newCounted: number }> = [];
    for (const it of items) {
      const parsed = Number(it.newCountedStr.replace(",", "."));
      if (isNaN(parsed) || parsed < 0) {
        toast.error(`Quantidade inválida para o produto "${it.description}".`);
        return;
      }
      if (parsed !== it.originalCounted) {
        alteredList.push({
          productId: it.productId,
          newCounted: parsed,
        });
      }
    }

    setIsSaving(true);
    try {
      await adjustStockCount(count.id, alteredList, reason.trim(), {
        name: me?.fullName,
        email: me?.email,
        userId: me?.userId,
      });

      toast.success(
        `Contagem ajustada com sucesso! ${alteredList.length} produto(s) atualizados com registro de auditoria.`,
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message || "Erro ao salvar alteração da contagem.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!count) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <DialogTitle>Alterar / Ajustar Contagem de Estoque</DialogTitle>
          </div>
          <DialogDescription>
            Contagem original realizada em <strong>{formatDateTime(count.counted_at)}</strong> por{" "}
            <strong>{count.user_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> Ao corrigir a quantidade contada, a diferença será recalculada
            e o estoque atual do produto será ajustado no sistema. Um registro no histórico de
            auditoria será vinculado ao seu usuário.
          </div>
        </div>

        <div className="flex items-center gap-3 my-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar produtos desta contagem..."
              className="pl-9 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {changesCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {changesCount} produto(s) alterado(s)
              </span>
            ) : (
              "Nenhuma alteração"
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-md border max-h-[340px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  <span className="hidden sm:inline">Qtd Esperada</span>
                  <span className="sm:hidden">Esperado</span>
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  <span className="hidden sm:inline">Contada Anterior</span>
                  <span className="sm:hidden">Ant.</span>
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  <span className="hidden sm:inline">Nova Quantidade Contada</span>
                  <span className="sm:hidden">Nova Qtd</span>
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  <span className="hidden sm:inline">Nova Diferença</span>
                  <span className="sm:hidden">Dif.</span>
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((it) => {
                const parsedNew = Number(it.newCountedStr.replace(",", "."));
                const isChanged = !isNaN(parsedNew) && parsedNew !== it.originalCounted;
                const newDiff = !isNaN(parsedNew) ? parsedNew - it.expected : null;

                return (
                  <TableRow
                    key={it.productId}
                    className={isChanged ? "bg-amber-500/5 dark:bg-amber-500/10" : ""}
                  >
                    <TableCell className="font-medium text-xs">
                      <div>{it.description}</div>
                      <span className="text-[10px] text-muted-foreground">Unidade: {it.unit}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs num text-muted-foreground">
                      {formatQty(it.expected, it.unit)}
                    </TableCell>
                    <TableCell className="text-right text-xs num">
                      {formatQty(it.originalCounted, it.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className={`num ml-auto h-7 w-24 text-right text-xs font-semibold ${
                          isChanged ? "border-amber-500 ring-1 ring-amber-500" : ""
                        }`}
                        inputMode="decimal"
                        value={it.newCountedStr}
                        onChange={(e) => handleQtyChange(it.productId, e.target.value)}
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-semibold num ${
                        newDiff === null
                          ? ""
                          : newDiff < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : newDiff > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {newDiff === null
                        ? "—"
                        : `${newDiff > 0 ? "+" : ""}${formatQty(newDiff, it.unit)}`}
                    </TableCell>
                    <TableCell>
                      {isChanged && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          title="Restaurar valor original"
                          onClick={() => handleResetItem(it.productId)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                    Nenhum item encontrado no filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1.5 mt-2">
          <Label htmlFor="adjust-reason" className="text-xs font-semibold">
            Motivo do Ajuste / Justificativa <span className="text-rose-500">*</span>
          </Label>
          <Textarea
            id="adjust-reason"
            rows={2}
            className="text-xs"
            placeholder="Ex: Erro de digitação na contagem de carnes; conferência no segundo freezer realizada após o fechamento."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            O motivo e seu usuário ({me?.fullName || me?.email || "Você"}) ficarão permanentemente
            registrados no log de auditoria desta contagem.
          </p>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || changesCount === 0 || !reason.trim()}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando e recalculando..." : `Salvar Ajuste (${changesCount} alteração)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
