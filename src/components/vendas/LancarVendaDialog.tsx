import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  UtensilsCrossed,
  ShoppingBag,
  Smartphone,
  Bike,
  PhoneCall,
  Save,
  CheckCircle2,
  Loader2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCurrency,
  getTodayDateString,
  useSaveFullDaySales,
  fetchSalesForDate,
} from "@/lib/vendas";
import type { DailySaleRecord, QuickDayEntryForm } from "@/lib/vendas-types";
import { SALES_CHANNELS } from "@/lib/vendas-types";
import { useAuth } from "@/lib/auth";

interface LancarVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  existingRecords?: DailySaleRecord[];
}

export function LancarVendaDialog({
  open,
  onOpenChange,
  initialDate,
  existingRecords = [],
}: LancarVendaDialogProps) {
  const { user } = useAuth();
  const saveFullDaySales = useSaveFullDaySales();

  const [date, setDate] = useState<string>(initialDate || getTodayDateString());
  const [currentDayRecords, setCurrentDayRecords] = useState<DailySaleRecord[]>([]);
  const [isCheckingDate, setIsCheckingDate] = useState<boolean>(false);

  const [balcao, setBalcao] = useState<string>("");
  const [ifood, setIfood] = useState<string>("");
  const [anotaAi, setAnotaAi] = useState<string>("");
  const [noventaENove, setNoventaENove] = useState<string>("");
  const [swFast, setSwFast] = useState<string>("");
  const [ordersCount, setOrdersCount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const loadExistingForDate = useCallback(
    async (selectedDate: string) => {
      let forDay = existingRecords.filter((r) => r.date === selectedDate);
      if (forDay.length === 0) {
        setIsCheckingDate(true);
        try {
          forDay = await fetchSalesForDate(selectedDate);
        } catch (err) {
          console.error("Erro ao verificar data:", err);
        } finally {
          setIsCheckingDate(false);
        }
      }

      setCurrentDayRecords(forDay);

      if (forDay.length > 0) {
        const b = forDay.find((r) => r.channel === "balcao_salao")?.amount;
        const f = forDay.find((r) => r.channel === "delivery_ifood")?.amount;
        const a = forDay.find((r) => r.channel === "delivery_anota_ai")?.amount;
        const n = forDay.find((r) => r.channel === "delivery_99")?.amount;
        const s = forDay.find((r) => r.channel === "delivery_sw_fast")?.amount;

        setBalcao(b ? String(b) : "");
        setIfood(f ? String(f) : "");
        setAnotaAi(a ? String(a) : "");
        setNoventaENove(n ? String(n) : "");
        setSwFast(s ? String(s) : "");

        const anyNotes = forDay.find((r) => r.notes)?.notes || "";
        const anyOrders = forDay.reduce((acc, curr) => acc + (curr.orders_count || 0), 0);
        setNotes(anyNotes);
        setOrdersCount(anyOrders > 0 ? String(anyOrders) : "");
      } else {
        setBalcao("");
        setIfood("");
        setAnotaAi("");
        setNoventaENove("");
        setSwFast("");
        setOrdersCount("");
        setNotes("");
      }
    },
    [existingRecords],
  );

  // Preenche dados quando muda a data ou abre o modal
  useEffect(() => {
    const targetDate = initialDate || getTodayDateString();
    setDate(targetDate);
    loadExistingForDate(targetDate);
  }, [open, initialDate, loadExistingForDate]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    loadExistingForDate(newDate);
  }

  // Cálculos em tempo real
  const numBalcao = Number(balcao.replace(",", ".")) || 0;
  const numIfood = Number(ifood.replace(",", ".")) || 0;
  const numAnotaAi = Number(anotaAi.replace(",", ".")) || 0;
  const num99 = Number(noventaENove.replace(",", ".")) || 0;
  const numSwFast = Number(swFast.replace(",", ".")) || 0;

  const totalDelivery = numIfood + numAnotaAi + num99 + numSwFast;
  const totalGeral = numBalcao + totalDelivery;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!date) {
      toast.error("Por favor, selecione uma data para o lançamento.");
      return;
    }

    if (totalGeral <= 0) {
      toast.error("Informe o valor de venda em pelo menos um dos canais.");
      return;
    }

    const form: QuickDayEntryForm = {
      date,
      balcao_salao: numBalcao,
      delivery_ifood: numIfood,
      delivery_anota_ai: numAnotaAi,
      delivery_99: num99,
      delivery_sw_fast: numSwFast,
      ...(ordersCount ? { orders_count: Number(ordersCount) } : {}),
      notes,
    };

    try {
      await saveFullDaySales.mutateAsync({
        form,
        existingRecords: currentDayRecords.length > 0 ? currentDayRecords : existingRecords,
        userName: user?.fullName || user?.email || "Administrador",
      });

      const [y, m, d] = date.split("-");
      toast.success(`Vendas do dia ${d}/${m}/${y} salvas com sucesso!`, {
        description: `Total faturado: ${formatCurrency(totalGeral)} (Balcão: ${formatCurrency(numBalcao)} | Delivery: ${formatCurrency(totalDelivery)})`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar vendas do dia:", err);
      toast.error("Falha ao salvar vendas no banco de dados. Tente novamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              Lançar Vendas Diárias por Canal
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Informe o faturamento do dia para cada canal de atendimento da Galeteria Brasão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Seletor de Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end p-3 rounded-lg bg-muted/40 border border-border/70">
              <div className="space-y-1.5">
                <Label
                  htmlFor="venda-date"
                  className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Data da Venda *
                </Label>
                <Input
                  id="venda-date"
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="font-medium bg-background"
                  required
                />
                <div className="min-h-[18px]">
                  {isCheckingDate ? (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" /> Verificando dia...
                    </span>
                  ) : currentDayRecords.length > 0 ? (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Dia já cadastrado (modo de edição
                      ativado)
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Novo lançamento para esta data
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="venda-orders"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Nº Pedidos / Clientes (Opcional)
                </Label>
                <Input
                  id="venda-orders"
                  type="number"
                  min="0"
                  placeholder="Ex: 120 pedidos"
                  value={ordersCount}
                  onChange={(e) => setOrdersCount(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* SEÇÃO 1: BALCÃO / SALÃO */}
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Balcão / Salão
                    </h4>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                      Pessoas que almoçam no local ou compram para viagem no balcão
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  Presencial
                </span>
              </div>

              <div className="relative pt-1">
                <span className="absolute left-3 top-3.5 text-xs font-semibold text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={balcao}
                  onChange={(e) => setBalcao(e.target.value)}
                  className="pl-9 text-base font-bold bg-background text-emerald-700 dark:text-emerald-300"
                />
              </div>
            </div>

            {/* SEÇÃO 2: CANAIS DE DELIVERY */}
            <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bike className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Canais de Delivery</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Pedidos entregues (Marketplaces, app próprio e telefone)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Subtotal Delivery
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {formatCurrency(totalDelivery)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* iFood */}
                <div className="space-y-1 p-2.5 rounded-md border border-rose-200/70 bg-rose-50/30 dark:bg-rose-950/10 dark:border-rose-900/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-rose-600" />
                      iFood
                    </span>
                    <span className="text-[10px] uppercase text-rose-600/80 font-normal">App</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={ifood}
                      onChange={(e) => setIfood(e.target.value)}
                      className="pl-8 h-9 text-sm font-bold bg-background"
                    />
                  </div>
                </div>

                {/* Anota Aí */}
                <div className="space-y-1 p-2.5 rounded-md border border-sky-200/70 bg-sky-50/30 dark:bg-sky-950/10 dark:border-sky-900/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-sky-800 dark:text-sky-300">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                      Anota Aí
                    </span>
                    <span className="text-[10px] uppercase text-sky-600/80 font-normal">
                      Cardápio Web
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={anotaAi}
                      onChange={(e) => setAnotaAi(e.target.value)}
                      className="pl-8 h-9 text-sm font-bold bg-background"
                    />
                  </div>
                </div>

                {/* 99Food */}
                <div className="space-y-1 p-2.5 rounded-md border border-amber-200/70 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Bike className="h-3.5 w-3.5 text-amber-600" />
                      99Food
                    </span>
                    <span className="text-[10px] uppercase text-amber-600/80 font-normal">
                      App 99
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={noventaENove}
                      onChange={(e) => setNoventaENove(e.target.value)}
                      className="pl-8 h-9 text-sm font-bold bg-background"
                    />
                  </div>
                </div>

                {/* SW Fast */}
                <div className="space-y-1 p-2.5 rounded-md border border-violet-200/70 bg-violet-50/30 dark:bg-violet-950/10 dark:border-violet-900/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-violet-800 dark:text-violet-300">
                    <span className="flex items-center gap-1.5">
                      <PhoneCall className="h-3.5 w-3.5 text-violet-600" />
                      SW Fast
                    </span>
                    <span className="text-[10px] uppercase text-violet-600/80 font-normal">
                      Ligação / Fone
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={swFast}
                      onChange={(e) => setSwFast(e.target.value)}
                      className="pl-8 h-9 text-sm font-bold bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="venda-notes" className="text-xs text-muted-foreground font-medium">
                Observações do dia (opcional)
              </Label>
              <Textarea
                id="venda-notes"
                placeholder="Ex: Dia chuvoso com forte demanda de delivery; almoço de feriado no salão."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs bg-background resize-none"
              />
            </div>

            {/* RESUMO DO TOTAL DO DIA */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-muted-foreground block">
                  Faturamento Total do Dia
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Balcão ({formatCurrency(numBalcao)}) + Delivery ({formatCurrency(totalDelivery)})
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                  {formatCurrency(totalGeral)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saveFullDaySales.isPending}
              className="w-full sm:w-auto gap-1.5 font-semibold"
            >
              <Save className="h-4 w-4" />
              {saveFullDaySales.isPending ? "Salvando no Banco..." : "Salvar Vendas do Dia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
