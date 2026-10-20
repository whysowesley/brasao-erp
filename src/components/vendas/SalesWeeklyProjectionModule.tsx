import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  DollarSign,
  Download,
  Filter,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  Palmtree,
  PartyPopper,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  WeekProjectionGroup,
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

  // View state: 'tabela' | 'calendario' | 'pesos'
  const [viewMode, setViewMode] = useState<"tabela" | "calendario" | "pesos">("tabela");

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
  const { data: atypicalDays = {}, isLoading: loadingAtypical } = useAtypicalDays();
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

  // Dias restantes vs dias do mês
  const percentDaysPassed =
    projection.daysInMonth > 0
      ? Math.round((projection.daysPassedCount / projection.daysInMonth) * 100)
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
                  Os dias restantes do mês são projetados individualmente pelo peso real de cada dia
                  (ex: média de todas as segundas-feiras normais). Feriados e dias atípicos podem
                  ser marcados com a flag{" "}
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    &ldquo;Feriado/Atípico&rdquo;
                  </span>{" "}
                  para serem desconsiderados do cálculo das médias normais.
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
                variant={viewMode === "pesos" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setViewMode("pesos")}
              >
                <Percent className="h-3.5 w-3.5" />
                <span>Pesos Diários</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARDS DE RESUMO EXECUTIVO */}
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
              {percentCompleted}% do total
            </Badge>
          </CardContent>
        </Card>

        {/* Card 4: Dias Atípicos / Feriados */}
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
              <span>Nenhum feriado/atipicidade no mês</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PESOS POR DIA DA SEMANA (CHIPS / CARDS EXPANSÍVEIS) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <span>Pesos das Médias por Dia da Semana ({projection.monthLabel})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Média calculada apenas sobre dias normais (feriados e atípicos não entram no
                divisor).
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] bg-muted/40">
              Base do cálculo de projeção
            </Badge>
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
                      <span>Base de cálculo:</span>
                      <span className="font-semibold text-foreground">
                        {w.normalDaysCount} de {w.totalOccurrencesInMonth}d
                      </span>
                    </div>
                    {w.atypicalDaysCount > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                        <span>Feriados:</span>
                        <span>-{w.atypicalDaysCount} isolado(s)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
                      <span>Restantes:</span>
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

      {/* VISUALIZAÇÃO 1: TABELA POR SEMANAS */}
      {viewMode === "tabela" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
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
                  week.isCurrentWeek ? "ring-1 ring-primary/30" : ""
                }`}
              >
                {/* Cabeçalho da Semana */}
                <div
                  className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                  onClick={() => toggleWeek(week.weekNumber)}
                >
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
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
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {week.daysWithSalesCount} dias realizados · {week.daysProjectedCount} dias
                        projetados
                        {week.atypicalDaysCount > 0 && ` · ${week.atypicalDaysCount} feriado(s)`}
                      </p>
                    </div>
                  </div>

                  {/* Totais da Semana */}
                  <div className="flex items-center gap-3 sm:gap-6 text-xs">
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
                        Total Previsto
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
                          <TableHead className="w-28">Data</TableHead>
                          <TableHead className="w-32">Dia da Semana</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                          <TableHead className="text-right w-36">Venda Realizada</TableHead>
                          <TableHead className="text-right w-36">Projeção (Peso)</TableHead>
                          <TableHead className="text-right w-36">Efetivo Acumulado</TableHead>
                          <TableHead className="w-56 text-center">Feriado / Atípico</TableHead>
                          <TableHead className="text-right w-24">Ação</TableHead>
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

                              {/* Projeção */}
                              <TableCell className="text-right">
                                {!isRealized ? (
                                  <div className="font-bold text-blue-700 dark:text-blue-400">
                                    {formatCurrency(day.projectedAmount)}
                                    <span className="block text-[9px] font-normal text-muted-foreground">
                                      Peso: {formatCurrency(day.weekdayWeight)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>

                              {/* Acumulado */}
                              <TableCell className="text-right font-mono font-medium text-muted-foreground">
                                {formatCurrency(day.cumulativeTotal)}
                              </TableCell>

                              {/* Toggle de Feriado / Atipicidade */}
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleAtypical(day)}
                                    disabled={!canWrite}
                                    title={
                                      day.isAtypical
                                        ? "Clique para remover status de Feriado/Atípico (voltará a ser usado no cálculo da média)"
                                        : "Clique para marcar como Feriado/Atípico (será EXCLUÍDO da base de cálculo da média)"
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                                      day.isAtypical
                                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50 shadow-2xs"
                                        : "bg-background text-muted-foreground border-border/80 hover:text-foreground hover:bg-muted/40"
                                    }`}
                                  >
                                    <PartyPopper
                                      className={`h-3.5 w-3.5 ${
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

      {/* VISUALIZAÇÃO 2: CALENDÁRIO VISUAL */}
      {viewMode === "calendario" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Calendário Mensal de Vendas & Projeções ({projection.monthLabel})
                </CardTitle>
                <CardDescription className="text-xs">
                  Visão em grade com cada dia indicando faturamento real ou valor projetado.
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
                      className={`min-h-[100px] p-2 flex flex-col justify-between transition-colors relative group ${
                        day.isToday
                          ? "bg-primary/5 ring-2 ring-primary/40"
                          : day.isAtypical
                            ? "bg-amber-500/5"
                            : "bg-card hover:bg-muted/20"
                      }`}
                    >
                      {/* Topo do dia: número do dia + badge hoje */}
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

                      {/* Valor do dia */}
                      <div className="my-1.5 text-center">
                        {isRealized ? (
                          <div className="rounded bg-emerald-500/10 px-1.5 py-1 border border-emerald-500/20">
                            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 block uppercase">
                              Realizado
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                              {formatCurrency(day.actualAmount)}
                            </span>
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

                      {/* Rodapé do dia: Feriado / Atípico */}
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

      {/* VISUALIZAÇÃO 3: PESOS E COMPARAÇÃO DAS MÉDIAS */}
      {viewMode === "pesos" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">
              Análise Ponderada das Vendas por Dia da Semana
            </CardTitle>
            <CardDescription className="text-xs">
              Demonstrativo de como o racional de peso diário compõe o faturamento total projetado
              até o fechamento do mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="text-xs bg-muted/20">
                  <TableRow>
                    <TableHead>Dia da Semana</TableHead>
                    <TableHead className="text-center">Total no Mês</TableHead>
                    <TableHead className="text-center">Dias Realizados (Normais)</TableHead>
                    <TableHead className="text-center">Feriados / Atípicos</TableHead>
                    <TableHead className="text-right">Faturamento dos Dias Normais</TableHead>
                    <TableHead className="text-right">Média do Dia (Peso)</TableHead>
                    <TableHead className="text-center">Dias Restantes</TableHead>
                    <TableHead className="text-right">Subtotal Projetado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {projection.weekdayWeights.map((w) => (
                    <TableRow key={w.dayOfWeekIndex} className="hover:bg-muted/30">
                      <TableCell className="font-bold text-foreground">{w.dayOfWeekName}</TableCell>
                      <TableCell className="text-center">{w.totalOccurrencesInMonth}x</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {w.normalDaysCount}x
                      </TableCell>
                      <TableCell className="text-center">
                        {w.atypicalDaysCount > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 text-[10px]">
                            {w.atypicalDaysCount}x excluído(s)
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(w.normalDaysSum)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(w.avgAmount)}
                        {w.isFallback && (
                          <span className="block text-[9px] text-muted-foreground font-normal">
                            (Média Histórica)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-blue-600 dark:text-blue-400">
                        {w.remainingDaysCount}x
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-blue-700 dark:text-blue-300">
                        {formatCurrency(w.projectedSubtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="text-xs font-bold bg-muted/40">
                  <TableRow>
                    <TableCell colSpan={6} className="text-right">
                      Total Projetado para os Dias Restantes:
                    </TableCell>
                    <TableCell className="text-center">
                      {projection.daysRemainingCount} dias
                    </TableCell>
                    <TableCell className="text-right text-sm text-blue-700 dark:text-blue-300">
                      {formatCurrency(projection.totalProjetado)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
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
