import { useState } from "react";
import { Copy, Check, QrCode, Pencil, Save, Barcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUpdateTransactionPixKey, usePaymentMethods } from "@/lib/financeiro";
import type { FinancialTransaction } from "@/lib/financeiro-types";
import { cn } from "@/lib/utils";

interface TransactionPixPopoverProps {
  transaction: FinancialTransaction;
  canWrite: boolean;
  variant?: "badge" | "button" | "card";
}

export function TransactionPixPopover({
  transaction,
  canWrite,
  variant = "badge",
}: TransactionPixPopoverProps) {
  const updatePixMutation = useUpdateTransactionPixKey();
  const { data: paymentMethods = [] } = usePaymentMethods();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [codeInputValue, setCodeInputValue] = useState("");
  const [syncSupplier, setSyncSupplier] = useState(true);

  // Identifica de forma reativa se esta transação é do tipo "Boleto" (BLT)
  const isBoleto = (() => {
    // 1. Pelo tipo explícito no payment_method
    if (transaction.payment_method?.type === "boleto") return true;

    // 2. Pelo nome do payment_method vinculado
    const pmName =
      transaction.payment_method?.name ||
      (transaction as unknown as { payment_method_name?: string }).payment_method_name;
    if (pmName && pmName.toLowerCase().includes("boleto")) return true;

    // 3. Pelo ID na lista geral de métodos cadastrados
    if (transaction.payment_method_id) {
      const pm = paymentMethods.find((p) => p.id === transaction.payment_method_id);
      if (pm && (pm.type === "boleto" || pm.name.toLowerCase().includes("boleto"))) {
        return true;
      }
    }

    // 4. Caso a descrição comece com boleto
    const desc = (transaction.description || "").toLowerCase();
    if (desc.startsWith("boleto") || desc.includes(" boleto")) return true;

    return false;
  })();

  // Para boletos, usa a chave/linha digitável cadastrada na transação.
  // Para PIX, caso a transação não tenha chave individual, faz fallback na chave do fornecedor vinculado.
  const currentCode =
    transaction.pix_key || (!isBoleto ? transaction.supplier?.pix_key : null) || null;

  const handleCopyCode = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentCode) {
      setCodeInputValue("");
      setIsEditing(true);
      setOpen(true);
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentCode);
      } else {
        // Fallback para navegadores móveis mais restritivos
        const textArea = document.createElement("textarea");
        textArea.value = currentCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      if (isBoleto) {
        toast.success(`Código de barras do boleto (BLT) copiado: ${currentCode}`, {
          description: "Pronto para colar no aplicativo do seu banco!",
          duration: 3500,
        });
      } else {
        toast.success(`Chave PIX copiada: ${currentCode}`, {
          description: "Pronto para colar no aplicativo do seu banco!",
          duration: 3500,
        });
      }

      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      toast.error(
        isBoleto
          ? "Não foi possível copiar o código de barras automaticamente. Copie manualmente."
          : "Não foi possível copiar a chave PIX automaticamente. Copie manualmente.",
      );
      setOpen(true);
    }
  };

  const handleOpenPopover = () => {
    setCodeInputValue(currentCode || "");
    setIsEditing(!currentCode);
    setOpen(true);
  };

  const handleSaveCode = async () => {
    if (!canWrite) {
      toast.error("Você não tem permissão para editar lançamentos.");
      return;
    }

    const clean = codeInputValue.trim();
    try {
      await updatePixMutation.mutateAsync({
        id: transaction.id,
        pix_key: clean || null,
        supplier_id: transaction.supplier_id,
        updateSupplier: !isBoleto && syncSupplier && Boolean(transaction.supplier_id),
      });

      if (isBoleto) {
        toast.success(
          clean
            ? "Código de barras do boleto (BLT) salvo com sucesso!"
            : "Código de barras removido.",
        );
      } else {
        toast.success(clean ? "Chave PIX salva com sucesso!" : "Chave PIX removida.");
      }
      setIsEditing(false);
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isBoleto
            ? "Erro ao salvar código de barras do boleto."
            : "Erro ao salvar chave PIX.";
      toast.error(msg);
    }
  };

  // Renderização do corpo interno do Popover de visualização/edição
  function renderPopoverBody() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5">
            {isBoleto ? (
              <>
                <Barcode className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="font-bold text-xs">Código de Barras do Boleto (BLT)</span>
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-xs">Chave PIX para Pagamento</span>
              </>
            )}
          </div>
          {currentCode && !isEditing && canWrite && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 text-[11px] px-1.5 gap-1 text-blue-600"
            >
              <Pencil className="h-3 w-3" /> Editar
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {isBoleto
                  ? "Cole a linha digitável ou código de barras do boleto (47 ou 48 dígitos):"
                  : "Cole a chave PIX (CNPJ, CPF, E-mail, Telefone ou Aleatória):"}
              </Label>
              <Input
                value={codeInputValue}
                onChange={(e) => setCodeInputValue(e.target.value)}
                placeholder={
                  isBoleto
                    ? "Ex: 34191.79001 01043.510047 91020.150008 4 94560000010000"
                    : "Ex: 12.345.678/0001-90 ou financeiro@fornecedor.com"
                }
                className="h-8 text-xs font-mono"
                autoFocus
              />
            </div>

            {!isBoleto && transaction.supplier_name && (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id={`sync-supplier-${transaction.id}`}
                  checked={syncSupplier}
                  onCheckedChange={(c) => setSyncSupplier(Boolean(c))}
                  className="h-3.5 w-3.5"
                />
                <Label
                  htmlFor={`sync-supplier-${transaction.id}`}
                  className="text-[11px] text-muted-foreground cursor-pointer"
                >
                  Salvar também no cadastro de <strong>{transaction.supplier_name}</strong>
                </Label>
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5 pt-1">
              {currentCode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="h-7 text-xs"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCode}
                disabled={updatePixMutation.isPending}
                className={cn(
                  "h-7 text-xs text-white gap-1",
                  isBoleto
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
                )}
              >
                <Save className="h-3.5 w-3.5" />
                {isBoleto ? "Salvar BLT" : "Salvar PIX"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-2 rounded bg-muted/60 font-mono text-xs break-all select-all border border-muted">
              {currentCode}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCopyCode}
                className={cn(
                  "flex-1 h-8 text-xs font-bold gap-1.5 transition-colors text-white",
                  isBoleto
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado com sucesso!
                  </>
                ) : isBoleto ? (
                  <>
                    <Barcode className="h-3.5 w-3.5" /> Copiar BLT (Boleto)
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar Chave PIX
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Renderização variante para o Card Mobile
  if (variant === "card") {
    if (currentCode) {
      return (
        <div className="flex items-center gap-1.5 flex-1">
          <Button
            type="button"
            size="sm"
            onClick={handleCopyCode}
            className={cn(
              "h-8 flex-1 text-xs gap-1.5 font-bold transition-all shadow-xs",
              copied
                ? isBoleto
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                : isBoleto
                  ? "bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-400 border border-orange-500/35"
                  : "bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30",
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copiado!</span>
              </>
            ) : isBoleto ? (
              <>
                <Barcode className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                <span>BLT</span>
              </>
            ) : (
              <>
                <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>PIX</span>
              </>
            )}
          </Button>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleOpenPopover}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                title={
                  isBoleto
                    ? "Ver detalhes ou editar código de barras do boleto"
                    : "Ver detalhes ou editar chave PIX"
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3 space-y-3" align="end">
              {renderPopoverBody()}
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenPopover}
            className="h-8 flex-1 text-xs gap-1.5 border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground"
          >
            {isBoleto ? (
              <>
                <Barcode className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                <span>+ BLT</span>
              </>
            ) : (
              <>
                <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>+ PIX</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 space-y-3" align="end">
          {renderPopoverBody()}
        </PopoverContent>
      </Popover>
    );
  }

  // Renderização padrão de Quadrantes / Linha da Tabela:
  // Exatamente 3 letras compactas: "PIX" (verde) ou "BLT" (laranja)
  if (currentCode) {
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopyCode}
          className={cn(
            "h-6 px-2 text-[10px] font-bold gap-1 transition-all rounded tracking-wide",
            copied
              ? isBoleto
                ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                : "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
              : isBoleto
                ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-500/40 hover:bg-orange-100 hover:text-orange-800"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-100",
          )}
          title={
            isBoleto
              ? `Clique para copiar código de barras do boleto (BLT): ${currentCode}`
              : `Clique para copiar a chave PIX: ${currentCode}`
          }
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copiado!</span>
            </>
          ) : isBoleto ? (
            <>
              <Barcode className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>BLT</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>PIX</span>
            </>
          )}
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={handleOpenPopover}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] p-0.5 rounded cursor-pointer"
              title={
                isBoleto
                  ? "Ver detalhes ou editar código de barras do boleto (BLT)"
                  : "Ver detalhes ou editar chave PIX"
              }
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-3" align="start">
            {renderPopoverBody()}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Se não tem código/chave, mostra botão discreto de 3 letras: "+ PIX" ou "+ BLT"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleOpenPopover}
          className={cn(
            "text-[10px] flex items-center gap-0.5 whitespace-nowrap hover:underline transition-colors font-medium cursor-pointer",
            isBoleto
              ? "text-orange-600/80 hover:text-orange-700 dark:text-orange-400/80 dark:hover:text-orange-300"
              : "text-muted-foreground/70 hover:text-emerald-600",
          )}
          title={
            isBoleto
              ? "Clique para colar o código de barras deste boleto (BLT)"
              : "Clique para colar a chave PIX desta conta"
          }
        >
          {isBoleto ? (
            <>
              <Barcode className="h-3 w-3 text-orange-600/90 dark:text-orange-400" />
              <span>+ BLT</span>
            </>
          ) : (
            <>
              <QrCode className="h-3 w-3 text-emerald-600/80" />
              <span>+ PIX</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        {renderPopoverBody()}
      </PopoverContent>
    </Popover>
  );
}
