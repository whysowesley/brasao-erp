import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Layers,
  Repeat,
  DollarSign,
  Building2,
  Tag,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  useFinancialCategories,
  useCostCenters,
  usePaymentMethods,
  useCreateFinancialTransaction,
  useUpdateFinancialTransaction,
  getTodayString,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction, TipoRecorrencia, TipoTransacao } from "@/lib/financeiro-types";

interface LancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionToEdit?: FinancialTransaction | null;
  defaultType?: TipoTransacao;
}

export function LancamentoDialog({
  open,
  onOpenChange,
  transactionToEdit,
  defaultType = "despesa",
}: LancamentoDialogProps) {
  const { canWrite, isApproved } = useAuth();
  const createMutation = useCreateFinancialTransaction();
  const updateMutation = useUpdateFinancialTransaction();

  // Queries
  const { data: categories = [] } = useFinancialCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: suppliers = [] } = useSuppliers();

  // Form States
  const [tipo, setTipo] = useState<TipoTransacao>(defaultType);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState<string>("none");
  const [costCenterId, setCostCenterId] = useState<string>("none");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  // Recorrência & Parcelamento
  const [recorrenciaType, setRecorrenciaType] = useState<TipoRecorrencia>("unica");
  const [installmentTotal, setInstallmentTotal] = useState("2");
  const [recurrenceMonths, setRecurrenceMonths] = useState("12");

  const isEditing = !!transactionToEdit;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sincroniza formulário ao abrir ou alterar transactionToEdit
  useEffect(() => {
    if (transactionToEdit) {
      setTipo(transactionToEdit.type);
      setDescription(transactionToEdit.description || "");
      setAmount(String(transactionToEdit.amount));
      try {
        setDueDate(parseISO(transactionToEdit.due_date));
      } catch {
        setDueDate(new Date());
      }
      setCategoryId(transactionToEdit.category_id || "none");
      setCostCenterId(transactionToEdit.cost_center_id || "none");
      setSupplierId(transactionToEdit.supplier_id || "none");
      setPaymentMethodId(transactionToEdit.payment_method_id || "none");
      setNotes(transactionToEdit.notes || "");
      setDocumentUrl(transactionToEdit.document_url || "");
      setRecorrenciaType("unica");
    } else {
      setTipo(defaultType);
      setDescription("");
      setAmount("");
      setDueDate(new Date());
      setCategoryId("none");
      setCostCenterId("none");
      setSupplierId("none");
      setPaymentMethodId("none");
      setNotes("");
      setDocumentUrl("");
      setRecorrenciaType("unica");
      setInstallmentTotal("2");
      setRecurrenceMonths("12");
    }
  }, [transactionToEdit, defaultType, open]);

  // Categorias filtradas pelo tipo (receita ou despesa)
  const filteredCategories = categories.filter((c) => c.type === tipo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para salvar lançamentos.");
      return;
    }

    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor numérico válido maior que zero.");
      return;
    }

    const formattedDueDate = format(dueDate, "yyyy-MM-dd");
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);

    try {
      if (isEditing && transactionToEdit) {
        await updateMutation.mutateAsync({
          id: transactionToEdit.id,
          description: description.trim() || null,
          type: tipo,
          amount: parsedAmount,
          due_date: formattedDueDate,
          category_id: categoryId !== "none" ? categoryId : null,
          cost_center_id: costCenterId !== "none" ? costCenterId : null,
          supplier_id: supplierId !== "none" ? supplierId : null,
          supplier_name: selectedSupplier ? selectedSupplier.name : null,
          payment_method_id: paymentMethodId !== "none" ? paymentMethodId : null,
          notes: notes.trim() || null,
          document_url: documentUrl.trim() || null,
        });
        toast.success("Lançamento atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync({
          description: description.trim() || null,
          type: tipo,
          amount: parsedAmount,
          due_date: formattedDueDate,
          category_id: categoryId !== "none" ? categoryId : null,
          cost_center_id: costCenterId !== "none" ? costCenterId : null,
          supplier_id: supplierId !== "none" ? supplierId : null,
          supplier_name: selectedSupplier ? selectedSupplier.name : null,
          payment_method_id: paymentMethodId !== "none" ? paymentMethodId : null,
          notes: notes.trim() || null,
          document_url: documentUrl.trim() || null,
          is_recurring: recorrenciaType !== "unica",
          recurrence_type: recorrenciaType,
          installment_total:
            recorrenciaType === "parcelada" ? parseInt(installmentTotal, 10) || 2 : undefined,
          recurrence_months:
            recorrenciaType === "mensal" ? parseInt(recurrenceMonths, 10) || 12 : undefined,
        });

        if (recorrenciaType === "parcelada") {
          toast.success(`Lançamento parcelado criado em ${installmentTotal}x com sucesso!`);
        } else if (recorrenciaType === "mensal") {
          toast.success(`Recorrência mensal criada para os próximos ${recurrenceMonths} meses!`);
        } else {
          toast.success("Lançamento criado com sucesso!");
        }
      }

      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar lançamento.";
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="lancamento-dialog-content"
        className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {isEditing ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Atualize as informações do lançamento financeiro."
                : "Preencha os campos abaixo para registrar uma entrada ou saída."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo: Receita vs Despesa */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Tipo de Movimentação
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="btn-tipo-despesa"
                  disabled={isEditing}
                  onClick={() => {
                    setTipo("despesa");
                    setCategoryId("none");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-semibold text-sm transition-all ${
                    tipo === "despesa"
                      ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Saída (Despesa / A Pagar)
                </button>
                <button
                  type="button"
                  id="btn-tipo-receita"
                  disabled={isEditing}
                  onClick={() => {
                    setTipo("receita");
                    setCategoryId("none");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-semibold text-sm transition-all ${
                    tipo === "receita"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Entrada (Receita / A Receber)
                </button>
              </div>
            </div>

            {/* Descrição e Valor */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="tx-desc">
                  Descrição{" "}
                  <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
                </Label>
                <Input
                  id="tx-desc"
                  placeholder="Ex: Fornecedor Hortifrúti, Vendas do Dia..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-amount">
                  Valor (R$) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Vencimento e Categoria */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Data de Vencimento <span className="text-rose-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="tx-due-date-btn"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {dueDate ? (
                        format(dueDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => d && setDueDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Categoria Financeira
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="tx-category-select">
                    <SelectValue placeholder="Selecione uma categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fornecedor e Centro de Custo */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {tipo === "despesa" ? "Fornecedor / Beneficiário" : "Cliente / Origem"}
                </Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="tx-supplier-select">
                    <SelectValue placeholder="Selecione o fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum / Não informado</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {supplierId !== "none" &&
                  (() => {
                    const selectedSup = suppliers.find((s) => s.id === supplierId);
                    if (!selectedSup || (!selectedSup.cnpj_cpf && !selectedSup.pix_key))
                      return null;
                    return (
                      <div className="mt-1 rounded border border-border/60 bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-0.5">
                        {selectedSup.cnpj_cpf && (
                          <p className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Doc:</span>
                            <span className="font-mono">{selectedSup.cnpj_cpf}</span>
                          </p>
                        )}
                        {selectedSup.pix_key && (
                          <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <CreditCard className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">PIX:</span>
                            <span className="font-mono">{selectedSup.pix_key}</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Centro de Custo
                </Label>
                <Select value={costCenterId} onValueChange={setCostCenterId}>
                  <SelectTrigger id="tx-cost-center-select">
                    <SelectValue placeholder="Selecione o centro de custo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem centro de custo</SelectItem>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Forma de Pagamento Prevista */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Forma de Pagamento (Prevista/Padrão)
                </Label>
                <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                  <SelectTrigger id="tx-payment-method-select">
                    <SelectValue placeholder="Selecione a forma de pagamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">A definir</SelectItem>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-document-url">Link do Comprovante / Doc</Label>
                <Input
                  id="tx-document-url"
                  placeholder="https://..."
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Recorrência e Parcelamento (Apenas na Criação) */}
            {!isEditing && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <Label className="font-semibold text-xs uppercase tracking-wider text-foreground">
                    Repetição / Parcelamento
                  </Label>
                </div>

                <RadioGroup
                  value={recorrenciaType}
                  onValueChange={(val) => setRecorrenciaType(val as TipoRecorrencia)}
                  className="grid grid-cols-3 gap-2"
                >
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="unica" id="rec-unica" />
                    <Label htmlFor="rec-unica" className="text-xs cursor-pointer">
                      Lançamento Único
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="parcelada" id="rec-parcelada" />
                    <Label htmlFor="rec-parcelada" className="text-xs cursor-pointer">
                      Parcelado (Nx)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="mensal" id="rec-mensal" />
                    <Label htmlFor="rec-mensal" className="text-xs cursor-pointer">
                      Fixo Mensal
                    </Label>
                  </div>
                </RadioGroup>

                {recorrenciaType === "parcelada" && (
                  <div className="flex items-center gap-3 pt-1">
                    <Label htmlFor="installment-count" className="text-xs shrink-0">
                      Número de parcelas:
                    </Label>
                    <Input
                      id="installment-count"
                      type="number"
                      min="2"
                      max="48"
                      className="w-24 h-8 text-xs"
                      value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      (Gera {installmentTotal} lançamentos mensais automáticos)
                    </span>
                  </div>
                )}

                {recorrenciaType === "mensal" && (
                  <div className="flex items-center gap-3 pt-1">
                    <Label htmlFor="recurrence-months" className="text-xs shrink-0">
                      Meses adiantados:
                    </Label>
                    <Input
                      id="recurrence-months"
                      type="number"
                      min="2"
                      max="24"
                      className="w-24 h-8 text-xs"
                      value={recurrenceMonths}
                      onChange={(e) => setRecurrenceMonths(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      (Repete nos próximos {recurrenceMonths} meses)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-notes">Observações</Label>
              <Textarea
                id="tx-notes"
                placeholder="Detalhes adicionais, número de nota fiscal, condições de pagamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              id="btn-save-transaction"
              disabled={isSubmitting || !canWrite || !isApproved}
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
