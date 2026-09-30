import { useState, useEffect } from "react";
import {
  Wallet,
  Pencil,
  Check,
  X,
  Building,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBankBalances, useUpdateBankBalances, type BalanceAccount } from "@/lib/bank-balances";
import {
  parseCurrencyInput,
  formatCurrencyBRL,
  formatCurrencyInputValue,
} from "@/lib/currency-utils";

interface BankBalancesBarProps {
  dayPendingAmount: number;
  dayTotalAmount: number;
  canWrite?: boolean;
  compact?: boolean;
}

interface AccountDraft {
  id: string;
  name: string;
  rawInput: string;
}

export function BankBalancesBar({
  dayPendingAmount,
  dayTotalAmount,
  canWrite = true,
  compact = false,
}: BankBalancesBarProps) {
  const { accounts, total, isLoading } = useBankBalances();
  const updateMutation = useUpdateBankBalances();

  const [isOpen, setIsOpen] = useState(false);
  const [accountDrafts, setAccountDrafts] = useState<AccountDraft[]>([]);

  // Sincroniza rascunhos apenas quando abre o popover para não resetar enquanto digita
  useEffect(() => {
    if (isOpen) {
      setAccountDrafts(
        accounts.length > 0
          ? accounts.map((a) => ({
              id: a.id,
              name: a.name,
              rawInput: a.balance > 0 ? formatCurrencyInputValue(a.balance) : "",
            }))
          : [
              { id: "acc_1", name: "JAM", rawInput: "" },
              { id: "acc_2", name: "GBM", rawInput: "" },
              { id: "acc_3", name: "TON", rawInput: "" },
              { id: "acc_4", name: "SICREDI", rawInput: "" },
            ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddAccount = (name = "NOVO MÉTODO") => {
    setAccountDrafts((prev) => [
      ...prev,
      {
        id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.toUpperCase(),
        rawInput: "",
      },
    ]);
  };

  const handleRemoveAccount = (id: string) => {
    if (accountDrafts.length <= 1) {
      // Se tiver só 1, reseta para vazio em vez de deixar a lista zerada
      setAccountDrafts([
        {
          id: `acc_${Date.now()}`,
          name: "CONTA",
          rawInput: "",
        },
      ]);
      toast.info("Conta redefinida para nova entrada.");
      return;
    }
    setAccountDrafts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateName = (id: string, name: string) => {
    setAccountDrafts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: name.toUpperCase() } : a)),
    );
  };

  const handleUpdateBalance = (id: string, rawInput: string) => {
    setAccountDrafts((prev) => prev.map((a) => (a.id === id ? { ...a, rawInput } : a)));
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar saldos.");
      return;
    }

    const parsedAccounts: BalanceAccount[] = accountDrafts.map((a) => ({
      id: a.id,
      name: a.name.trim() || "CONTA",
      balance: parseCurrencyInput(a.rawInput),
    }));

    try {
      await updateMutation.mutateAsync({ accounts: parsedAccounts });
      toast.success("Saldos e métodos atualizados com sucesso!");
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar saldos.";
      toast.error(msg);
    }
  };

  // Cálculo em tempo real do total enquanto o usuário digita
  const parsedCurrentTotal = accountDrafts.reduce(
    (sum, a) => sum + parseCurrencyInput(a.rawInput),
    0,
  );

  // Quanto sobra após pagar este dia
  const diffAfterDay = (isOpen ? parsedCurrentTotal : total) - dayPendingAmount;
  const isCovered = diffAfterDay >= 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 active:bg-white/25 transition-all text-[11px] font-medium text-white border border-white/20 cursor-pointer select-none text-left shadow-sm"
          title="Clique para gerenciar contas, métodos e saldos bancários manuais"
        >
          <Wallet className="h-3.5 w-3.5 text-blue-200 group-hover:scale-110 transition-transform shrink-0" />

          {/* Opções de saldo sutis lado a lado */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-[11px]">
            {accounts.map((acc) => (
              <span
                key={acc.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 text-blue-100 font-medium"
              >
                {acc.name}:{" "}
                <strong className="text-white font-bold">{formatCurrencyBRL(acc.balance)}</strong>
              </span>
            ))}
          </div>

          {/* Total & Capacidade de Pagamento do dia */}
          <div className="ml-1 pl-2 border-l border-white/25 flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-blue-200 font-medium">Total:</span>
            <span className="text-[11px] font-black text-white tracking-tight">
              {formatCurrencyBRL(total)}
            </span>

            {dayPendingAmount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-tight transition-colors ${
                  isCovered
                    ? "bg-emerald-500/40 text-emerald-100 border border-emerald-300/50 shadow-xs"
                    : "bg-rose-500/40 text-rose-100 border border-rose-300/50 shadow-xs"
                }`}
                title={`Pendente neste quadrante: ${formatCurrencyBRL(dayPendingAmount)}. ${
                  isCovered
                    ? `Saldo cobre o dia com sobra de ${formatCurrencyBRL(diffAfterDay)}`
                    : `Atenção: saldo insuficiente, faltam ${formatCurrencyBRL(Math.abs(diffAfterDay))}`
                }`}
              >
                {isCovered
                  ? `Cobre (+${formatCurrencyBRL(diffAfterDay)})`
                  : `Falta (${formatCurrencyBRL(Math.abs(diffAfterDay))})`}
              </span>
            )}

            <Pencil className="h-3 w-3 text-blue-200 opacity-70 group-hover:opacity-100 transition-opacity ml-0.5" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] sm:w-[460px] p-4 space-y-4" align="start">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-foreground">
                  Saldos Bancários & Métodos de Pagamento
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Adicione, edite ou exclua métodos/bancos. Reconhece valores com vírgula (4901,17),
                  mil, milhão, etc.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddAccount("NOVA CONTA")}
              className="h-7 text-xs px-2 gap-1 text-primary border-primary/30 hover:bg-primary/10 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Método
            </Button>
          </div>

          {/* Atalhos rápidos para adicionar métodos comuns se não existirem */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">Sugestões:</span>
            {["JAM", "GBM", "TON", "SICREDI", "BOLETO", "NUBANK", "DINHEIRO"].map((tag) => {
              const alreadyExists = accountDrafts.some((a) => a.name.trim().toUpperCase() === tag);
              if (alreadyExists) return null;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddAccount(tag)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-primary/15 hover:text-primary transition-colors border border-border/60 cursor-pointer"
                >
                  +{tag}
                </button>
              );
            })}
          </div>

          {/* Lista de Contas Editáveis */}
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {accountDrafts.map((draft, idx) => {
              const parsedVal = parseCurrencyInput(draft.rawInput);
              return (
                <div
                  key={draft.id}
                  className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/20 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <Label
                        htmlFor={`acc-name-${draft.id}`}
                        className="text-[10px] text-muted-foreground font-semibold flex items-center justify-between"
                      >
                        <span>Nome do Método / Banco #{idx + 1}</span>
                      </Label>
                      <Input
                        id={`acc-name-${draft.id}`}
                        type="text"
                        value={draft.name}
                        onChange={(e) => handleUpdateName(draft.id, e.target.value)}
                        placeholder="Ex: JAM, TON, BOLETO, NUBANK..."
                        className="h-7 text-xs font-bold uppercase mt-0.5"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAccount(draft.id)}
                      className="h-7 w-7 text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 mt-4 shrink-0"
                      title="Excluir este método/banco"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div>
                    <Label
                      htmlFor={`acc-val-${draft.id}`}
                      className="text-[10px] text-muted-foreground font-medium"
                    >
                      Saldo Atual (aceita 4901,17 | 5 mil | 1.5m)
                    </Label>
                    <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-xs h-8 mt-0.5">
                      <span className="bg-muted/70 px-2.5 h-full flex items-center justify-center border-r border-input text-xs font-semibold text-muted-foreground select-none shrink-0 font-mono">
                        R$
                      </span>
                      <Input
                        id={`acc-val-${draft.id}`}
                        type="text"
                        value={draft.rawInput}
                        onChange={(e) => handleUpdateBalance(draft.id, e.target.value)}
                        placeholder="0,00"
                        className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-2.5 text-xs font-mono font-bold"
                      />
                    </div>

                    {/* Leitura em tempo real do valor interpretado */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
                      <span>Valor interpretado:</span>
                      <span className="font-bold text-foreground font-mono">
                        {formatCurrencyBRL(parsedVal)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparativo de Pagamento do Dia com Total Calculado Instantaneamente */}
          <div className="rounded-lg bg-muted/50 p-2.5 space-y-1.5 border border-border/60 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">
                Soma de todos os saldos ({accountDrafts.length} métodos):
              </span>
              <strong className="text-sm font-black text-foreground font-mono">
                {formatCurrencyBRL(parsedCurrentTotal)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span>A pagar neste dia (pendente):</span>
              <span className="font-semibold text-foreground font-mono">
                {formatCurrencyBRL(dayPendingAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-medium text-muted-foreground">Previsão pós-pagamento:</span>
              <span
                className={`font-bold flex items-center gap-1 font-mono ${
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
                {formatCurrencyBRL(parsedCurrentTotal - dayPendingAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddAccount("NOVO MÉTODO")}
              className="h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Método
            </Button>

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
