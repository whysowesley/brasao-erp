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
  Palette,
  Sparkles,
  Check,
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
  isTransactionNew,
  HIGHLIGHT_COLORS,
  getHighlightRowClass,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type {
  FinancialTransaction,
  TipoRecorrencia,
  TipoTransacao,
  HighlightColor,
} from "@/lib/financeiro-types";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

const WEEKDAYS = [
  { value: 0, label: "Domingo", plural: "Domingos" },
  { value: 1, label: "Segunda-feira", plural: "Segundas" },
  { value: 2, label: "Terça-feira", plural: "Terças" },
  { value: 3, label: "Quarta-feira", plural: "Quartas" },
  { value: 4, label: "Quinta-feira", plural: "Quintas" },
  { value: 5, label: "Sexta-feira", plural: "Sextas" },
  { value: 6, label: "Sábado", plural: "Sábados" },
];

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
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<Date | undefined>(undefined);
  const [issueDate, setIssueDate] = useState<Date | undefined>(undefined);
  const [code, setCode] = useState<string>("");
  const [pixKey, setPixKey] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("none");
  const [isNew, setIsNew] = useState<boolean>(true);

  // Recorrência & Parcelamento
  const [recorrenciaType, setRecorrenciaType] = useState<TipoRecorrencia>("unica");
  const [installmentTotal, setInstallmentTotal] = useState("2");
  const [recurrenceMonths, setRecurrenceMonths] = useState("12");
  const [recurrenceWeeks, setRecurrenceWeeks] = useState("52");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(new Date().getDay());

  const isEditing = Boolean(transactionToEdit?.id && transactionToEdit.id.trim() !== "");
  const isDuplicating = Boolean(
    transactionToEdit && (!transactionToEdit.id || transactionToEdit.id.trim() === ""),
  );
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
      try {
        setExpectedPaymentDate(
          transactionToEdit.expected_payment_date
            ? parseISO(transactionToEdit.expected_payment_date)
            : undefined,
        );
      } catch {
        setExpectedPaymentDate(undefined);
      }
      try {
        setIssueDate(
          transactionToEdit.issue_date ? parseISO(transactionToEdit.issue_date) : undefined,
        );
      } catch {
        setIssueDate(undefined);
      }
      setCode(transactionToEdit.code ? String(transactionToEdit.code) : "");

      const catMatch =
        (transactionToEdit.category_id &&
        categories.some((c) => c.id === transactionToEdit.category_id)
          ? transactionToEdit.category_id
          : undefined) ||
        (transactionToEdit.category?.id &&
        categories.some((c) => c.id === transactionToEdit.category!.id)
          ? transactionToEdit.category!.id
          : undefined) ||
        (transactionToEdit.category?.name
          ? categories.find(
              (c) =>
                c.name.toLowerCase().trim() ===
                transactionToEdit.category!.name.toLowerCase().trim(),
            )?.id
          : undefined) ||
        transactionToEdit.category_id ||
        "none";
      setCategoryId(catMatch);

      const ccMatch =
        (transactionToEdit.cost_center_id &&
        costCenters.some((c) => c.id === transactionToEdit.cost_center_id)
          ? transactionToEdit.cost_center_id
          : undefined) ||
        (transactionToEdit.cost_center?.id &&
        costCenters.some((c) => c.id === transactionToEdit.cost_center!.id)
          ? transactionToEdit.cost_center!.id
          : undefined) ||
        (transactionToEdit.cost_center?.name
          ? costCenters.find(
              (c) =>
                c.name.toLowerCase().trim() ===
                transactionToEdit.cost_center!.name.toLowerCase().trim(),
            )?.id
          : undefined) ||
        transactionToEdit.cost_center_id ||
        "none";
      setCostCenterId(ccMatch);

      const supMatch =
        (transactionToEdit.supplier_id &&
        suppliers.some((s) => s.id === transactionToEdit.supplier_id)
          ? transactionToEdit.supplier_id
          : undefined) ||
        (transactionToEdit.supplier?.id &&
        suppliers.some((s) => s.id === transactionToEdit.supplier!.id)
          ? transactionToEdit.supplier!.id
          : undefined) ||
        (transactionToEdit.supplier?.name
          ? suppliers.find(
              (s) =>
                s.name.toLowerCase().trim() ===
                transactionToEdit.supplier!.name.toLowerCase().trim(),
            )?.id
          : undefined) ||
        transactionToEdit.supplier_id ||
        "none";
      setSupplierId(supMatch);

      const pmMatch =
        (transactionToEdit.payment_method_id &&
        paymentMethods.some((p) => p.id === transactionToEdit.payment_method_id)
          ? transactionToEdit.payment_method_id
          : undefined) ||
        (transactionToEdit.payment_method?.id &&
        paymentMethods.some((p) => p.id === transactionToEdit.payment_method!.id)
          ? transactionToEdit.payment_method!.id
          : undefined) ||
        (transactionToEdit.payment_method_name
          ? paymentMethods.find(
              (p) =>
                p.name.toLowerCase().trim() ===
                transactionToEdit.payment_method_name!.toLowerCase().trim(),
            )?.id
          : undefined) ||
        transactionToEdit.payment_method_id ||
        "none";
      setPaymentMethodId(pmMatch);

      setPixKey(transactionToEdit.pix_key || transactionToEdit.supplier?.pix_key || "");
      setNotes(transactionToEdit.notes || "");
      setDocumentUrl(transactionToEdit.document_url || "");
      setHighlightColor(transactionToEdit.highlight_color || "none");
      setIsNew(isTransactionNew(transactionToEdit));
      setRecorrenciaType("unica");
    } else {
      setTipo(defaultType);
      setDescription("");
      setAmount("");
      setDueDate(new Date());
      setExpectedPaymentDate(undefined);
      setIssueDate(undefined);
      setCode("");
      setCategoryId("none");
      setCostCenterId("none");
      setSupplierId("none");
      setPaymentMethodId("none");
      setPixKey("");
      setNotes("");
      setDocumentUrl("");
      setHighlightColor("none");
      setIsNew(true);
      setRecorrenciaType("unica");
      setInstallmentTotal("2");
      setRecurrenceMonths("12");
      setRecurrenceWeeks("52");
      setRecurrenceDayOfWeek(new Date().getDay());
    }
  }, [transactionToEdit, defaultType, open, categories, costCenters, suppliers, paymentMethods]);

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
    const formattedExpectedDate = expectedPaymentDate
      ? format(expectedPaymentDate, "yyyy-MM-dd")
      : null;
    const formattedIssueDate = issueDate ? format(issueDate, "yyyy-MM-dd") : null;
    const parsedCode = code ? parseInt(code, 10) || null : null;
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    const selectedCostCenter = costCenters.find((c) => c.id === costCenterId);
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const selectedPaymentMethod = paymentMethods.find((p) => p.id === paymentMethodId);

    try {
      if (isEditing && transactionToEdit?.id) {
        await updateMutation.mutateAsync({
          id: transactionToEdit.id,
          description: description.trim() || null,
          type: tipo,
          amount: parsedAmount,
          due_date: formattedDueDate,
          expected_payment_date: formattedExpectedDate,
          issue_date: formattedIssueDate,
          code: parsedCode,
          category_id: categoryId !== "none" ? categoryId : null,
          category_name: selectedCategory ? selectedCategory.name : null,
          cost_center_id: costCenterId !== "none" ? costCenterId : null,
          cost_center_name: selectedCostCenter ? selectedCostCenter.name : null,
          supplier_id: supplierId !== "none" ? supplierId : null,
          supplier_name: selectedSupplier ? selectedSupplier.name : null,
          payment_method_id: paymentMethodId !== "none" ? paymentMethodId : null,
          payment_method_name: selectedPaymentMethod ? selectedPaymentMethod.name : null,
          pix_key: pixKey.trim() || null,
          notes: notes.trim() || null,
          document_url: documentUrl.trim() || null,
          highlight_color: highlightColor !== "none" ? highlightColor : null,
          is_new: isNew,
        });
        toast.success("Lançamento atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync({
          description: description.trim() || null,
          type: tipo,
          amount: parsedAmount,
          due_date: formattedDueDate,
          expected_payment_date: formattedExpectedDate,
          issue_date: formattedIssueDate,
          code: parsedCode,
          category_id: categoryId !== "none" ? categoryId : null,
          category_name: selectedCategory ? selectedCategory.name : null,
          cost_center_id: costCenterId !== "none" ? costCenterId : null,
          cost_center_name: selectedCostCenter ? selectedCostCenter.name : null,
          supplier_id: supplierId !== "none" ? supplierId : null,
          supplier_name: selectedSupplier ? selectedSupplier.name : null,
          payment_method_id: paymentMethodId !== "none" ? paymentMethodId : null,
          payment_method_name: selectedPaymentMethod ? selectedPaymentMethod.name : null,
          pix_key: pixKey.trim() || null,
          notes: notes.trim() || null,
          document_url: documentUrl.trim() || null,
          highlight_color: highlightColor !== "none" ? highlightColor : null,
          is_new: isNew,
          is_recurring: recorrenciaType !== "unica",
          recurrence_type: recorrenciaType,
          installment_total:
            recorrenciaType === "parcelada" ? parseInt(installmentTotal, 10) || 2 : undefined,
          recurrence_months:
            recorrenciaType === "mensal" ? parseInt(recurrenceMonths, 10) || 12 : undefined,
          recurrence_weeks:
            recorrenciaType === "semanal" ? parseInt(recurrenceWeeks, 10) || 52 : undefined,
          recurrence_day_of_week: recorrenciaType === "semanal" ? recurrenceDayOfWeek : undefined,
        });

        if (isDuplicating) {
          toast.success("Lançamento duplicado e salvo com sucesso!");
        } else if (recorrenciaType === "parcelada") {
          toast.success(`Lançamento parcelado criado em ${installmentTotal}x com sucesso!`);
        } else if (recorrenciaType === "semanal") {
          const selectedDayName =
            WEEKDAYS.find((w) => w.value === recurrenceDayOfWeek)?.plural || "Semanas";
          toast.success(
            `Pagamento fixo criado para os próximos ${selectedDayName} (${recurrenceWeeks} ocorrências)! Cada lançamento pode ser editado individualmente.`,
          );
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
              {isEditing
                ? "Editar Lançamento"
                : isDuplicating
                  ? "Duplicar Lançamento"
                  : "Novo Lançamento Financeiro"}
              {isDuplicating && (
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Cópia / Novo Lançamento
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Atualize as informações do lançamento financeiro."
                : isDuplicating
                  ? "Altere a data, valor ou fornecedor para salvar uma nova cópia deste lançamento."
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

            {/* Vencimento, Nova Data (Postergada) e Emissão */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>
                  Dia de Vencimento <span className="text-rose-500">*</span>
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
                      onSelect={(d) => {
                        if (d) {
                          setDueDate(d);
                          setRecurrenceDayOfWeek(d.getDay());
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>Nova Data Pgto</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (Postergada)
                  </span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="tx-expected-date-btn"
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        expectedPaymentDate ? "text-blue-700 dark:text-blue-400 font-medium" : ""
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {expectedPaymentDate ? (
                        format(expectedPaymentDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span className="text-muted-foreground">Mesma do vencimento</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={expectedPaymentDate}
                      onSelect={(d) => setExpectedPaymentDate(d)}
                      initialFocus
                    />
                    {expectedPaymentDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs mt-1"
                        onClick={() => setExpectedPaymentDate(undefined)}
                      >
                        Limpar data postergada
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>Emissão / Código</span>
                  <span className="text-[10px] text-muted-foreground font-normal">(Opcional)</span>
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Doc/Cód"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-24 text-xs font-mono"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-start text-left font-normal text-xs px-2"
                        title="Data de emissão"
                      >
                        <CalendarIcon className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                        {issueDate ? format(issueDate, "dd/MM/yy") : "Emissão"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="end">
                      <Calendar
                        mode="single"
                        selected={issueDate}
                        onSelect={(d) => setIssueDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Categoria e Fornecedor */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <PaymentMethodSelect
                  id="tx-payment-method-select"
                  value={paymentMethodId}
                  onValueChange={setPaymentMethodId}
                  canWrite={canWrite && isApproved}
                />
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

            {/* Chave PIX para Pagamento */}
            <div className="space-y-1.5 rounded-lg border border-emerald-500/25 bg-emerald-50/30 dark:bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="tx-pix-key"
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                >
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Chave PIX para Pagamento
                </Label>
                {supplierId !== "none" &&
                  (() => {
                    const sup = suppliers.find((s) => s.id === supplierId);
                    if (sup?.pix_key && sup.pix_key !== pixKey) {
                      return (
                        <button
                          type="button"
                          onClick={() => setPixKey(sup.pix_key || "")}
                          className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline font-semibold"
                        >
                          Usar PIX do fornecedor ({sup.pix_key.slice(0, 14)}...)
                        </button>
                      );
                    }
                    return null;
                  })()}
              </div>
              <Input
                id="tx-pix-key"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Cole a chave PIX (CNPJ, CPF, Celular, E-mail ou Aleatória)..."
                className="h-8.5 font-mono text-xs bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Permite copiar a chave PIX em 1 toque/clique no computador ou celular para pagar no
                banco.
              </p>
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
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="unica" id="rec-unica" />
                    <Label htmlFor="rec-unica" className="text-xs cursor-pointer">
                      Lançamento Único
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="semanal" id="rec-semanal" />
                    <Label
                      htmlFor="rec-semanal"
                      className="text-xs cursor-pointer font-medium text-primary"
                    >
                      Fixo Semanal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="mensal" id="rec-mensal" />
                    <Label htmlFor="rec-mensal" className="text-xs cursor-pointer">
                      Fixo Mensal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-2">
                    <RadioGroupItem value="parcelada" id="rec-parcelada" />
                    <Label htmlFor="rec-parcelada" className="text-xs cursor-pointer">
                      Parcelado (Nx)
                    </Label>
                  </div>
                </RadioGroup>

                {recorrenciaType === "semanal" && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="rec-weekday-select" className="text-xs font-medium">
                          Dia da semana fixo:
                        </Label>
                        <Select
                          value={String(recurrenceDayOfWeek)}
                          onValueChange={(val) => {
                            const newDay = parseInt(val, 10);
                            setRecurrenceDayOfWeek(newDay);
                            // Ajusta a data de vencimento base para cair no dia da semana escolhido
                            const currDay = dueDate.getDay();
                            const diff = (newDay - currDay + 7) % 7;
                            const newDate = new Date(dueDate);
                            newDate.setDate(dueDate.getDate() + diff);
                            setDueDate(newDate);
                          }}
                        >
                          <SelectTrigger
                            id="rec-weekday-select"
                            className="h-8 text-xs bg-background"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map((w) => (
                              <SelectItem key={w.value} value={String(w.value)}>
                                Todo(a) {w.label} ({w.plural})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="rec-weeks-count" className="text-xs font-medium">
                          Duração / Repetições:
                        </Label>
                        <Select
                          value={recurrenceWeeks}
                          onValueChange={(val) => setRecurrenceWeeks(val)}
                        >
                          <SelectTrigger id="rec-weeks-count" className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4 semanas (1 mês)</SelectItem>
                            <SelectItem value="12">12 semanas (3 meses)</SelectItem>
                            <SelectItem value="26">26 semanas (6 meses)</SelectItem>
                            <SelectItem value="52">52 semanas (1 ano / Contínuo)</SelectItem>
                            <SelectItem value="104">104 semanas (2 anos)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 p-2.5 border border-blue-200/50 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        Repetir esse pagamento pelos próximos{" "}
                        <strong className="underline decoration-blue-500">
                          {WEEKDAYS.find((w) => w.value === recurrenceDayOfWeek)?.plural}
                        </strong>{" "}
                        ({recurrenceWeeks} repetições)
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Cada lançamento será criado individualmente na data certa do fluxo de caixa.
                        Você poderá editar o valor, a data ou cancelar qualquer um dos dias de forma
                        totalmente independente.
                      </p>
                    </div>
                  </div>
                )}

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
                      className="w-24 h-8 text-xs bg-background"
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
                      className="w-24 h-8 text-xs bg-background"
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

            {/* Destaque Visual e Tag "Novo" */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <Label htmlFor="tx-is-new" className="text-sm font-semibold cursor-pointer">
                    Tag de Lançamento "Novo"
                  </Label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="tx-is-new"
                    type="checkbox"
                    checked={isNew}
                    onChange={(e) => setIsNew(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                  />
                  {isNew ? (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      Ativa (Novo)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Desativada</span>
                  )}
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exibe uma etiqueta minimalista laranja no lançamento para você identificar
                rapidamente novos agendamentos e contas adicionadas recentemente.
              </p>

              <div className="pt-2.5 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-primary" />
                    Cor Marcante da Linha (Quadrante e Tabelas)
                  </Label>
                  {highlightColor !== "none" && (
                    <button
                      type="button"
                      onClick={() => setHighlightColor("none")}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Limpar cor
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {HIGHLIGHT_COLORS.map((c) => {
                    const isSelected = highlightColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setHighlightColor(c.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all text-left cursor-pointer ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 shadow-xs " +
                              (c.id === "none"
                                ? "bg-muted text-foreground font-bold"
                                : c.badgeClass)
                            : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
                        }`}
                        title={c.label}
                      >
                        <span className={`h-3.5 w-3.5 rounded-full shrink-0 ${c.dotClass}`} />
                        <span className="truncate flex-1">{c.name}</span>
                        {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                {highlightColor !== "none" && (
                  <div
                    className={`mt-2 p-2.5 rounded-md text-xs border transition-all ${getHighlightRowClass(
                      highlightColor,
                    )} flex items-center justify-between shadow-xs`}
                  >
                    <span className="text-[11px] font-medium text-foreground">
                      Exemplo visual do destaque aplicado na linha
                    </span>
                    {isNew && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                        Novo
                      </span>
                    )}
                  </div>
                )}
              </div>
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
              {isSubmitting
                ? "Salvando..."
                : isEditing
                  ? "Salvar Alterações"
                  : isDuplicating
                    ? "Salvar Cópia (Duplicar)"
                    : "Criar Lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
