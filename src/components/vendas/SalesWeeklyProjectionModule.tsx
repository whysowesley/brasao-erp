import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  PartyPopper,
  Percent,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  formatCurrency,
  getTodayDateString,
  useAtypicalDays,
  useToggleAtypicalDay,
  computeWeeklySalesProjection,
} from "@/lib/vendas";
import type {
  DailySaleRecord,
  DayProjectionItem,
  MonthSalesProjectionMetrics,
  WeekdayWeightMetric,
} from "@/lib/vendas-types";

interface SalesWeeklyProjectionModuleProps {
  salesRecords: DailySaleRecord[];
  monthKey: string;
  onOpenSaleEntry: (date: string) => void;
  canWrite?: boolean;
}

export function SalesWeeklyProjectionModule({
  salesRecords,
  monthKey,
  onOpenSaleEntry,
  canWrite = true,
}: SalesWeeklyProjectionModuleProps) {
  const todayStr = useMemo(() => getTodayDateString(), []);

  // View state: 'tabela' | 'calendario' | 'dpi'
  const [viewMode, setViewMode] = useState<"tabela" | "calendario" | "dpi">("tabela");

  // Filtro de exibição
  const [filterOnlyAtypical, setFilterOnlyAtypical] = useState<boolean>(false);

  // Semanas expandidas na visualização em tabela (todas expandidas por padrão)
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  // Modal para detalhar motivo de atipicidade/feriado
  const [atypicalModalOpen, setAtypicalModalOpen] = useState<boolean>(false);
  const [selectedDayForAtypical, setSelectedDayForAtypical] = useState<DayProjectionItem | null>(
    null,
  );
  const [atypicalReasonInput, setAtypicalReasonInput] = useState<string>("");

  // Firestore hooks
  const { data: atypicalDays = {} } = useAtypicalDays();
  const toggleAtypicalMutation = useToggleAtypicalDay();

  // Cálculo da Projeção e Análise Semanal com base nas vendas reais e nos dias atípicos
  const projection: MonthSalesProjectionMetrics = useMemo(() => {
    return computeWeeklySalesProjection(salesRecords, atypicalDays, monthKey, todayStr);
  }, [salesRecords, atypicalDays, monthKey, todayStr]);

  // Alterna expansão de uma semana
  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNum]: !prev[weekNum],
    }));
  };

  // Alterna flag de feriado/atipicidade diretamente
  const handleQuickToggleAtypical = async (day: DayProjectionItem) => {
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar exceções de vendas.");
      return;
    }

    const nextState = !day.isAtypical;
    try {
      await toggleAtypicalMutation.mutateAsync({
        date: day.date,
        isAtypical: nextState,
        reason: nextState ? "Feriado / Atípico" : null,
      });

      toast.success(
        nextState
          ? `Dia ${day.formattedDate} marcado como Feriado/Atípico (desconsiderado da média de ${day.dayOfWeekShort}).`
          : `Dia ${day.formattedDate} voltou a ser considerado dia normal na média.`,
      );
    } catch {
      toast.error("Erro ao atualizar status de feriado.");
    }
  };

  // Abre modal para personalizar motivo do feriado
  const openAtypicalCustomModal = (day: DayProjectionItem) => {
    if (!canWrite) return;
    setSelectedDayForAtypical(day);
    setAtypicalReasonInput(day.atypicalReason || "Feriado / Dia Atípico");
    setAtypicalModalOpen(true);
  };

  const handleSaveCustomAtypical = async () => {
    if (!selectedDayForAtypical) return;
    try {
      await toggleAtypicalMutation.mutateAsync({
        date: selectedDayForAtypical.date,
        isAtypical: true,
        reason: atypicalReasonInput.trim() || "Feriado / Dia Atípico",
      });
      toast.success(
        `Feriado/Atipicidade salvo para o dia ${selectedDayForAtypical.formattedDate}!`,
      );
      setAtypicalModalOpen(false);
      setSelectedDayForAtypical(null);
    } catch {
      toast.error("Erro ao salvar motivo.");
    }
  };

  // Percentual realizado da projeção
  const percentCompleted =
    projection.totalPrevistoMes > 0
      ? Math.min(100, Math.round((projection.totalRealizado / projection.totalPrevistoMes) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* BANNER INFORMATIVO EXPLICATIVO */}
      <Card className="border-primary/25 bg-primary/5 dark:bg-primary/10 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground">
                    Projeção Inteligente por Peso Médio do Dia da Semana
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-background border-primary/30 text-primary"
                  >
                    Tempo Real · Canal de Vendas
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cada dia possui sua <strong>Projeção</strong> calculada por histórico diário
                  (média de todas as segundas, terças, etc.). Dias já faturados exibem a{" "}
                  <strong>diferença exata</strong> em relação à projeção (verde se superou, vermelho
                  se ficou abaixo). Feriados e dias atípicos podem ser marcados com a flag{" "}
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    &ldquo;Feriado/Atípico&rdquo;
                  </span>{" "}
                  para serem desconsiderados do divisor da média.
                </p>
              </div>
            </div>

            {/* Alternador de visualização */}
            <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-lg border border-border shrink-0 self-end sm:self-center">
              <Button
                variant={viewMode === "tabela" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setViewMode("tabela")}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Tabela</span>
              </Button>
              <Button
                variant={viewMode === "calendario" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setViewMode("calendario")}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span>Calendário</span>
              </Button>
              <Button
                variant={viewMode === "dpi" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setViewMode("dpi")}
              >
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>DPI / Diagnóstico Diário</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QUADRANTES EXECUTIVOS COM DIAGNÓSTICO INTEGRADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Realizado */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">
                Faturamento Realizado
              </CardDescription>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(projection.totalRealizado)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {projection.daysPassedCount}{" "}
              {projection.daysPassedCount === 1 ? "dia lançado" : "dias lançados"}
            </span>
            <span className="font-semibold text-foreground">
              Média: {formatCurrency(projection.avgDiariaRealizada)}/dia
            </span>
          </CardContent>
        </Card>

        {/* Card 2: Projeção dos Dias Restantes */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">
                Projeção dos Dias Restantes
              </CardDescription>
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">
              {formatCurrency(projection.totalProjetado)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {projection.daysRemainingCount}{" "}
              {projection.daysRemainingCount === 1 ? "dia a vencer" : "dias a vencer"}
            </span>
            <span className="font-semibold text-foreground">
              Média: {formatCurrency(projection.avgDiariaProjetada)}/dia
            </span>
          </CardContent>
        </Card>

        {/* Card 3: Faturamento Total Previsto do Mês */}
        <Card className="border-primary/40 bg-card shadow-xs ring-1 ring-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold text-primary">
                Faturamento Total Previsto
              </CardDescription>
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <CircleDollarSign className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-foreground">
              {formatCurrency(projection.totalPrevistoMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>Realizado + Projeção</span>
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-bold">
              {percentCompleted}% atingido
            </Badge>
          </CardContent>
        </Card>

        {/* Card 4: Feriados & Exceções */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">
                Feriados / Atipicidades
              </CardDescription>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <PartyPopper className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-400">
              {projection.atypicalDaysCount}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {projection.atypicalDaysCount === 1 ? "dia isolado" : "dias isolados"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {projection.atypicalDaysCount > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Excluídos do divisor das médias
              </span>
            ) : (
              <span>Nenhum feriado no mês</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PAINEL DE DIAGNÓSTICO RÁPIDO DO MÊS (RECORDES & ALERTAS DIÁRIOS) */}
      <Card className="border-border/80 bg-muted/20 shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Recorde do Mês */}
            <div className="flex items-center gap-3 pr-2">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Melhor Dia do Mês (Recorde)
                </span>
                {projection.bestDay ? (
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-extrabold text-foreground text-sm">
                      {formatCurrency(projection.bestDay.actualAmount)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ({projection.bestDay.dayOfWeekShort} {projection.bestDay.formattedDate})
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Aguardando lançamentos</span>
                )}
              </div>
            </div>

            {/* Menor Faturamento */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-3">
              <div className="h-9 w-9 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Menor Dia de Vendas (Piso)
                </span>
                {projection.worstDay ? (
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-extrabold text-foreground text-sm">
                      {formatCurrency(projection.worstDay.actualAmount)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      ({projection.worstDay.dayOfWeekShort} {projection.worstDay.formattedDate})
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Aguardando lançamentos</span>
                )}
              </div>
            </div>

            {/* Alertas de Dias Críticos */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:pl-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Dias Abaixo da Média (&lt; -15%)
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-extrabold text-foreground text-sm">
                    {projection.underperformingDays.length}{" "}
                    {projection.underperformingDays.length === 1
                      ? "dia em alerta"
                      : "dias em alerta"}
                  </span>
                  {projection.underperformingDays.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      Atenção
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PESOS POR DIA DA SEMANA (RESUMO COMPACTO) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <span>Pesos das Médias Diárias ({projection.monthLabel})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Média calculada apenas sobre dias normais (feriados e atípicos não entram no
                divisor).
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary"
              onClick={() => setViewMode("dpi")}
            >
              Ver Diagnóstico Detalhado &rarr;
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {projection.weekdayWeights.map((w) => {
              const isTodayWeekday = new Date().getDay() === w.dayOfWeekIndex;
              return (
                <div
                  key={w.dayOfWeekIndex}
                  className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                    isTodayWeekday
                      ? "border-primary/50 bg-primary/5 shadow-2xs"
                      : "border-border/70 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground">{w.dayOfWeekShort}</span>
                      {isTodayWeekday && (
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-1 rounded">
                          Hoje
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm sm:text-base font-extrabold text-foreground">
                      {formatCurrency(w.avgAmount)}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border/60 text-[10px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>Base:</span>
                      <span className="font-semibold text-foreground">
                        {w.normalDaysCount} de {w.totalOccurrencesInMonth}d
                      </span>
                    </div>
                    {w.atypicalDaysCount > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                        <span>Feriados:</span>
                        <span>-{w.atypicalDaysCount}d</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
                      <span>Restam:</span>
                      <span>
                        {w.remainingDaysCount}d ({formatCurrency(w.projectedSubtotal)})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* VISUALIZAÇÃO 1: TABELA POR SEMANAS COM HISTÓRICO DE PROJEÇÃO E OBSERVAÇÃO DE DIFERENÇA */}
      {viewMode === "tabela" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>Detalhamento Semanal & Projeção Diária</span>
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyAtypical}
                  onChange={(e) => setFilterOnlyAtypical(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Apenas dias atípicos / feriados</span>
              </label>
            </div>
          </div>

          {projection.weeks.map((week) => {
            const isExpanded = expandedWeeks[week.weekNumber] ?? true;
            const weekDays = filterOnlyAtypical ? week.days.filter((d) => d.isAtypical) : week.days;

            if (filterOnlyAtypical && weekDays.length === 0) return null;

            return (
              <Card
                key={week.weekNumber}
                className={`border-border/80 shadow-xs transition-colors ${
                  week.isCurrentWeek ? "ring-1 ring-primary/40 bg-card" : ""
                }`}
              >
                {/* Cabeçalho da Semana / Quadrante */}
                <div
                  className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                  onClick={() => toggleWeek(week.weekNumber)}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0 mt-0.5 sm:mt-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{week.label}</span>
                        {week.isCurrentWeek && (
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-bold">
                            Semana Atual
                          </Badge>
                        )}
                        {week.isCompleted && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                            100% Realizada
                          </Badge>
                        )}
                        {/* Peso % no mês */}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold bg-background"
                        >
                          {week.weightPercentOfMonth}% do mês
                        </Badge>
                        {/* Badge de Saúde da Semana */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            week.healthStatus === "saudavel"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : week.healthStatus === "alerta"
                                ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                                : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                          }`}
                        >
                          {week.healthLabel}
                        </Badge>
                      </div>

                      {/* Comparativos com Semanas Anteriores */}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span>
                          {week.daysWithSalesCount} dias realizados · {week.daysProjectedCount} dias
                          projetados
                        </span>
                        {week.comparisons.map((c) => (
                          <span
                            key={c.targetWeekNumber}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                              c.diffPercent >= 0
                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30"
                            }`}
                          >
                            vs Sem. {c.targetWeekNumber}: {c.diffPercent >= 0 ? "+" : ""}
                            {c.diffPercent.toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Totais do Quadrante Semanal */}
                  <div className="flex items-center gap-3 sm:gap-6 text-xs pl-10 md:pl-0">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Realizado</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(week.totalRealizado)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Projetado</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(week.totalProjetado)}
                      </span>
                    </div>
                    <div className="border-l border-border/80 pl-3 sm:pl-6">
                      <span className="text-muted-foreground block text-[10px] font-semibold text-primary">
                        Soma da Semana
                      </span>
                      <span className="font-extrabold text-sm text-foreground">
                        {formatCurrency(week.totalPrevisto)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conteúdo da Semana (Tabela) */}
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10 text-xs">
                        <TableRow>
                          <TableHead className="w-24">Data</TableHead>
                          <TableHead className="w-28">Dia da Semana</TableHead>
                          <TableHead className="w-28">Status</TableHead>
                          <TableHead className="text-right w-36">Venda Realizada</TableHead>
                          <TableHead className="text-right w-44">Projeção</TableHead>
                          <TableHead className="text-right w-32">Acumulado</TableHead>
                          <TableHead className="w-48 text-center">Feriado / Atípico</TableHead>
                          <TableHead className="text-right w-20">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {weekDays.map((day) => {
                          const isRealized =
                            day.status === "realizado" || day.status === "hoje_realizado";
                          return (
                            <TableRow
                              key={day.date}
                              className={`hover:bg-muted/30 transition-colors ${
                                day.isToday
                                  ? "bg-primary/5 font-medium"
                                  : day.isAtypical
                                    ? "bg-amber-500/5"
                                    : ""
                              }`}
                            >
                              {/* Data */}
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span>{day.formattedDate}</span>
                                  {day.isToday && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                  )}
                                </div>
                              </TableCell>

                              {/* Dia da semana */}
                              <TableCell className="font-semibold text-foreground">
                                {day.dayOfWeekName}
                              </TableCell>

                              {/* Status */}
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold ${day.statusColorClass}`}
                                >
                                  {day.statusLabel}
                                </Badge>
                              </TableCell>

                              {/* Venda Realizada */}
                              <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                                {isRealized ? formatCurrency(day.actualAmount) : "—"}
                              </TableCell>

                              {/* Projeção (Com Histórico Calculado e Observação de Diferença) */}
                              <TableCell className="text-right">
                                {isRealized ? (
                                  <div>
                                    {/* Valor calculado de projeção em azul */}
                                    <span className="font-bold text-blue-700 dark:text-blue-400">
                                      {formatCurrency(day.projectionBenchmark)}
                                    </span>
                                    {/* Observação de Diferença abaixo em tamanho pequeno */}
                                    {day.diffAmount !== null && (
                                      <div
                                        className={`text-[10px] font-semibold tracking-tight mt-0.5 flex items-center justify-end gap-0.5 ${
                                          day.diffAmount > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : day.diffAmount < 0
                                              ? "text-rose-600 dark:text-rose-400"
                                              : "text-muted-foreground"
                                        }`}
                                      >
                                        <span>
                                          Diferença: {day.diffAmount > 0 ? "+" : ""}
                                          {formatCurrency(day.diffAmount)} (
                                          {day.diffPercent !== null && day.diffPercent > 0
                                            ? "+"
                                            : ""}
                                          {day.diffPercent?.toFixed(1)}%)
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-bold text-blue-700 dark:text-blue-400">
                                      {formatCurrency(day.projectedAmount)}
                                    </span>
                                    <span className="block text-[9px] text-muted-foreground">
                                      Previsto (peso de {day.dayOfWeekShort})
                                    </span>
                                  </div>
                                )}
                              </TableCell>

                              {/* Acumulado */}
                              <TableCell className="text-right font-mono font-medium text-muted-foreground">
                                {formatCurrency(day.cumulativeTotal)}
                              </TableCell>

                              {/* Toggle de Feriado / Atipicidade */}
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleAtypical(day)}
                                    disabled={!canWrite}
                                    title={
                                      day.isAtypical
                                        ? "Clique para remover status de Feriado/Atípico (voltará a ser usado no cálculo da média)"
                                        : "Clique para marcar como Feriado/Atípico (será EXCLUÍDO da base de cálculo da média)"
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                      day.isAtypical
                                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50 shadow-2xs"
                                        : "bg-background text-muted-foreground border-border/80 hover:text-foreground hover:bg-muted/40"
                                    }`}
                                  >
                                    <PartyPopper
                                      className={`h-3 w-3 ${
                                        day.isAtypical ? "text-amber-600" : "opacity-40"
                                      }`}
                                    />
                                    <span>
                                      {day.isAtypical ? "Feriado / Atípico" : "Dia Normal"}
                                    </span>
                                  </button>

                                  {day.isAtypical && (
                                    <button
                                      type="button"
                                      onClick={() => openAtypicalCustomModal(day)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                                      title="Editar motivo da atipicidade"
                                    >
                                      {day.atypicalReason ? `(${day.atypicalReason})` : "Editar"}
                                    </button>
                                  )}
                                </div>
                              </TableCell>

                              {/* Ação */}
                              <TableCell className="text-right">
                                {canWrite && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => onOpenSaleEntry(day.date)}
                                  >
                                    {isRealized ? "Editar" : "Lançar"}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* VISUALIZAÇÃO 2: CALENDÁRIO VISUAL COM HISTÓRICO DE PROJEÇÃO */}
      {viewMode === "calendario" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Calendário Mensal de Vendas & Projeções ({projection.monthLabel})
                </CardTitle>
                <CardDescription className="text-xs">
                  Visão em grade mensal mostrando o faturamento realizado, a projeção calculada e a
                  diferença.
                </CardDescription>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Realizado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Projetado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Feriado / Atípico
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Grade do Calendário: 7 colunas (Dom a Sáb) */}
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-bold py-2 text-muted-foreground">
                <span>Domingo</span>
                <span>Segunda</span>
                <span>Terça</span>
                <span>Quarta</span>
                <span>Quinta</span>
                <span>Sexta</span>
                <span>Sábado</span>
              </div>

              {/* Células do mês */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border">
                {/* Espaços em branco antes do dia 1 */}
                {Array.from({
                  length: projection.days[0]?.dayOfWeekIndex ?? 0,
                }).map((_, idx) => (
                  <div key={`blank-${idx}`} className="bg-muted/10 min-h-[90px] p-2" />
                ))}

                {/* Dias do mês */}
                {projection.days.map((day) => {
                  const isRealized = day.status === "realizado" || day.status === "hoje_realizado";

                  return (
                    <div
                      key={day.date}
                      className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors relative group ${
                        day.isToday
                          ? "bg-primary/5 ring-2 ring-primary/40"
                          : day.isAtypical
                            ? "bg-amber-500/5"
                            : "bg-card hover:bg-muted/20"
                      }`}
                    >
                      {/* Topo do dia */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${
                            day.isToday
                              ? "text-primary px-1.5 py-0.5 rounded-full bg-primary/10"
                              : "text-foreground"
                          }`}
                        >
                          {day.dayOfMonth}
                        </span>

                        {day.isToday && (
                          <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground font-semibold">
                            Hoje
                          </Badge>
                        )}
                      </div>

                      {/* Conteúdo de valores do dia */}
                      <div className="my-1 text-center space-y-1">
                        {isRealized ? (
                          <div className="rounded bg-emerald-500/10 px-1.5 py-1 border border-emerald-500/20">
                            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 block uppercase">
                              Realizado
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                              {formatCurrency(day.actualAmount)}
                            </span>
                            {/* Projeção e Diferença */}
                            <div className="pt-0.5 border-t border-emerald-500/20 mt-0.5 text-[9px]">
                              <span className="text-blue-700 dark:text-blue-400 font-medium">
                                Proj: {formatCurrency(day.projectionBenchmark)}
                              </span>
                              {day.diffAmount !== null && (
                                <span
                                  className={`block font-bold ${
                                    day.diffAmount >= 0
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {day.diffAmount >= 0 ? "+" : ""}
                                  {day.diffPercent?.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded bg-blue-500/10 px-1.5 py-1 border border-blue-500/20 border-dashed">
                            <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-300 block uppercase">
                              Projetado
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-blue-800 dark:text-blue-300">
                              {formatCurrency(day.projectedAmount)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Rodapé do dia */}
                      <div className="flex items-center justify-between text-[10px]">
                        {day.isAtypical ? (
                          <Badge
                            className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/40 text-[9px] px-1 py-0 cursor-pointer"
                            onClick={() => handleQuickToggleAtypical(day)}
                            title="Dia atípico (excluído da média). Clique para reverter."
                          >
                            <PartyPopper className="h-2.5 w-2.5 mr-0.5" />
                            Feriado
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickToggleAtypical(day)}
                            className="text-[9px] text-muted-foreground hover:text-amber-600 opacity-60 hover:opacity-100 transition-opacity"
                            title="Marcar como feriado/atípico para desconsiderar da média"
                          >
                            + Feriado
                          </button>
                        )}

                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => onOpenSaleEntry(day.date)}
                            className="text-[9px] text-primary font-medium hover:underline ml-auto"
                          >
                            {isRealized ? "Editar" : "Lançar"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VISUALIZAÇÃO 3: DPI & DIAGNÓSTICO DETALHADO POR DIA DA SEMANA (SEGUNDAS, TERÇAS...) */}
      {viewMode === "dpi" && (
        <div className="space-y-6">
          <Card className="border-border/80 shadow-xs">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span>DPI: Diagnóstico de Desempenho Diário por Dia da Semana</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Analise todas as Segundas-feiras, Terças-feiras, etc., para descobrir
                    consistência de faturamento, variações atípicas e gargalos em dias específicos.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-semibold bg-muted/40">
                  Análise Comparativa Diária
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grade de Análise Individual por Dia da Semana (Segunda a Domingo) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projection.weekdayWeights.map((w) => {
                  return (
                    <Card key={w.dayOfWeekIndex} className="border-border/80 bg-card shadow-2xs">
                      <CardHeader className="pb-2.5 pt-3.5 px-4 bg-muted/20 border-b border-border/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-foreground">
                              {w.dayOfWeekName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                w.healthStatus === "saudavel"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : w.healthStatus === "alerta"
                                    ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                              }`}
                            >
                              {w.healthStatus === "saudavel"
                                ? "Desempenho Saudável"
                                : w.healthStatus === "alerta"
                                  ? "Atenção: Quedas Frequentes"
                                  : "Estável / Na Média"}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">
                              Média do Dia
                            </span>
                            <span className="font-extrabold text-sm text-foreground">
                              {formatCurrency(w.avgAmount)}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3.5 space-y-2 text-xs">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="text-[11px] bg-muted/10">
                              <TableRow>
                                <TableHead className="w-20">Data</TableHead>
                                <TableHead className="text-right">Realizado</TableHead>
                                <TableHead className="text-right">Projeção</TableHead>
                                <TableHead className="text-right">Diferença</TableHead>
                                <TableHead className="text-center w-28">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-[11px]">
                              {w.occurrences.map((occ) => (
                                <TableRow key={occ.date} className="hover:bg-muted/30">
                                  <TableCell className="font-mono font-semibold">
                                    {occ.formattedDate}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                                    {occ.isRealized ? formatCurrency(occ.actualAmount) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-blue-700 dark:text-blue-400 font-medium">
                                    {formatCurrency(occ.projectionAmount)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-bold ${
                                      occ.diffAmount !== null && occ.diffAmount > 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : occ.diffAmount !== null && occ.diffAmount < 0
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {occ.diffAmount !== null
                                      ? `${occ.diffAmount > 0 ? "+" : ""}${formatCurrency(
                                          occ.diffAmount,
                                        )} (${occ.diffPercent !== null && occ.diffPercent > 0 ? "+" : ""}${occ.diffPercent?.toFixed(0)}%)`
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {occ.isAtypical ? (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 text-[9px]">
                                        Feriado
                                      </Badge>
                                    ) : !occ.isRealized ? (
                                      <Badge
                                        variant="outline"
                                        className="text-blue-600 border-blue-200 text-[9px]"
                                      >
                                        Projetado
                                      </Badge>
                                    ) : (occ.diffPercent ?? 0) >= 3 ? (
                                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[9px]">
                                        Acima
                                      </Badge>
                                    ) : (occ.diffPercent ?? 0) <= -8 ? (
                                      <Badge className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 text-[9px]">
                                        Abaixo
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-muted-foreground text-[9px]"
                                      >
                                        Na Média
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL PARA EDITAR MOTIVO DA ATIPICIDADE/FERIADO */}
      <Dialog open={atypicalModalOpen} onOpenChange={setAtypicalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-amber-600" />
              <span>Feriado / Dia Atípico ({selectedDayForAtypical?.formattedDate})</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Quando marcado, o faturamento deste dia é preservado no total do mês, mas é{" "}
              <strong>excluído do cálculo da média</strong> de{" "}
              {selectedDayForAtypical?.dayOfWeekName} para não distorcer as projeções futuras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Motivo da Exceção / Feriado:</Label>
              <Input
                value={atypicalReasonInput}
                onChange={(e) => setAtypicalReasonInput(e.target.value)}
                placeholder="Ex: Feriado Nacional, Dia dos Pais, Chuva Torrencial, etc."
                className="mt-1 text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Exemplo: Se a média de uma segunda é R$ 5.000, mas em feriado vendeu R$ 8.000, marcar
              este dia garante que as próximas segundas não fiquem superestimadas.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedDayForAtypical) {
                  handleQuickToggleAtypical(selectedDayForAtypical);
                }
                setAtypicalModalOpen(false);
              }}
              className="text-xs"
            >
              Remover Atipicidade
            </Button>
            <Button size="sm" onClick={handleSaveCustomAtypical} className="text-xs">
              Salvar Motivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
