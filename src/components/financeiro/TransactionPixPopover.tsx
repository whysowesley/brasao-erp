import { useState } from "react";
import { Copy, Check, QrCode, Pencil, Save, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUpdateTransactionPixKey } from "@/lib/financeiro";
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

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pixInput, setPixInput] = useState("");
  const [syncSupplier, setSyncSupplier] = useState(true);

  // Determina a chave PIX atual da transação ou do fornecedor vinculado
  const currentPix = transaction.pix_key || transaction.supplier?.pix_key || null;

  const handleCopyPix = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentPix) {
      setOpen(true);
      setIsEditing(true);
      setPixInput("");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentPix);
      } else {
        // Fallback para navegadores móveis mais restritivos
        const textArea = document.createElement("textarea");
        textArea.value = currentPix;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      toast.success(`Chave PIX copiada: ${currentPix}`, {
        description: "Pronto para colar no aplicativo do seu banco!",
        duration: 3500,
      });

      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione e copie manualmente.");
      setOpen(true);
    }
  };

  const handleOpenPopover = () => {
    setPixInput(currentPix || "");
    setIsEditing(!currentPix);
    setOpen(true);
  };

  const handleSavePix = async () => {
    if (!canWrite) {
      toast.error("Você não tem permissão para editar lançamentos.");
      return;
    }

    const clean = pixInput.trim();
    try {
      await updatePixMutation.mutateAsync({
        id: transaction.id,
        pix_key: clean || null,
        supplier_id: transaction.supplier_id,
        updateSupplier: syncSupplier && Boolean(transaction.supplier_id),
      });

      toast.success(clean ? "Chave PIX salva com sucesso!" : "Chave PIX removida.");
      setIsEditing(false);
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar chave PIX.";
      toast.error(msg);
    }
  };

  // Renderização variante para o Card Mobile
  if (variant === "card") {
    if (currentPix) {
      return (
        <div className="flex items-center gap-1.5 flex-1">
          <Button
            type="button"
            size="sm"
            onClick={handleCopyPix}
            className={cn(
              "h-8 flex-1 text-xs gap-1.5 font-bold transition-all shadow-xs",
              copied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30",
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copiar PIX</span>
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
                title="Ver ou editar chave PIX"
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
            <QrCode className="h-3.5 w-3.5" />
            <span>Colar Chave PIX</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 space-y-3" align="end">
          {renderPopoverBody()}
        </PopoverContent>
      </Popover>
    );
  }

  // Renderização padrão de Linha / Tabela
  function renderPopoverBody() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5">
            <QrCode className="h-4 w-4 text-emerald-600" />
            <span className="font-bold text-xs">Chave PIX para Pagamento</span>
          </div>
          {currentPix && !isEditing && canWrite && (
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
                Cole a chave PIX (CNPJ, CPF, E-mail, Telefone ou Aleatória):
              </Label>
              <Input
                value={pixInput}
                onChange={(e) => setPixInput(e.target.value)}
                placeholder="Ex: 12.345.678/0001-90 ou financeiro@fornecedor.com"
                className="h-8 text-xs font-mono"
                autoFocus
              />
            </div>

            {transaction.supplier_name && (
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
              {currentPix && (
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
                onClick={handleSavePix}
                disabled={updatePixMutation.isPending}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                <Save className="h-3.5 w-3.5" /> Salvar PIX
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-2 rounded bg-muted/60 font-mono text-xs break-all select-all border border-muted">
              {currentPix}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCopyPix}
                className={cn(
                  "flex-1 h-8 text-xs font-bold gap-1.5 transition-colors",
                  copied
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white",
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado com sucesso!
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

  // Tabela: se tem PIX, mostra botão com ação rápida de cópia e menu
  if (currentPix) {
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopyPix}
          className={cn(
            "h-6 px-1.5 text-[10px] font-semibold gap-1 transition-all rounded",
            copied
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-100",
          )}
          title={`Clique para copiar a chave PIX: ${currentPix}`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 text-emerald-600" />}
          <span>PIX</span>
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={handleOpenPopover}
              className="text-muted-foreground/60 hover:text-foreground text-[10px] p-0.5 rounded"
              title="Ver detalhes ou editar chave PIX"
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

  // Se não tem PIX, mostra botão discreto para colar chave
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleOpenPopover}
          className="text-[10px] text-muted-foreground/70 hover:text-emerald-600 hover:underline flex items-center gap-0.5 whitespace-nowrap"
          title="Clique para colar a chave PIX desta conta"
        >
          <QrCode className="h-3 w-3" />
          <span>+ PIX</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        {renderPopoverBody()}
      </PopoverContent>
    </Popover>
  );
}
