import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wallet,
  Pencil,
  Check,
  Building,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Coins,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useBankBalances,
  useUpdateBankBalances,
  type BalanceAccount,
  type RollingDayBalance,
} from "@/lib/bank-balances";
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
  date?: string;
  rollingBalance?: RollingDayBalance;
}

interface AccountDraft {
  id: string;
  name: string;
  rawInput: string;
}

export function BankBalancesBar({
  dayPendingAmount,
  dayTotalAmount: _dayTotalAmount,
  canWrite = true,
  compact = false,
  date,
  rollingBalance,
}: BankBalancesBarProps) {
  // Fallback para hook isolado se rollingBalance não for fornecido
  const fallbackQuery = useBankBalances(date);
  const updateMutation = useUpdateBankBalances(date);

  const [isOpen, setIsOpen] = useState(false);

  // Valores efetivos do dia
  const effectiveCarriedBalance =
    rollingBalance?.carriedBalance !== undefined
      ? rollingBalance.carriedBalance
      : fallbackQuery.carriedBalance || 0;

  const effectiveAccounts =
    rollingBalance?.accounts && rollingBalance.accounts.length > 0
      ? rollingBalance.accounts
      : fallbackQuery.accounts;

  const effectiveTotal =
    rollingBalance?.total !== undefined ? rollingBalance.total : fallbackQuery.total;

  const isCarriedFromPrior = Boolean(rollingBalance?.isCarriedFromPrior);
  const priorDate = rollingBalance?.priorDate || null;
  const priorRemaining = rollingBalance?.priorRemaining || 0;
  const isInitiallyManual = Boolean(rollingBalance?.isManualCarried);

  // Estados locais do formulário dentro do Popover
  const [carriedDraft, setCarriedDraft] = useState<string>("");
  const [isManualCarriedDraft, setIsManualCarriedDraft] = useState<boolean>(false);
  const [accountDrafts, setAccountDrafts] = useState<AccountDraft[]>([]);

  // Sincroniza rascunhos apenas quando abre o popover para não resetar enquanto digita
  useEffect(() => {
    if (isOpen) {
      setCarriedDraft(
        effectiveCarriedBalance > 0 ? formatCurrencyInputValue(effectiveCarriedBalance) : "",
      );
      setIsManualCarriedDraft(isInitiallyManual);

      setAccountDrafts(
        effectiveAccounts.length > 0
          ? effectiveAccounts.map((a) => ({
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
  }, [isOpen, effectiveCarriedBalance, effectiveAccounts, isInitiallyManual]);

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

  const handleRestoreAutoCarried = () => {
    setCarriedDraft(priorRemaining > 0 ? formatCurrencyInputValue(priorRemaining) : "");
    setIsManualCarriedDraft(false);
    toast.info("Saldo restaurado para o cálculo automático do dia anterior.");
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar saldos.");
      return;
    }

    const parsedCarried = parseCurrencyInput(carriedDraft);
    const parsedAccounts: BalanceAccount[] = accountDrafts.map((a) => ({
      id: a.id,
      name: a.name.trim() || "CONTA",
      balance: parseCurrencyInput(a.rawInput),
    }));

    // Determina se deve gravar manual_carried_balance
    let manualCarriedValue: number | null = null;
    if (isManualCarriedDraft) {
      manualCarriedValue = parsedCarried;
    } else if (isCarriedFromPrior && parsedCarried !== priorRemaining) {
      manualCarriedValue = parsedCarried;
    }

    try {
      await updateMutation.mutateAsync({
        date,
        carried_balance: parsedCarried,
        manual_carried_balance: manualCarriedValue,
        accounts: parsedAccounts,
        is_manually_saved: true,
      });

      toast.success(
        date
          ? `Saldos do dia ${format(parseISO(date), "dd/MM")} salvos com sucesso!`
          : "Saldos e métodos salvos com sucesso!",
      );
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar saldos.";
      toast.error(msg);
    }
  };

  // Cálculos em tempo real enquanto o usuário edita no Popover
  const liveCarried = parseCurrencyInput(carriedDraft);
  const liveAccountsSum = accountDrafts.reduce((sum, a) => sum + parseCurrencyInput(a.rawInput), 0);
  const liveGrandTotal = Math.round((liveCarried + liveAccountsSum) * 100) / 100;

  const currentTotal = isOpen ? liveGrandTotal : effectiveTotal;
  const currentDiffAfterDay = currentTotal - dayPendingAmount;
  const currentIsCovered = currentDiffAfterDay >= 0;
  const liveRemainingAfterDay = Math.max(0, currentDiffAfterDay);

  const formattedPriorDate = priorDate
    ? format(parseISO(priorDate), "dd 'de' MMMM", { locale: ptBR })
    : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 active:bg-white/25 transition-all font-medium text-white border border-white/20 cursor-pointer select-none text-left shadow-sm ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
          title={`Clique para gerenciar saldos deste dia (${
            date ? format(parseISO(date), "dd/MM/yyyy") : "manual"
          })`}
        >
          <Wallet className="h-3.5 w-3.5 text-blue-200 group-hover:scale-110 transition-transform shrink-0" />

          {/* Opções de saldo sutis lado a lado */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-[11px]">
            {/* Flag Editável de SALDO (Restante do dia anterior) */}
            {(isCarriedFromPrior || effectiveCarriedBalance > 0) && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold border ${
                  effectiveCarriedBalance > 0
                    ? "bg-amber-400/25 text-amber-100 border-amber-300/40 shadow-2xs"
                    : "bg-black/15 text-blue-200 border-transparent"
                }`}
                title={
                  priorDate
                    ? `Saldo restante transportado do dia anterior (${format(
                        parseISO(priorDate),
                        "dd/MM",
                      )}): ${formatCurrencyBRL(effectiveCarriedBalance)}`
                    : `Saldo transportado: ${formatCurrencyBRL(effectiveCarriedBalance)}`
                }
              >
                <span>SALDO:</span>
                <strong className="text-white font-bold">
                  {formatCurrencyBRL(effectiveCarriedBalance)}
                </strong>
              </span>
            )}

            {/* Contas bancárias (JAM, GBM, TON, SICREDI, etc.) */}
            {effectiveAccounts.map((acc) => (
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
              {formatCurrencyBRL(effectiveTotal)}
            </span>

            {dayPendingAmount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-tight transition-colors ${
                  currentIsCovered
                    ? "bg-emerald-500/40 text-emerald-100 border border-emerald-300/50 shadow-xs"
                    : "bg-rose-500/40 text-rose-100 border border-rose-300/50 shadow-xs"
                }`}
                title={`Pendente neste quadrante: ${formatCurrencyBRL(dayPendingAmount)}. ${
                  currentIsCovered
                    ? `Saldo cobre o dia com sobra de ${formatCurrencyBRL(currentDiffAfterDay)}`
                    : `Atenção: saldo insuficiente, faltam ${formatCurrencyBRL(
                        Math.abs(currentDiffAfterDay),
                      )}`
                }`}
              >
                {currentIsCovered
                  ? `Cobre (+${formatCurrencyBRL(currentDiffAfterDay)})`
                  : `Falta (${formatCurrencyBRL(Math.abs(currentDiffAfterDay))})`}
              </span>
            )}

            <Pencil className="h-3 w-3 text-blue-200 opacity-70 group-hover:opacity-100 transition-opacity ml-0.5" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] sm:w-[480px] p-4 space-y-4" align="start">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Cabeçalho do Popover */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-foreground">
                  {date
                    ? `Saldos Bancários — ${format(parseISO(date), "dd/MM/yyyy")}`
                    : "Saldos Bancários & Métodos"}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  O saldo restante do dia anterior é herdado e as contas começam zeradas para novo
                  abastecimento.
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

          {/* SEÇÃO 1: Flag Editável de SALDO (Restante do Dia Anterior) */}
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  FLAG SALDO (Restante do Dia Anterior)
                </span>
              </div>

              {isCarriedFromPrior && !isManualCarriedDraft && (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/40 font-semibold gap-1"
                >
                  <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                  Calculado automaticamente
                </Badge>
              )}

              {isManualCarriedDraft && (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-400/40 font-semibold"
                >
                  Valor manual fixado
                </Badge>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {isCarriedFromPrior && formattedPriorDate ? (
                <>
                  Restante transportado após pagar as contas de{" "}
                  <strong className="text-foreground">{formattedPriorDate}</strong>. Caso você lance
                  ou altere alguma conta daquele dia, este valor se corrige automaticamente.
                </>
              ) : (
                "Saldo transportado ou valor inicial em caixa. Você pode editar este valor a qualquer momento."
              )}
            </p>

            <div>
              <div className="flex items-center rounded-md border border-amber-500/40 bg-background overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500 transition-all shadow-xs h-8">
                <span className="bg-amber-500/20 px-2.5 h-full flex items-center justify-center border-r border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300 select-none shrink-0 font-mono">
                  R$
                </span>
                <Input
                  id="flag-saldo-input"
                  type="text"
                  value={carriedDraft}
                  onChange={(e) => {
                    setCarriedDraft(e.target.value);
                    setIsManualCarriedDraft(true);
                  }}
                  placeholder="0,00"
                  className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-2.5 text-xs font-mono font-black text-foreground"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
                <span>
                  Valor interpretado:{" "}
                  <strong className="text-foreground font-mono">
                    {formatCurrencyBRL(liveCarried)}
                  </strong>
                </span>

                {isCarriedFromPrior && isManualCarriedDraft && (
                  <button
                    type="button"
                    onClick={handleRestoreAutoCarried}
                    className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar automático ({formatCurrencyBRL(priorRemaining)})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Abastecer Contas deste Dia (JAM, GBM, TON, SICREDI...) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <span>Abastecer Contas deste Dia (JAM, GBM, TON, etc.)</span>
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  As contas começam zeradas para você abastecer manualmente conforme novas entradas.
                </p>
              </div>
            </div>

            {/* Sugestões de contas rápidas */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">Sugestões:</span>
              {["JAM", "GBM", "TON", "SICREDI", "BOLETO", "NUBANK", "DINHEIRO"].map((tag) => {
                const alreadyExists = accountDrafts.some(
                  (a) => a.name.trim().toUpperCase() === tag,
                );
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

            {/* Lista de Contas */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
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
                          <span>Método / Banco #{idx + 1}</span>
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
                        Abastecimento neste Dia (0 = sem novas entradas)
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
          </div>

          {/* SEÇÃO 3: Resumo do Dia & Comparativo Completo */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 border border-border/60 text-xs">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Flag SALDO (Restante do dia anterior):</span>
              <strong className="text-foreground font-mono font-semibold">
                {formatCurrencyBRL(liveCarried)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Novos abastecimentos em contas ({accountDrafts.length} métodos):</span>
              <strong className="text-foreground font-mono font-semibold">
                {formatCurrencyBRL(liveAccountsSum)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40 font-bold">
              <span className="text-foreground font-bold">Saldo Total Disponível no Dia:</span>
              <strong className="text-sm font-black text-primary font-mono">
                {formatCurrencyBRL(liveGrandTotal)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span>Contas lançadas para pagar neste dia:</span>
              <span className="font-semibold text-foreground font-mono">
                {formatCurrencyBRL(dayPendingAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
              <span className="font-medium text-muted-foreground">
                Sobra prevista para o próximo dia:
              </span>
              <span
                className={`font-bold flex items-center gap-1 font-mono ${
                  currentIsCovered
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {currentIsCovered ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {formatCurrencyBRL(liveRemainingAfterDay)}
              </span>
            </div>
          </div>

          {/* Botões de Ação */}
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
                {date
                  ? `Salvar Saldo deste Dia (${format(parseISO(date), "dd/MM")})`
                  : "Salvar Saldos"}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
