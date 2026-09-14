import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Edit2,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getTodayDateString, useDay4WeeksAnalysis } from "@/lib/vendas";
import { SalesIncidentDialog } from "./SalesIncidentDialog";

interface Sales4WeeksAnalysisCardProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenSaleEntry: (date: string) => void;
}

export function Sales4WeeksAnalysisCard({
  selectedDate,
  onDateChange,
  onOpenSaleEntry,
}: Sales4WeeksAnalysisCardProps) {
  const [incidentDialogOpen, setIncidentDialogOpen] = useState<boolean>(false);

  const { data: analysis, isLoading, refetch } = useDay4WeeksAnalysis(selectedDate);

  // Quick jump helper
  function setQuickDate(daysOffset: number) {
    const today = new Date();
    today.setDate(today.getDate() - daysOffset);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    onDateChange(`${y}-${m}-${d}`);
  }

  // Prepara dados do gráfico comparando as 4 semanas + o dia atual
  const comparisonChartData = [
    ...analysis.historicalWeeks
      .slice()
      .reverse()
      .map((w) => ({
        name: `${w.dayOfWeek} ${w.formattedDate}`,
        amount: w.amount,
        type: "hist",
        label: `Semana -${w.weekNumber}`,
      })),
    {
      name: `Hoje (${analysis.formattedTargetDate.slice(0, 5)})`,
      amount: analysis.currentDayAmount,
      type: "current",
      label: "Dia Selecionado",
    },
  ];

  return (
    <div className="space-y-6">
      {/* SELETOR DE DATA & CABEÇALHO DE ANÁLISE */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs bg-primary/5 text-primary border-primary/20"
                >
                  Tomada de Decisão Diária
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Comparação com as últimas 4 semanas do mesmo dia
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
                Análise de Desempenho: {analysis.dayOfWeek}, {analysis.formattedTargetDate}
              </h2>
            </div>

            {/* Date Picker Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border">
                <Button
                  variant={selectedDate === getTodayDateString() ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setQuickDate(0)}
                  className="h-7 text-xs font-medium px-2.5"
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickDate(1)}
                  className="h-7 text-xs font-medium px-2.5"
                >
                  Ontem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickDate(7)}
                  className="h-7 text-xs font-medium px-2.5"
                  title="Mesmo dia na semana passada"
                >
                  -7 Dias
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && onDateChange(e.target.value)}
                  className="h-9 text-xs w-36 font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => refetch()}
                  title="Atualizar dados"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HERO CARD DE DECISÃO: STATUS VERDE / AMARELO / VERMELHO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD PRINCIPAL DO STATUS */}
        <Card
          className={`lg:col-span-2 border-2 shadow-xs transition-all ${analysis.statusCardClass}`}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Diagnóstico de Vendas
                </span>
                <Badge
                  className={`text-xs font-bold px-2.5 py-0.5 border ${analysis.statusBadgeClass}`}
                >
                  {analysis.status === "acima" && "🟢 "}
                  {analysis.status === "media" && "🟡 "}
                  {analysis.status === "abaixo" && "🔴 "}
                  {analysis.status === "sem_historico" && "⚪ "}
                  {analysis.statusLabel}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenSaleEntry(selectedDate)}
                  className="h-7 text-xs gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  {analysis.hasCurrentDaySales ? "Editar Vendas" : "Lançar Vendas"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncidentDialogOpen(true)}
                  className="h-7 text-xs gap-1 border-amber-300 bg-amber-50/50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-600" />+ Intercorrência
                </Button>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-baseline gap-4">
              <div>
                <span className="text-xs text-muted-foreground block">Venda Realizada no Dia:</span>
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-mono">
                  {formatCurrency(analysis.currentDayAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {analysis.weeksWithDataCount > 0 ? (
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-xs ${
                      analysis.variationPercent > 2
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : analysis.variationPercent < -2
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {analysis.variationPercent > 2 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : analysis.variationPercent < -2 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {analysis.variationPercent > 0 ? "+" : ""}
                      {analysis.variationPercent.toFixed(1)}% (
                      {analysis.variationAmount > 0 ? "+" : ""}
                      {formatCurrency(analysis.variationAmount)})
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis.weeksWithDataCount === 0 ? (
                "Ainda não constam vendas cadastradas nas últimas 4 semanas anteriores deste mesmo dia da semana para compor a média de comparação."
              ) : analysis.status === "acima" ? (
                <>
                  Excelente resultado! A venda de hoje está{" "}
                  <b className="text-emerald-600">+{analysis.variationPercent.toFixed(1)}% acima</b>{" "}
                  da média histórica das últimas 4 {analysis.dayOfWeek.toLowerCase()}s (R${" "}
                  {formatCurrency(analysis.avgHistoricalAmount)}).
                </>
              ) : analysis.status === "abaixo" ? (
                <>
                  Atenção operacional: a venda de hoje ficou{" "}
                  <b className="text-rose-600">{analysis.variationPercent.toFixed(1)}% abaixo</b> da
                  média esperada das últimas 4 {analysis.dayOfWeek.toLowerCase()}s (R${" "}
                  {formatCurrency(analysis.avgHistoricalAmount)}). Verifique se houve
                  intercorrências climáticas, queda de canais ou problemas na cozinha.
                </>
              ) : (
                <>
                  Desempenho estável! O faturamento está em linha com a média das últimas 4{" "}
                  {analysis.dayOfWeek.toLowerCase()}s (R${" "}
                  {formatCurrency(analysis.avgHistoricalAmount)}), dentro da margem de variação
                  esperada (+- 2%).
                </>
              )}
            </p>

            {/* GRÁFICO COMPARATIVO MINI BAR CHART */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                <span>Evolução: 4 Semanas Anteriores vs Hoje ({analysis.dayOfWeek})</span>
                <span className="font-mono text-foreground font-normal">
                  Média Histórica: <b>{formatCurrency(analysis.avgHistoricalAmount)}</b>
                </span>
              </div>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparisonChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), "Faturamento"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {comparisonChartData.map((entry, index) => {
                        const isCurrent = entry.type === "current";
                        let fill = "#64748b";
                        if (isCurrent) {
                          if (analysis.status === "acima") fill = "#10b981";
                          else if (analysis.status === "abaixo") fill = "#ef4444";
                          else fill = "#f59e0b";
                        }
                        return <Cell key={`bar-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DETALHAMENTO DAS 4 SEMANAS ANTERIORES */}
        <Card className="border-border/80 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-tight">
              Histórico das 4 Semanas Anteriores
            </CardTitle>
            <CardDescription className="text-xs">
              Valores registrados nas últimas 4 {analysis.dayOfWeek.toLowerCase()}s:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="space-y-2">
              {analysis.historicalWeeks.map((week) => {
                const isWinner =
                  week.amount > 0 &&
                  week.amount === Math.max(...analysis.historicalWeeks.map((w) => w.amount));

                return (
                  <div
                    key={week.weekNumber}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                      week.hasRecords
                        ? "bg-card border-border/70 hover:bg-muted/30"
                        : "bg-muted/30 border-dashed border-border/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                        -{week.weekNumber}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{week.formattedDate}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">
                            ({week.dayOfWeek})
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {week.weekNumber === 1
                            ? "Semana passada"
                            : `${week.weekNumber} semanas atrás`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-bold text-foreground">
                        {week.hasRecords ? formatCurrency(week.amount) : "Sem dados"}
                      </div>
                      {isWinner && (
                        <span className="text-[9px] text-emerald-600 font-semibold block">
                          Melhor semana
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Média das 4 Semanas */}
            <div className="p-3 rounded-lg bg-muted/60 border border-border/80 text-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Semanas computadas:</span>
                <span className="font-semibold text-foreground">
                  {analysis.weeksWithDataCount} de 4 semanas
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-sm pt-1 border-t border-border/40">
                <span className="text-foreground">Média das 4 Semanas:</span>
                <span className="font-mono text-primary">
                  {formatCurrency(analysis.avgHistoricalAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* COMPARAÇÃO DETALHADA POR CANAL DE VENDA */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Desempenho por Canal de Venda (Hoje vs Média 4 Semanas)
              </CardTitle>
              <CardDescription className="text-xs">
                Avalie qual canal puxou as vendas para cima ou para baixo nesta{" "}
                {analysis.dayOfWeek.toLowerCase()}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Canal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Venda Hoje</TableHead>
                  <TableHead className="text-right">Média 4 Semanas</TableHead>
                  <TableHead className="text-right">Variação (R$)</TableHead>
                  <TableHead className="text-right">Variação (%)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.channelComparisons.map((item) => {
                  const isAbove = item.status === "acima";
                  const isBelow = item.status === "abaixo";
                  const isAverage = item.status === "media";

                  return (
                    <TableRow key={item.channel}>
                      <TableCell className="font-semibold text-xs flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.label}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.categoryLabel}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        {formatCurrency(item.currentAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatCurrency(item.avgAmount)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs font-semibold ${
                          isAbove
                            ? "text-emerald-600"
                            : isBelow
                              ? "text-rose-600"
                              : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {item.variationAmount > 0 ? "+" : ""}
                        {formatCurrency(item.variationAmount)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs font-bold ${
                          isAbove
                            ? "text-emerald-600"
                            : isBelow
                              ? "text-rose-600"
                              : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {item.avgAmount > 0
                          ? `${item.variationPercent > 0 ? "+" : ""}${item.variationPercent.toFixed(1)}%`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.status === "sem_historico" ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Sem dados
                          </Badge>
                        ) : isAbove ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                            🟢 Acima
                          </Badge>
                        ) : isBelow ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
                            🔴 Abaixo
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                            🟡 Na Média
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO DE INTERCORRÊNCIAS & CONTATOS DE FATURAMENTO REGISTRADOS NO DIA */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base font-semibold tracking-tight">
                Intercorrências & Contatos de Faturamento do Dia ({analysis.formattedTargetDate})
              </CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIncidentDialogOpen(true)}
              className="h-8 text-xs gap-1.5 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Intercorrência
            </Button>
          </div>
          <CardDescription className="text-xs">
            Registro de imprevistos, problemas de rota, cancelamentos de pedidos ou contatos que
            explicam a oscilação de faturamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.incidents.length === 0 ? (
            <div className="py-6 text-center space-y-1 bg-muted/20 rounded-lg border border-dashed border-border/70">
              <p className="text-xs text-muted-foreground">
                Nenhuma intercorrência ou contato registrado para {analysis.formattedTargetDate}.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Houve algum imprevisto que afetou a operação? Clique em "Registrar Intercorrência"
                para arquivar no histórico.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    inc.status === "resolvido"
                      ? "bg-emerald-50/20 border-emerald-200 dark:border-emerald-800/50"
                      : "bg-rose-50/20 border-rose-200 dark:border-rose-800/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-semibold">
                        {inc.category}
                      </Badge>
                      {inc.to_meeting && (
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold">
                          📌 Pauta de Reunião
                        </Badge>
                      )}
                      <Badge
                        className={`text-[10px] font-bold ${
                          inc.status === "resolvido"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {inc.status === "resolvido" ? "Resolvido" : "Pendente"}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Por: <b>{inc.user_name}</b>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">
                        Intercorrência:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">{inc.incident}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">
                        Ação Tomada:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">{inc.action_taken}</p>
                    </div>
                  </div>

                  {inc.resolution_notes && (
                    <div className="pt-2 border-t border-border/50 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <b>Retorno / Solução:</b> {inc.resolution_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG DE NOVA INTERCORRÊNCIA */}
      <SalesIncidentDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        initialDate={selectedDate}
        onSaved={() => refetch()}
      />
    </div>
  );
}
