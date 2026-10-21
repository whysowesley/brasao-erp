import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Bike,
  Truck,
  Plus,
  Save,
  Trash2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeliveryConfig,
  useSaveDailyDeliveryEntry,
  useDeleteDailyDeliveryEntry,
  classifyDeliveryCost,
  buildDeliveryEntryFromInput,
} from "@/lib/delivery";
import { type DailyDeliveryEntry, DEFAULT_DELIVERY_CONFIG } from "@/lib/delivery-types";
import { useAuth } from "@/lib/auth";

interface DeliveryDayEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  existingEntry?: DailyDeliveryEntry | null;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
}

export function DeliveryDayEntryDialog({
  open,
  onOpenChange,
  initialDate,
  existingEntry,
}: DeliveryDayEntryDialogProps) {
  const { data: config = DEFAULT_DELIVERY_CONFIG } = useDeliveryConfig();
  const saveMutation = useSaveDailyDeliveryEntry();
  const deleteMutation = useDeleteDailyDeliveryEntry();
  const { profile } = useAuth();

  const [date, setDate] = useState<string>(initialDate || format(new Date(), "yyyy-MM-dd"));

  // Própria
  const [propriaCorridas, setPropriaCorridas] = useState<number>(0);
  const [propriaTaxa, setPropriaTaxa] = useState<number>(config.propria_taxa_por_corrida);
  const [propriaDiaria, setPropriaDiaria] = useState<number>(config.propria_diaria_padrao);
  const [propriaQtdDiarias, setPropriaQtdDiarias] = useState<number>(1);
  const [propriaObs, setPropriaObs] = useState<string>("");

  // Gami
  const [gamiCorridas, setGamiCorridas] = useState<number>(0);
  const [gamiCustoTotal, setGamiCustoTotal] = useState<number>(0);
  const [gamiObs, setGamiObs] = useState<string>("");

  // Populate when dialog opens or changes
  useEffect(() => {
    if (open) {
      if (existingEntry) {
        setDate(existingEntry.date);
        setPropriaCorridas(existingEntry.propria_corridas);
        setPropriaTaxa(existingEntry.propria_valor_por_corrida || config.propria_taxa_por_corrida);
        setPropriaDiaria(existingEntry.propria_diaria || config.propria_diaria_padrao);
        setPropriaQtdDiarias(
          existingEntry.propria_qtd_diarias ?? (existingEntry.propria_corridas > 0 ? 1 : 0),
        );
        setPropriaObs(existingEntry.propria_observacoes || "");

        setGamiCorridas(existingEntry.gami_corridas);
        setGamiCustoTotal(existingEntry.gami_custo_total);
        setGamiObs(existingEntry.gami_observacoes || "");
      } else {
        const targetDate = initialDate || format(new Date(), "yyyy-MM-dd");
        setDate(targetDate);
        setPropriaCorridas(0);
        setPropriaTaxa(config.propria_taxa_por_corrida);
        setPropriaDiaria(config.propria_diaria_padrao);
        setPropriaQtdDiarias(1);
        setPropriaObs("");

        setGamiCorridas(0);
        setGamiCustoTotal(0);
        setGamiObs("");
      }
    }
  }, [open, existingEntry, initialDate, config]);

  // Cálculos em tempo real
  const preview = useMemo(() => {
    return buildDeliveryEntryFromInput(
      {
        date,
        propria_corridas: propriaCorridas,
        propria_valor_por_corrida: propriaTaxa,
        propria_diaria: propriaDiaria,
        propria_qtd_diarias: propriaQtdDiarias,
        propria_observacoes: propriaObs,
        gami_corridas: gamiCorridas,
        gami_custo_total: gamiCustoTotal,
        gami_observacoes: gamiObs,
      },
      config,
    );
  }, [
    date,
    propriaCorridas,
    propriaTaxa,
    propriaDiaria,
    propriaQtdDiarias,
    propriaObs,
    gamiCorridas,
    gamiCustoTotal,
    gamiObs,
    config,
  ]);

  const propriaStatus = classifyDeliveryCost(
    preview.propria_ticket_medio,
    config.propria_thresholds,
  );
  const gamiStatus = classifyDeliveryCost(preview.gami_ticket_medio, config.gami_thresholds);

  const handleSave = async () => {
    if (!date) {
      toast.error("Informe a data do lançamento.");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        date,
        propria_corridas: propriaCorridas,
        propria_valor_por_corrida: propriaTaxa,
        propria_diaria: propriaDiaria,
        propria_qtd_diarias: propriaQtdDiarias,
        propria_observacoes: propriaObs,
        gami_corridas: gamiCorridas,
        gami_custo_total: gamiCustoTotal,
        gami_observacoes: gamiObs,
        userName: profile?.fullName || "Usuário",
      });
      toast.success(
        `Lançamento de delivery para ${format(parseISO(date), "dd/MM/yyyy")} salvo com sucesso!`,
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar lançamento de delivery.";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    try {
      await deleteMutation.mutateAsync({
        id: existingEntry.id,
        monthKey: existingEntry.month_key,
      });
      toast.success("Lançamento de delivery excluído com sucesso.");
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir.";
      toast.error(msg);
    }
  };

  const formattedDateTitle = useMemo(() => {
    try {
      return format(parseISO(date), "EEEE, dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    } catch {
      return date;
    }
  }, [date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {existingEntry
                  ? "Editar Lançamento de Delivery"
                  : "Novo Lançamento Diário de Delivery"}
              </DialogTitle>
              <DialogDescription className="text-xs capitalize">
                {formattedDateTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Seletor de Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-muted/40 p-3 rounded-lg border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data da Operação</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 font-medium"
              />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>
                Preencha as corridas próprias e/ou terceirizadas (Gami) do dia. Os custos médios e
                comparativos são calculados automaticamente.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Entregas Próprias */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <Bike className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">
                    Entregas Próprias (Motoboys)
                  </h4>
                </div>
                {preview.propria_corridas > 0 && (
                  <Badge variant="outline" className={propriaStatus.badgeClass}>
                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${propriaStatus.dotColor}`} />
                    {propriaStatus.label}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Quantidade de Corridas</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ex: 18"
                    value={propriaCorridas || ""}
                    onChange={(e) => setPropriaCorridas(parseInt(e.target.value, 10) || 0)}
                    className="h-9 font-semibold text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Valor/Corrida (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.10"
                      min="0"
                      value={propriaTaxa}
                      onChange={(e) => setPropriaTaxa(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Diária Fixa (R$)
                    </Label>
                    <Input
                      type="number"
                      step="1.00"
                      min="0"
                      value={propriaDiaria}
                      onChange={(e) => setPropriaDiaria(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Qtd. de Diárias (Motoboys no Dia)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={propriaQtdDiarias}
                    onChange={(e) => setPropriaQtdDiarias(parseInt(e.target.value, 10) || 0)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Resumo do Cálculo da Própria */}
                <div className="p-3 rounded-lg bg-card border text-xs space-y-1.5 shadow-2xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      Custo Variável ({preview.propria_corridas} ×{" "}
                      {formatCurrency(preview.propria_valor_por_corrida)}):
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(preview.propria_custo_variavel)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo Fixo ({preview.propria_qtd_diarias} diária(s)):</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(preview.propria_custo_fixo)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t text-sm font-bold">
                    <span>Custo Total Própria:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(preview.propria_custo_total)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t items-center">
                    <span className="text-xs font-semibold">Custo Médio / Corrida:</span>
                    <span className="text-base font-extrabold text-foreground">
                      {preview.propria_corridas > 0
                        ? formatCurrency(preview.propria_ticket_medio)
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Observação da Própria (opcional)
                  </Label>
                  <Input
                    placeholder="Ex: Chuva à noite, 2 entregadores..."
                    value={propriaObs}
                    onChange={(e) => setPropriaObs(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Entregas Gami / Terceirizadas */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-500/20 text-blue-700 dark:text-blue-400">
                    <Truck className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">
                    Entregas Gami / Terceirizadas
                  </h4>
                </div>
                {preview.gami_corridas > 0 && (
                  <Badge variant="outline" className={gamiStatus.badgeClass}>
                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${gamiStatus.dotColor}`} />
                    {gamiStatus.label}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Quantidade de Corridas Gami</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ex: 18"
                    value={gamiCorridas || ""}
                    onChange={(e) => setGamiCorridas(parseInt(e.target.value, 10) || 0)}
                    className="h-9 font-semibold text-base"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Valor Total Gasto no Gami (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 100.00"
                      value={gamiCustoTotal || ""}
                      onChange={(e) => setGamiCustoTotal(parseFloat(e.target.value) || 0)}
                      className="pl-9 h-9 font-semibold text-base"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Fatura total ou extrato de repasse do dia com a Gami.
                  </p>
                </div>

                {/* Resumo do Cálculo Gami */}
                <div className="p-3 rounded-lg bg-card border text-xs space-y-1.5 shadow-2xs mt-4">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Corridas Realizadas:</span>
                    <span className="font-semibold text-foreground">{preview.gami_corridas}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo Total Informado:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(preview.gami_custo_total)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t items-center">
                    <span className="text-xs font-semibold">Custo Médio / Corrida:</span>
                    <span className="text-base font-extrabold text-foreground">
                      {preview.gami_corridas > 0 ? formatCurrency(preview.gami_ticket_medio) : "—"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1 border-t">
                    Fórmula: R$ {preview.gami_custo_total.toFixed(2)} ÷ {preview.gami_corridas || 1}{" "}
                    ={" "}
                    {preview.gami_corridas > 0
                      ? formatCurrency(preview.gami_ticket_medio)
                      : "R$ 0,00"}
                  </p>
                </div>

                <div className="space-y-1 pt-4">
                  <Label className="text-[11px] text-muted-foreground">
                    Observação da Gami (opcional)
                  </Label>
                  <Input
                    placeholder="Ex: Horário de pico com taxa dinâmica..."
                    value={gamiObs}
                    onChange={(e) => setGamiObs(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comparativo do Dia */}
          {(preview.propria_corridas > 0 || preview.gami_corridas > 0) && (
            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Consolidado do Dia & Comparativo
              </h5>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-card border">
                  <span className="text-[11px] text-muted-foreground block">Total de Corridas</span>
                  <span className="text-lg font-extrabold text-foreground">
                    {preview.total_corridas}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border">
                  <span className="text-[11px] text-muted-foreground block">Custo Total Geral</span>
                  <span className="text-lg font-extrabold text-foreground">
                    {formatCurrency(preview.total_custo)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border">
                  <span className="text-[11px] text-muted-foreground block">
                    Custo Médio Ponderado
                  </span>
                  <span className="text-lg font-extrabold text-primary">
                    {formatCurrency(preview.ticket_medio_geral)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border">
                  <span className="text-[11px] text-muted-foreground block">
                    Mais Econômica no Dia
                  </span>
                  <span className="text-sm font-bold capitalize">
                    {preview.mais_vantajoso === "propria" && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Própria ({formatCurrency(Math.abs(preview.diferenca_ticket))} mais barata)
                      </span>
                    )}
                    {preview.mais_vantajoso === "gami" && (
                      <span className="text-blue-600 dark:text-blue-400">
                        Gami ({formatCurrency(Math.abs(preview.diferenca_ticket))} mais barata)
                      </span>
                    )}
                    {preview.mais_vantajoso === "empate" && (
                      <span className="text-muted-foreground">Empate técnico</span>
                    )}
                    {preview.mais_vantajoso === "apenas_propria" && (
                      <span className="text-emerald-600 dark:text-emerald-400">100% Própria</span>
                    )}
                    {preview.mais_vantajoso === "apenas_gami" && (
                      <span className="text-blue-600 dark:text-blue-400">100% Gami</span>
                    )}
                    {preview.mais_vantajoso === "sem_corridas" && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4">
          {existingEntry ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Dia
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
