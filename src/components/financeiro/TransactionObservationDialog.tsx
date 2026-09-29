import { useState, useEffect } from "react";
import { Eye, Pencil, Save, X, FileText, Calendar, Building2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateTransactionNotes } from "@/lib/financeiro";
import type { FinancialTransaction } from "@/lib/financeiro-types";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

interface TransactionObservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinancialTransaction | null;
  canWrite: boolean;
}

export function TransactionObservationDialog({
  open,
  onOpenChange,
  transaction,
  canWrite,
}: TransactionObservationDialogProps) {
  const updateNotesMutation = useUpdateTransactionNotes();

  const [isEditing, setIsEditing] = useState(false);
  const [notesInput, setNotesInput] = useState("");

  useEffect(() => {
    if (transaction) {
      setNotesInput(transaction.notes || "");
      setIsEditing(!transaction.notes);
    }
  }, [transaction, open]);

  if (!transaction) return null;

  const handleSaveNotes = async () => {
    if (!canWrite) {
      toast.error("Você não tem permissão para editar lançamentos.");
      return;
    }

    try {
      await updateNotesMutation.mutateAsync({
        id: transaction.id,
        notes: notesInput.trim() || null,
      });

      toast.success("Observação atualizada com sucesso!");
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar observação.";
      toast.error(msg);
    }
  };

  const hasNotes = Boolean(transaction.notes && transaction.notes.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 bg-background">
        <DialogHeader className="space-y-1.5 border-b pb-3 text-left">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              Observações da Conta
            </DialogTitle>
            <Badge
              variant={transaction.status === "pago" ? "default" : "secondary"}
              className="text-[10px] uppercase font-bold"
            >
              {transaction.status}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {transaction.supplier_name || transaction.description || "Sem identificação"}
            </span>
            <span>•</span>
            <span className="font-bold text-foreground">{formatCurrency(transaction.amount)}</span>
            <span>•</span>
            <span>Vencimento: {transaction.due_date}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          {isEditing ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Escreva ou edite a observação da conta:
              </label>
              <Textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Ex: Pagamento acordado com desconto, aguardando envio do boleto atualizado..."
                rows={5}
                className="text-xs leading-relaxed resize-y"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border bg-muted/30 p-3.5 sm:p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap min-h-[100px] select-text">
                {hasNotes ? (
                  transaction.notes
                ) : (
                  <p className="text-muted-foreground italic">
                    Nenhuma observação cadastrada para este lançamento.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div>
            {!isEditing && canWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 text-xs gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                {hasNotes ? "Editar Observação" : "Adicionar Observação"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing && hasNotes && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNotesInput(transaction.notes || "");
                  setIsEditing(false);
                }}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
            )}

            {isEditing ? (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNotes}
                disabled={updateNotesMutation.isPending}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Fechar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
