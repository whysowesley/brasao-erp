import { useState, useEffect } from "react";
import {
  Wallet,
  Pencil,
  Check,
  X,
  Building,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBankBalances, useUpdateBankBalances, type BankBalances } from "@/lib/bank-balances";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

interface BankBalancesBarProps {
  dayPendingAmount: number;
  dayTotalAmount: number;
  canWrite?: boolean;
  compact?: boolean;
}

export function BankBalancesBar({
  dayPendingAmount,
  dayTotalAmount,
  canWrite = true,
  compact = false,
}: BankBalancesBarProps) {
  const { balances, total, isLoading } = useBankBalances();
  const updateMutation = useUpdateBankBalances();

  const [isOpen, setIsOpen] = useState(false);
  const [jamInput, setJamInput] = useState("");
  const [gbmInput, setGbmInput] = useState("");
  const [tonInput, setTonInput] = useState("");
  const [sicrediInput, setSicrediInput] = useState("");

  useEffect(() => {
    if (balances) {
      setJamInput(String(balances.jam || ""));
      setGbmInput(String(balances.gbm || ""));
      setTonInput(String(balances.ton || ""));
      setSicrediInput(String(balances.sicredi || ""));
    }
  }, [balances, isOpen]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar saldos.");
      return;
    }

    const parseVal = (str: string) => {
      const clean = str.replace(/[^\d,-]/g, "").replace(",", ".");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    try {
      await updateMutation.mutateAsync({
        jam: parseVal(jamInput),
        gbm: parseVal(gbmInput),
        ton: parseVal(tonInput),
        sicredi: parseVal(sicrediInput),
      });
      toast.success("Saldos bancários atualizados com sucesso!");
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar saldos.";
      toast.error(msg);
    }
  };

  const parsedCurrentTotal =
    (parseFloat(jamInput.replace(/[^\d,-]/g, "").replace(",", ".")) || 0) +
    (parseFloat(gbmInput.replace(/[^\d,-]/g, "").replace(",", ".")) || 0) +
    (parseFloat(tonInput.replace(/[^\d,-]/g, "").replace(",", ".")) || 0) +
    (parseFloat(sicrediInput.replace(/[^\d,-]/g, "").replace(",", ".")) || 0);

  // Quanto sobra após pagar este dia
  const diffAfterDay = total - dayPendingAmount;
  const isCovered = diffAfterDay >= 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 active:bg-white/25 transition-all text-[11px] font-medium text-white border border-white/20 cursor-pointer select-none text-left shadow-sm"
          title="Clique para editar manualmente os saldos das 4 contas (JAM, GBM, TON, SICREDI)"
        >
          <Wallet className="h-3.5 w-3.5 text-blue-200 group-hover:scale-110 transition-transform shrink-0" />

          {/* 4 Opções de saldo sutis lado a lado sempre visíveis */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-[11px]">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 text-blue-100 font-medium">
              JAM: <strong className="text-white font-bold">{formatCurrency(balances.jam)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 text-blue-100 font-medium">
              GBM: <strong className="text-white font-bold">{formatCurrency(balances.gbm)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 text-blue-100 font-medium">
              TON: <strong className="text-white font-bold">{formatCurrency(balances.ton)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 text-blue-100 font-medium">
              SICREDI:{" "}
              <strong className="text-white font-bold">{formatCurrency(balances.sicredi)}</strong>
            </span>
          </div>

          {/* Total & Capacidade de Pagamento do dia */}
          <div className="ml-1 pl-2 border-l border-white/25 flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-blue-200 font-medium">Total:</span>
            <span className="text-[11px] font-black text-white tracking-tight">
              {formatCurrency(total)}
            </span>

            {dayPendingAmount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-tight transition-colors ${
                  isCovered
                    ? "bg-emerald-500/40 text-emerald-100 border border-emerald-300/50 shadow-xs"
                    : "bg-rose-500/40 text-rose-100 border border-rose-300/50 shadow-xs"
                }`}
                title={`Pendente neste quadrante: ${formatCurrency(dayPendingAmount)}. ${
                  isCovered
                    ? `Saldo cobre o dia com sobra de ${formatCurrency(diffAfterDay)}`
                    : `Atenção: saldo insuficiente, faltam ${formatCurrency(Math.abs(diffAfterDay))}`
                }`}
              >
                {isCovered
                  ? `Cobre (+${formatCurrency(diffAfterDay)})`
                  : `Falta (${formatCurrency(Math.abs(diffAfterDay))})`}
              </span>
            )}

            <Pencil className="h-3 w-3 text-blue-200 opacity-70 group-hover:opacity-100 transition-opacity ml-0.5" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-84 sm:w-96 p-4 space-y-4" align="start">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-foreground">
                  Saldos Bancários Manuais (Geral)
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Sincronizado em todos os quadrantes de dias
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* JAM */}
            <div className="space-y-1">
              <Label
                htmlFor="saldo-jam"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>JAM</span>
                <span className="text-[10px] text-muted-foreground font-normal">Conta 1</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="saldo-jam"
                  type="text"
                  value={jamInput}
                  onChange={(e) => setJamInput(e.target.value)}
                  placeholder="0,00"
                  className="pl-8 h-8 text-xs font-mono font-semibold"
                  autoFocus
                />
              </div>
            </div>

            {/* GBM */}
            <div className="space-y-1">
              <Label
                htmlFor="saldo-gbm"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>GBM</span>
                <span className="text-[10px] text-muted-foreground font-normal">Conta 2</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="saldo-gbm"
                  type="text"
                  value={gbmInput}
                  onChange={(e) => setGbmInput(e.target.value)}
                  placeholder="0,00"
                  className="pl-8 h-8 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            {/* TON */}
            <div className="space-y-1">
              <Label
                htmlFor="saldo-ton"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>TON</span>
                <span className="text-[10px] text-muted-foreground font-normal">Conta 3</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="saldo-ton"
                  type="text"
                  value={tonInput}
                  onChange={(e) => setTonInput(e.target.value)}
                  placeholder="0,00"
                  className="pl-8 h-8 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            {/* SICREDI */}
            <div className="space-y-1">
              <Label
                htmlFor="saldo-sicredi"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>SICREDI</span>
                <span className="text-[10px] text-muted-foreground font-normal">Conta 4</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="saldo-sicredi"
                  type="text"
                  value={sicrediInput}
                  onChange={(e) => setSicrediInput(e.target.value)}
                  placeholder="0,00"
                  className="pl-8 h-8 text-xs font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Comparativo de Pagamento do Dia */}
          <div className="rounded-lg bg-muted/50 p-2.5 space-y-1.5 border border-border/60 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Soma dos 4 Saldos:</span>
              <strong className="text-sm font-bold text-foreground">
                {formatCurrency(parsedCurrentTotal)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span>A pagar neste dia (pendente):</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(dayPendingAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-medium text-muted-foreground">Previsão pós-pagamento:</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  parsedCurrentTotal >= dayPendingAmount
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {parsedCurrentTotal >= dayPendingAmount ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {formatCurrency(parsedCurrentTotal - dayPendingAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar Saldos
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
