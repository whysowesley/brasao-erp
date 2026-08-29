import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  CreditCard,
  Building2,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  usePaymentMethods,
  usePayFinancialTransaction,
  getTransactionDisplayTitle,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction } from "@/lib/financeiro-types";

interface MarcarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinancialTransaction | null;
}

export function MarcarPagoDialog({ open, onOpenChange, transaction }: MarcarPagoDialogProps) {
  const { canWrite, isApproved } = useAuth();
  const payMutation = usePayFinancialTransaction();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: suppliers = [] } = useSuppliers();

  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  const isSubmitting = payMutation.isPending;

  const supplierDetails = transaction?.supplier_id
    ? suppliers.find((s) => s.id === transaction.supplier_id)
    : null;

  useEffect(() => {
    if (transaction) {
      setPaymentDate(new Date());
      // Sugere o valor original da dívida como valor pago
      setPaidAmount(String(transaction.amount));
      setPaymentMethodId(transaction.payment_method_id || "none");
      setNotes(transaction.notes || "");
    }
  }, [transaction, open]);

  if (!transaction) return null;

  const isDespesa = transaction.type === "despesa";
  const formattedOriginalAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(transaction.amount);

  let formattedDueDate = transaction.due_date;
  try {
    formattedDueDate = format(parseISO(transaction.due_date), "dd/MM/yyyy", {
      locale: ptBR,
    });
  } catch {
    // data bruta
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para quitar lançamentos.");
      return;
    }

    const parsedPaidAmount = parseFloat(paidAmount.replace(",", "."));
    if (isNaN(parsedPaidAmount) || parsedPaidAmount <= 0) {
      toast.error("Informe um valor pago válido maior que zero.");
      return;
    }

    const formattedPaymentDate = format(paymentDate, "yyyy-MM-dd");

    try {
      await payMutation.mutateAsync({
        id: transaction.id,
        payment_date: formattedPaymentDate,
        paid_amount: parsedPaidAmount,
        payment_method_id: paymentMethodId !== "none" ? paymentMethodId : null,
        notes: notes.trim() || null,
      });

      toast.success(
        isDespesa ? "Pagamento registrado com sucesso!" : "Recebimento confirmado com sucesso!",
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao registrar quitação.";
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="marcar-pago-dialog-content"
        className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2
                className={`h-5 w-5 ${isDespesa ? "text-rose-500" : "text-emerald-500"}`}
              />
              {isDespesa ? "Confirmar Pagamento" : "Confirmar Recebimento"}
            </DialogTitle>
            <DialogDescription>
              Informe os dados da efetivação deste lançamento para dar baixa.
            </DialogDescription>
          </DialogHeader>

          {/* Cartão de Resumo do Lançamento */}
          <div className="my-4 rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-foreground">
                  {getTransactionDisplayTitle(transaction)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />
                  {transaction.supplier_name ||
                    transaction.supplier?.name ||
                    "Sem fornecedor informado"}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  isDespesa
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {isDespesa ? "A Pagar" : "A Receber"}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/60 text-xs">
              <span className="text-muted-foreground">
                Vencimento: <strong>{formattedDueDate}</strong>
              </span>
              <span className="text-muted-foreground">
                Valor Previsto:{" "}
                <strong className="text-foreground text-sm">{formattedOriginalAmount}</strong>
              </span>
            </div>

            {supplierDetails && (supplierDetails.pix_key || supplierDetails.bank_name) && (
              <div className="pt-2 border-t border-border/60 text-xs space-y-1 bg-background/50 p-2 rounded">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3 text-primary" />
                  <span>Dados para Pagamento do Fornecedor:</span>
                </p>
                {supplierDetails.pix_key && (
                  <p className="text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                    PIX: {supplierDetails.pix_key}
                  </p>
                )}
                {supplierDetails.bank_name && (
                  <p className="text-muted-foreground text-[11px]">
                    Banco: {supplierDetails.bank_name}
                    {supplierDetails.bank_agency ? ` | Ag: ${supplierDetails.bank_agency}` : ""}
                    {supplierDetails.bank_account ? ` | CC: ${supplierDetails.bank_account}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 py-2">
            {/* Data do Pagamento e Valor Pago */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Data Efetiva <span className="text-rose-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="pay-date-btn"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {paymentDate ? (
                        format(paymentDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(d) => d && setPaymentDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">
                  Valor Efetivo (R$) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Forma de Pagamento Utilizada */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Forma de Pagamento Utilizada
              </Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger id="pay-method-select">
                  <SelectValue placeholder="Selecione a forma..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informada / Outra</SelectItem>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações da Baixa */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-notes">Observações do Pagamento</Label>
              <Textarea
                id="pay-notes"
                placeholder="Ex: Pago via PIX pelo banco X com desconto de R$ 5,00..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              id="btn-confirm-pay"
              className={
                isDespesa
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
              disabled={isSubmitting || !canWrite || !isApproved}
            >
              {isSubmitting
                ? "Processando..."
                : isDespesa
                  ? "Confirmar Pagamento"
                  : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
