import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Plus,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DayPresenceDialog } from "@/components/presence/DayPresenceDialog";
import {
  calculateMonthPresenceStats,
  PRESENCE_STATUSES,
  type PresenceLog,
  type PresenceStatus,
  usePresenceLogs,
} from "@/lib/presence";
import { useDailySales, formatCurrency } from "@/lib/vendas";

export const Route = createFileRoute("/_authenticated/presenca")({
  component: PresencaPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function PresencaPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchNotes, setSearchNotes] = useState("");

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const yearMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  // Busca registros de presença do Firestore
  const { data: presenceLogs = [], isLoading } = usePresenceLogs();

  // Busca dados de vendas do mês para exibir faturamento correlacionado
  const { data: salesList = [] } = useDailySales(yearMonthKey);

  // Mapa de vendas por data YYYY-MM-DD
  const salesByDate = useMemo(() => {
    const map = new Map<string, number>();
    salesList.forEach((s) => {
      const current = map.get(s.date) || 0;
      map.set(s.date, current + (s.amount || 0));
    });
    return map;
  }, [salesList]);

  // Mapa de presenças por data YYYY-MM-DD
  const logsByDate = useMemo(() => {
    const map = new Map<string, PresenceLog>();
    presenceLogs.forEach((l) => {
      map.set(l.date, l);
    });
    return map;
  }, [presenceLogs]);

  // Estatísticas do mês
  const stats = useMemo(() => {
    return calculateMonthPresenceStats(presenceLogs, currentYear, currentMonth);
  }, [presenceLogs, currentYear, currentMonth]);

  // Dias do mês atual para a grade
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Espaços em branco no início do mês para alinhar com o dia da semana
  const leadingBlanks = useMemo(() => {
    const firstDayOfWeek = getDay(startOfMonth(currentDate));
    return Array.from({ length: firstDayOfWeek });
  }, [currentDate]);

  // Anotações filtradas do mês para o Diário da Operação
  const monthNotesLogs = useMemo(() => {
    return presenceLogs
      .filter((l) => {
        if (!l.date.startsWith(yearMonthKey)) return false;
        if (statusFilter !== "all" && l.status !== statusFilter) return false;
        if (searchNotes.trim()) {
          const q = searchNotes.toLowerCase();
          const matchNotes = l.notes?.toLowerCase().includes(q);
          const matchTags = l.tags?.some((t) => t.toLowerCase().includes(q));
          return matchNotes || matchTags;
        }
        return Boolean(l.notes && l.notes.trim().length > 0);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [presenceLogs, yearMonthKey, statusFilter, searchNotes]);

  const handleOpenDay = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setDialogOpen(true);
  };

  const handleOpenToday = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    handleOpenDay(todayStr);
  };

  const handlePrevMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const activeLogForDialog = selectedDateStr ? logsByDate.get(selectedDateStr) : undefined;

  return (
    <div className="space-y-6 pb-12">
      {/* Header da Página */}
      <PageHeader
        title="Controle de Presença & Operação"
        description="Acompanhe os dias de presença na Galeteria Brasão, registre resumos da operação diária e tenha o histórico completo sob controle."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCurrentMonth}
            className="text-xs"
          >
            Mês Atual
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleOpenToday}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Marcar Hoje ({format(new Date(), "dd/MM")})
          </Button>
        </div>
      </PageHeader>

      {/* Navegação do Mês & Estatísticas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            className="h-9 w-9 touch-manipulation"
            title="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-[200px] text-center sm:text-left">
            <h2 className="text-xl font-bold capitalize tracking-tight text-foreground">
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {stats.recordedDaysCount} de {stats.totalDaysInMonth} dias registrados neste mês
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            className="h-9 w-9 touch-manipulation"
            title="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legenda Resumida */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {(Object.keys(PRESENCE_STATUSES) as PresenceStatus[]).map((key) => {
            const cfg = PRESENCE_STATUSES[key];
            const isFilterActive = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(isFilterActive ? "all" : key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-all ${
                  isFilterActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                    : "border-border/60 bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.hex }}
                />
                <span>{cfg.shortLabel}</span>
              </button>
            );
          })}
          {statusFilter !== "all" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Limpar filtro
            </Button>
          )}
        </div>
      </div>

      {/* Métricas do Mês */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Presente */}
        <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/15">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Fui (Presente)
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                {stats.presentCount}
              </span>
              <span className="text-xs text-emerald-700/80 dark:text-emerald-400">
                dias ({stats.presenceRate}% freq.)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Ausente */}
        <Card className="border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/15">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                Ausências
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-900 dark:text-rose-100">
                {stats.absentCount}
              </span>
              <span className="text-xs text-rose-700/80 dark:text-rose-400">dias não fui</span>
            </div>
          </CardContent>
        </Card>

        {/* Meio Período */}
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/15">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Meio Período
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-900 dark:text-amber-100">
                {stats.halfDayCount}
              </span>
              <span className="text-xs text-amber-700/80 dark:text-amber-400">visitas rápidas</span>
            </div>
          </CardContent>
        </Card>

        {/* Folga / Fechado */}
        <Card className="border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/15">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                Folga / Fechado
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-sky-900 dark:text-sky-100">
                {stats.offCount}
              </span>
              <span className="text-xs text-sky-700/80 dark:text-sky-400">dias folga</span>
            </div>
          </CardContent>
        </Card>

        {/* Notas / Resumos de Operação */}
        <Card className="border-border bg-card col-span-2 sm:col-span-1">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Anotações</span>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{stats.notesCount}</span>
              <span className="text-xs text-muted-foreground">resumos salvos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendário Grande Visual */}
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Calendário Mensal da Operação</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique em qualquer dia para marcar presença ou registrar o resumo da operação
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-2 sm:p-4">
          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {WEEKDAYS.map((day, idx) => (
              <div
                key={day}
                className={`py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${
                  idx === 0 || idx === 6
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Espaços em branco antes do dia 1 */}
            {leadingBlanks.map((_, i) => (
              <div
                key={`blank-${i}`}
                className="min-h-[85px] sm:min-h-[115px] rounded-lg border border-dashed border-border/40 bg-muted/5 opacity-40"
              />
            ))}

            {/* Dias do mês */}
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const log = logsByDate.get(dateStr);
              const dayIsToday = isToday(day);
              const statusCfg = log ? PRESENCE_STATUSES[log.status] : null;
              const daySalesAmount = salesByDate.get(dateStr) || 0;

              // Estilização do card do dia
              let cellClass =
                "relative flex min-h-[90px] sm:min-h-[120px] flex-col justify-between rounded-xl border p-2 sm:p-2.5 text-left transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.01] ";

              if (log && statusCfg) {
                cellClass += `${statusCfg.calendarBgClass} ${statusCfg.calendarBorderClass} `;
              } else {
                cellClass += "border-border/70 bg-card hover:bg-muted/30 ";
              }

              if (dayIsToday) {
                cellClass += "ring-2 ring-primary ring-offset-2 ring-offset-background ";
              }

              return (
                <div
                  key={dateStr}
                  onClick={() => handleOpenDay(dateStr)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleOpenDay(dateStr);
                    }
                  }}
                  className={cellClass}
                >
                  {/* Topo do dia: Número e Status / Hoje */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          dayIsToday
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {dayIsToday && (
                        <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider text-primary">
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* Badge ou Indicador de Cor */}
                    {statusCfg ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold border ${statusCfg.badgeClass}`}
                        title={statusCfg.label}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: statusCfg.hex }}
                        />
                        <span className="hidden sm:inline truncate max-w-[70px]">
                          {statusCfg.shortLabel}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100">
                        +
                      </span>
                    )}
                  </div>

                  {/* Corpo do dia: Horário e Resumo da Operação */}
                  <div className="my-1 flex-1 space-y-1 overflow-hidden">
                    {/* Horário (se houver) */}
                    {(log?.check_in || log?.check_out) && (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          {log.check_in || "--"} {log.check_out ? `- ${log.check_out}` : ""}
                        </span>
                      </div>
                    )}

                    {/* Observação / Resumo da Operação */}
                    {log?.notes && log.notes.trim().length > 0 ? (
                      <div className="rounded bg-background/80 p-1 text-[10px] leading-tight text-foreground shadow-2xs backdrop-blur-xs">
                        <p className="line-clamp-2 italic text-muted-foreground/90">
                          &ldquo;{log.notes}&rdquo;
                        </p>
                      </div>
                    ) : null}

                    {/* Tags da Operação */}
                    {log?.tags && log.tags.length > 0 && (
                      <div className="hidden sm:flex flex-wrap gap-0.5">
                        {log.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="rounded bg-foreground/5 px-1 text-[8px] font-medium text-foreground/80 truncate max-w-[80px]"
                          >
                            {t}
                          </span>
                        ))}
                        {log.tags.length > 2 && (
                          <span className="text-[8px] text-muted-foreground">
                            +{log.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rodapé do dia: Vendas registradas (se houver) */}
                  {daySalesAmount > 0 && (
                    <div className="mt-auto border-t border-border/40 pt-1 text-[9px] font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      <span className="font-bold">{formatCurrency(daySalesAmount)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diário de Operações & Histórico de Anotações do Mês */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Diário da Operação · {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Histórico cronológico com todos os resumos, ocorrências e notas registradas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar nas anotações..."
                  value={searchNotes}
                  onChange={(e) => setSearchNotes(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {monthNotesLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Nenhuma anotação encontrada neste mês
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Clique nos dias do calendário acima para registrar a sua presença e descrever os
                acontecimentos e o resumo da operação da galeteria.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenToday}
                className="mt-4 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Registrar no dia de Hoje
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monthNotesLogs.map((log) => {
                const statusCfg = PRESENCE_STATUSES[log.status];
                const d = parseISO(log.date);
                const salesVal = salesByDate.get(log.date);

                return (
                  <div
                    key={log.date}
                    onClick={() => handleOpenDay(log.date)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleOpenDay(log.date);
                    }}
                    className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer"
                  >
                    <div>
                      {/* Topo do Card de Anotação */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground capitalize">
                            {format(d, "EEEE, dd/MM", { locale: ptBR })}
                          </p>
                          {(log.check_in || log.check_out) && (
                            <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {log.check_in || "--"} {log.check_out ? `às ${log.check_out}` : ""}
                            </p>
                          )}
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${statusCfg.badgeClass}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: statusCfg.hex }}
                          />
                          {statusCfg.shortLabel}
                        </span>
                      </div>

                      {/* Texto da Observação */}
                      <div className="mt-2.5 text-xs leading-relaxed text-foreground bg-muted/20 rounded-lg p-2.5 border border-border/40">
                        <p className="whitespace-pre-wrap">{log.notes}</p>
                      </div>

                      {/* Tags */}
                      {log.tags && log.tags.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {log.tags.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-[10px] font-normal px-2 py-0"
                            >
                              <Tag className="mr-1 h-2.5 w-2.5 opacity-60" />
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rodapé com Vendas e Operador */}
                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                      <span>{log.user_name || "Galeteria Brasão"}</span>
                      {Boolean(salesVal && salesVal > 0) && (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Vendas: {formatCurrency(salesVal)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição do Dia */}
      <DayPresenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dateStr={selectedDateStr}
        existingLog={activeLogForDialog}
      />
    </div>
  );
}
