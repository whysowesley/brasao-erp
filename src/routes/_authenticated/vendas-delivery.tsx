import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  Truck,
  Plus,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Download,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieChartIcon,
  BarChart3,
  CalendarDays,
  LineChart,
  ArrowRight,
  Sparkles,
  Info,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryDayEntryDialog } from "@/components/vendas/DeliveryDayEntryDialog";
import { DeliveryConfigDialog } from "@/components/vendas/DeliveryConfigDialog";
import {
  useDeliveryConfig,
  useMonthlyDeliveryEntries,
  calculateDeliveryMonthMetrics,
  classifyDeliveryCost,
} from "@/lib/delivery";
import { type DailyDeliveryEntry, DEFAULT_DELIVERY_CONFIG } from "@/lib/delivery-types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/vendas-delivery")({
  head: () => ({
    meta: [
      { title: "Delivery & Corridas | Galeteria Brasão" },
      {
        name: "description",
        content:
          "Gestão diária de entregas próprias vs Gami/terceirizadas, custos médios por corrida e KPIs comparativos.",
      },
    ],
  }),
  component: VendasDeliveryPage,
});

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
}

function VendasDeliveryPage() {
  const { canWrite } = useAuth();
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const monthKey = useMemo(() => format(currentMonthDate, "yyyy-MM"), [currentMonthDate]);

  // Dialogs
  const [openEntryDialog, setOpenEntryDialog] = useState(false);
  const [dialogDate, setDialogDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedEntryToEdit, setSelectedEntryToEdit] = useState<DailyDeliveryEntry | null>(null);
  const [openConfigDialog, setOpenConfigDialog] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<string>("consolidado");

  // Data queries
  const { data: config = DEFAULT_DELIVERY_CONFIG } = useDeliveryConfig();
  const { data: entries = [], isLoading } = useMonthlyDeliveryEntries(monthKey);

  // Metrics
  const metrics = useMemo(() => {
    return calculateDeliveryMonthMetrics(entries, config);
  }, [entries, config]);

  // Map of entries by date for fast lookup
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyDeliveryEntry>();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  // Days in month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonthDate);
    const end = endOfMonth(currentMonthDate);
    return eachDayOfInterval({ start, end });
  }, [currentMonthDate]);

  // Chart data
  const chartData = useMemo(() => {
    return daysInMonth
      .map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const entry = entriesByDate.get(dateStr);
        if (!entry || (entry.total_corridas === 0 && entry.total_custo === 0)) {
          return null;
        }
        return {
          date: dateStr,
          dia: format(day, "dd/MM"),
          diaSemana: format(day, "EEE", { locale: ptBR }),
          propriaCorridas: entry.propria_corridas,
          gamiCorridas: entry.gami_corridas,
          totalCorridas: entry.total_corridas,
          propriaTicket: entry.propria_ticket_medio,
          gamiTicket: entry.gami_ticket_medio,
          ticketGeral: entry.ticket_medio_geral,
          propriaCusto: entry.propria_custo_total,
          gamiCusto: entry.gami_custo_total,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [daysInMonth, entriesByDate]);

  const handleOpenNewEntry = (dateStr?: string) => {
    const targetDate = dateStr || format(new Date(), "yyyy-MM-dd");
    const existing = entriesByDate.get(targetDate) || null;
    setSelectedEntryToEdit(existing);
    setDialogDate(targetDate);
    setOpenEntryDialog(true);
  };

  const handleEditEntry = (entry: DailyDeliveryEntry) => {
    setSelectedEntryToEdit(entry);
    setDialogDate(entry.date);
    setOpenEntryDialog(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (entries.length === 0) {
      toast.warning("Nenhum lançamento no mês para exportar.");
      return;
    }

    const rows = entries.map((e) => ({
      Data: format(parseISO(e.date), "dd/MM/yyyy"),
      "Dia da Semana": format(parseISO(e.date), "EEEE", { locale: ptBR }),
      "Própria - Corridas": e.propria_corridas,
      "Própria - Diárias (R$)": e.propria_custo_fixo,
      "Própria - Variável (R$)": e.propria_custo_variavel,
      "Própria - Custo Total (R$)": e.propria_custo_total,
      "Própria - Custo Médio / Corrida (R$)": e.propria_ticket_medio,
      "Gami - Corridas": e.gami_corridas,
      "Gami - Custo Total (R$)": e.gami_custo_total,
      "Gami - Custo Médio / Corrida (R$)": e.gami_ticket_medio,
      "Total Corridas": e.total_corridas,
      "Total Custo (R$)": e.total_custo,
      "Custo Médio Geral (R$)": e.ticket_medio_geral,
      "Mais Econômica":
        e.mais_vantajoso === "propria"
          ? "Própria"
          : e.mais_vantajoso === "gami"
            ? "Gami"
            : e.mais_vantajoso,
      Diferença: Math.abs(e.diferenca_ticket),
      Observações: [e.propria_observacoes, e.gami_observacoes].filter(Boolean).join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery");
    XLSX.writeFile(wb, `Delivery_Galeteria_Brasao_${monthKey}.xlsx`);
    toast.success("Planilha de delivery exportada com sucesso!");
  };

  // Classificações gerais das médias mensais
  const propriaMonthStatus = classifyDeliveryCost(
    metrics.ticketMedioPropria,
    config.propria_thresholds,
  );
  const gamiMonthStatus = classifyDeliveryCost(metrics.ticketMedioGami, config.gami_thresholds);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <PageHeader
        title="Delivery & Corridas"
        description="Gestão de custos e corridas de Entregas Próprias vs Gami/Terceirizadas, ticket médio e análise comparativa"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-1.5 h-9"
              title="Exportar dados do mês para planilha Excel"
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenConfigDialog(true)}
              className="gap-1.5 h-9"
              title="Configurar diárias, taxa por corrida e limites de criticidade"
            >
              <Settings className="h-4 w-4 text-primary" />
              <span>Configurações</span>
            </Button>

            {canWrite && (
              <Button
                size="sm"
                onClick={() => handleOpenNewEntry()}
                className="gap-1.5 bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90 h-9"
              >
                <Plus className="h-4 w-4" />
                <span>+ Lançar Dia</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Subnavegação entre módulos de Vendas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
          <Link
            to="/vendas"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            Vendas por Canal
          </Link>
          <Link
            to="/vendas-projecao"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            Projeção & Médias
          </Link>
          <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-background text-primary shadow-xs">
            Delivery & Corridas
          </span>
        </div>

        {/* Navegação de Mês */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonthDate((d) => subMonths(d, 1))}
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 text-sm font-semibold capitalize min-w-[150px] text-center">
              {format(currentMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonthDate((d) => addMonths(d, 1))}
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonthDate(new Date())}
            className="text-xs h-9"
          >
            Mês Atual
          </Button>
        </div>
      </div>

      {/* 5 Cards de KPIs Inteligentes no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Custo Total */}
        <Card className="shadow-xs border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Custo Total Delivery</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-foreground">
              {formatCurrency(metrics.totalCustoGeral)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="flex items-center gap-1">
                <Bike className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Própria:
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.totalCustoPropria)} (
                {metrics.percentualCustoPropria.toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                Gami:
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.totalCustoGami)} ({metrics.percentualCustoGami.toFixed(0)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Volume Total de Corridas */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Volume de Corridas</span>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-foreground">
              {metrics.totalCorridasGeral}{" "}
              <span className="text-xs font-normal text-muted-foreground">corridas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Própria:</span>
              <span className="font-semibold text-foreground">
                {metrics.totalCorridasPropria} ({metrics.percentualVolumePropria.toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Gami:</span>
              <span className="font-semibold text-foreground">
                {metrics.totalCorridasGami} ({metrics.percentualVolumeGami.toFixed(0)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Ticket Médio Próprias */}
        <Card className="shadow-xs border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1">
                <Bike className="h-3.5 w-3.5" />
                Médio Própria / Corrida
              </span>
              {metrics.totalCorridasPropria > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${propriaMonthStatus.badgeClass}`}
                >
                  {propriaMonthStatus.label}
                </Badge>
              )}
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {metrics.totalCorridasPropria > 0 ? formatCurrency(metrics.ticketMedioPropria) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Diárias fixas:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.propriaCustoFixo)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Taxas variáveis:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.propriaCustoVariavel)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Ticket Médio Gami */}
        <Card className="shadow-xs border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between text-blue-800 dark:text-blue-300">
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />
                Médio Gami / Corrida
              </span>
              {metrics.totalCorridasGami > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${gamiMonthStatus.badgeClass}`}
                >
                  {gamiMonthStatus.label}
                </Badge>
              )}
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">
              {metrics.totalCorridasGami > 0 ? formatCurrency(metrics.ticketMedioGami) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Fatura total:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.totalCustoGami)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Corridas:</span>
              <span className="font-semibold text-foreground">
                {metrics.totalCorridasGami} realizadas
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Comparativo Própria vs Gami */}
        <Card className="shadow-xs bg-muted/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold flex items-center justify-between">
              <span>Comparativo de Custo</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-lg font-bold text-foreground">
              {metrics.modalidadeMaisEconomica === "propria" && (
                <span className="text-emerald-600 dark:text-emerald-400">Própria + Econômica</span>
              )}
              {metrics.modalidadeMaisEconomica === "gami" && (
                <span className="text-blue-600 dark:text-blue-400">Gami + Econômica</span>
              )}
              {metrics.modalidadeMaisEconomica === "empate" && (
                <span className="text-muted-foreground">Custos Empatados</span>
              )}
              {metrics.modalidadeMaisEconomica === "sem_dados" && (
                <span className="text-muted-foreground">Sem dados suficientes</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
            {metrics.diferencaTicketMedio !== 0 ? (
              <p>
                Diferença de{" "}
                <span className="font-bold text-foreground">
                  {formatCurrency(Math.abs(metrics.diferencaTicketMedio))}
                </span>{" "}
                por corrida no acumulado do mês.
              </p>
            ) : (
              <p>Valores médios idênticos ou apenas uma modalidade utilizada.</p>
            )}
            <p className="text-[11px]">{metrics.diasLancados} dias com operações registradas.</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="consolidado" className="text-xs font-semibold gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral & Tabela Diária
          </TabsTrigger>
          <TabsTrigger value="propria" className="text-xs font-semibold gap-1.5">
            <Bike className="h-3.5 w-3.5" />
            Entregas Próprias
          </TabsTrigger>
          <TabsTrigger value="gami" className="text-xs font-semibold gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Entregas Gami / Terceirizadas
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Visão Geral & Consolidado */}
        <TabsContent value="consolidado" className="space-y-6">
          {/* Gráfico Comparativo */}
          {chartData.length > 0 && (
            <Card className="shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-primary" />
                      Evolução Diária do Custo Médio por Corrida (R$)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Comparação diária entre o custo por corrida da Entregas Próprias (verde)
                      versus Gami (azul).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="dia" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          formatCurrency(val),
                          name === "propriaTicket"
                            ? "Custo Médio Própria"
                            : name === "gamiTicket"
                              ? "Custo Médio Gami"
                              : "Média Geral",
                        ]}
                        labelFormatter={(label) => `Dia: ${label}`}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "propriaTicket"
                            ? "Própria (R$/corrida)"
                            : value === "gamiTicket"
                              ? "Gami (R$/corrida)"
                              : "Média Geral (R$)"
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="propriaTicket"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        name="propriaTicket"
                      />
                      <Line
                        type="monotone"
                        dataKey="gamiTicket"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        name="gamiTicket"
                      />
                      <Line
                        type="monotone"
                        dataKey="ticketGeral"
                        stroke="#8b5cf6"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        name="ticketGeral"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela Diária Completa */}
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Lançamentos Dia a Dia (
                    {format(currentMonthDate, "MMMM 'de' yyyy", { locale: ptBR })})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tabela consolidada com corridas, custos fixos, variáveis e classificação por
                    dia.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">Ótimo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Normal</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-muted-foreground">Crítico</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs hover:bg-muted/40">
                    <TableHead className="font-bold min-w-[120px]">Data / Dia</TableHead>

                    {/* Grupo Própria */}
                    <TableHead className="text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-l">
                      Corridas Própria
                    </TableHead>
                    <TableHead className="text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                      Custo Total Própria
                    </TableHead>
                    <TableHead className="text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                      Médio / Corrida
                    </TableHead>

                    {/* Grupo Gami */}
                    <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 border-l">
                      Corridas Gami
                    </TableHead>
                    <TableHead className="text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10">
                      Custo Total Gami
                    </TableHead>
                    <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10">
                      Médio / Corrida
                    </TableHead>

                    {/* Consolidado */}
                    <TableHead className="text-center font-bold border-l">Total Corridas</TableHead>
                    <TableHead className="text-right font-bold">Custo Total</TableHead>
                    <TableHead className="text-center font-bold">Médio Geral</TableHead>
                    <TableHead className="text-center font-bold">Mais Econômico</TableHead>
                    <TableHead className="text-right font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daysInMonth.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const entry = entriesByDate.get(dateStr);
                    const isCurrentToday = isToday(day);

                    const pStatus = entry?.propria_corridas
                      ? classifyDeliveryCost(entry.propria_ticket_medio, config.propria_thresholds)
                      : null;
                    const gStatus = entry?.gami_corridas
                      ? classifyDeliveryCost(entry.gami_ticket_medio, config.gami_thresholds)
                      : null;

                    return (
                      <TableRow
                        key={dateStr}
                        className={`text-xs hover:bg-muted/30 transition-colors ${
                          isCurrentToday ? "bg-primary/5 font-medium" : ""
                        }`}
                      >
                        {/* Data */}
                        <TableCell className="font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm">{format(day, "dd")}</span>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              ({format(day, "EEE", { locale: ptBR })})
                            </span>
                            {isCurrentToday && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary"
                              >
                                Hoje
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Própria */}
                        <TableCell className="text-center border-l bg-emerald-500/5 font-semibold">
                          {entry?.propria_corridas ? entry.propria_corridas : "—"}
                        </TableCell>
                        <TableCell className="text-right bg-emerald-500/5 font-medium">
                          {entry?.propria_custo_total
                            ? formatCurrency(entry.propria_custo_total)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center bg-emerald-500/5">
                          {entry?.propria_corridas && entry.propria_ticket_medio ? (
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${pStatus?.badgeClass}`}
                            >
                              {formatCurrency(entry.propria_ticket_medio)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Gami */}
                        <TableCell className="text-center border-l bg-blue-500/5 font-semibold">
                          {entry?.gami_corridas ? entry.gami_corridas : "—"}
                        </TableCell>
                        <TableCell className="text-right bg-blue-500/5 font-medium">
                          {entry?.gami_custo_total ? formatCurrency(entry.gami_custo_total) : "—"}
                        </TableCell>
                        <TableCell className="text-center bg-blue-500/5">
                          {entry?.gami_corridas && entry.gami_ticket_medio ? (
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${gStatus?.badgeClass}`}
                            >
                              {formatCurrency(entry.gami_ticket_medio)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Consolidado */}
                        <TableCell className="text-center border-l font-bold">
                          {entry?.total_corridas ? entry.total_corridas : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          {entry?.total_custo ? formatCurrency(entry.total_custo) : "—"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-primary">
                          {entry?.total_corridas && entry.ticket_medio_geral
                            ? formatCurrency(entry.ticket_medio_geral)
                            : "—"}
                        </TableCell>

                        {/* Mais Econômico */}
                        <TableCell className="text-center">
                          {entry?.mais_vantajoso === "propria" && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Própria (-{formatCurrency(Math.abs(entry.diferenca_ticket))})
                            </Badge>
                          )}
                          {entry?.mais_vantajoso === "gami" && (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                              Gami (-{formatCurrency(Math.abs(entry.diferenca_ticket))})
                            </Badge>
                          )}
                          {entry?.mais_vantajoso === "empate" && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Empate
                            </Badge>
                          )}
                          {entry?.mais_vantajoso === "apenas_propria" && (
                            <span className="text-[11px] text-emerald-600 font-medium">
                              Só Própria
                            </span>
                          )}
                          {entry?.mais_vantajoso === "apenas_gami" && (
                            <span className="text-[11px] text-blue-600 font-medium">Só Gami</span>
                          )}
                          {(!entry || entry.mais_vantajoso === "sem_corridas") && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-right">
                          {entry ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditEntry(entry)}
                              title="Editar lançamento do dia"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 font-semibold"
                                onClick={() => handleOpenNewEntry(dateStr)}
                                title="Lançar dados para este dia"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Lançar
                              </Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter className="bg-muted/60 font-bold text-xs">
                  <TableRow>
                    <TableCell>TOTAL / MÉDIA</TableCell>
                    <TableCell className="text-center border-l bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {metrics.totalCorridasPropria}
                    </TableCell>
                    <TableCell className="text-right bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(metrics.totalCustoPropria)}
                    </TableCell>
                    <TableCell className="text-center bg-emerald-500/10 font-extrabold text-emerald-700 dark:text-emerald-400">
                      {metrics.totalCorridasPropria > 0
                        ? formatCurrency(metrics.ticketMedioPropria)
                        : "—"}
                    </TableCell>

                    <TableCell className="text-center border-l bg-blue-500/10 text-blue-700 dark:text-blue-400">
                      {metrics.totalCorridasGami}
                    </TableCell>
                    <TableCell className="text-right bg-blue-500/10 text-blue-700 dark:text-blue-400">
                      {formatCurrency(metrics.totalCustoGami)}
                    </TableCell>
                    <TableCell className="text-center bg-blue-500/10 font-extrabold text-blue-700 dark:text-blue-400">
                      {metrics.totalCorridasGami > 0
                        ? formatCurrency(metrics.ticketMedioGami)
                        : "—"}
                    </TableCell>

                    <TableCell className="text-center border-l">
                      {metrics.totalCorridasGeral}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(metrics.totalCustoGeral)}
                    </TableCell>
                    <TableCell className="text-center text-primary font-extrabold">
                      {metrics.totalCorridasGeral > 0
                        ? formatCurrency(metrics.ticketMedioGeral)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center capitalize">
                      {metrics.modalidadeMaisEconomica === "propria" && (
                        <span className="text-emerald-600 font-bold">Própria</span>
                      )}
                      {metrics.modalidadeMaisEconomica === "gami" && (
                        <span className="text-blue-600 font-bold">Gami</span>
                      )}
                      {metrics.modalidadeMaisEconomica === "empate" && "Empate"}
                      {metrics.modalidadeMaisEconomica === "sem_dados" && "—"}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Entregas Próprias */}
        <TabsContent value="propria" className="space-y-4">
          <Card className="shadow-xs border-emerald-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      Detalhamento de Entregas Próprias (Motoboys)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cálculo: (Corridas × R$ {config.propria_taxa_por_corrida.toFixed(2)}) + Diária
                      de R$ {config.propria_diaria_padrao.toFixed(2)}.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={propriaMonthStatus.badgeClass}>
                    Média no Mês: {formatCurrency(metrics.ticketMedioPropria)}/corrida (
                    {propriaMonthStatus.label})
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-3 rounded-lg border bg-emerald-500/5">
                  <span className="text-xs text-muted-foreground block">
                    Total de Corridas Próprias
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {metrics.totalCorridasPropria}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-emerald-500/5">
                  <span className="text-xs text-muted-foreground block">
                    Custo Fixo Total (Diárias)
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(metrics.propriaCustoFixo)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-emerald-500/5">
                  <span className="text-xs text-muted-foreground block">
                    Custo Variável Total (Taxas)
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(metrics.propriaCustoVariavel)}
                  </span>
                </div>
              </div>

              {/* Tabela focada na Própria */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Corridas</TableHead>
                      <TableHead className="text-right">Diária Fixa</TableHead>
                      <TableHead className="text-right">Taxa Variável</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-center">Custo Médio / Corrida</TableHead>
                      <TableHead className="text-center">Classificação</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .filter((e) => e.propria_corridas > 0)
                      .map((e) => {
                        const status = classifyDeliveryCost(
                          e.propria_ticket_medio,
                          config.propria_thresholds,
                        );
                        return (
                          <TableRow key={e.id} className="text-xs">
                            <TableCell className="font-bold">
                              {format(parseISO(e.date), "dd/MM (EEEE)", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {e.propria_corridas}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(e.propria_custo_fixo)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(e.propria_custo_variavel)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(e.propria_custo_total)}
                            </TableCell>
                            <TableCell className="text-center font-extrabold text-sm">
                              {formatCurrency(e.propria_ticket_medio)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-xs ${status.badgeClass}`}>
                                <span
                                  className={`h-1.5 w-1.5 rounded-full mr-1.5 ${status.dotColor}`}
                                />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">
                              {e.propria_observacoes || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {entries.filter((e) => e.propria_corridas > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                          Nenhum lançamento de entregas próprias neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Entregas Gami / Terceirizadas */}
        <TabsContent value="gami" className="space-y-4">
          <Card className="shadow-xs border-blue-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      Detalhamento de Entregas Gami / Terceirizadas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Fórmula direta: Custo Total Informado ÷ Quantidade de Corridas Realizadas.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={gamiMonthStatus.badgeClass}>
                    Média no Mês: {formatCurrency(metrics.ticketMedioGami)}/corrida (
                    {gamiMonthStatus.label})
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg border bg-blue-500/5">
                  <span className="text-xs text-muted-foreground block">
                    Total de Corridas Gami
                  </span>
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {metrics.totalCorridasGami}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-blue-500/5">
                  <span className="text-xs text-muted-foreground block">
                    Custo Total Faturado Gami
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(metrics.totalCustoGami)}
                  </span>
                </div>
              </div>

              {/* Tabela focada na Gami */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Corridas Realizadas</TableHead>
                      <TableHead className="text-right">Fatura Total Gami (R$)</TableHead>
                      <TableHead className="text-center">Custo Médio / Corrida</TableHead>
                      <TableHead className="text-center">Classificação</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .filter((e) => e.gami_corridas > 0)
                      .map((e) => {
                        const status = classifyDeliveryCost(
                          e.gami_ticket_medio,
                          config.gami_thresholds,
                        );
                        return (
                          <TableRow key={e.id} className="text-xs">
                            <TableCell className="font-bold">
                              {format(parseISO(e.date), "dd/MM (EEEE)", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {e.gami_corridas}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-700 dark:text-blue-400">
                              {formatCurrency(e.gami_custo_total)}
                            </TableCell>
                            <TableCell className="text-center font-extrabold text-sm">
                              {formatCurrency(e.gami_ticket_medio)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-xs ${status.badgeClass}`}>
                                <span
                                  className={`h-1.5 w-1.5 rounded-full mr-1.5 ${status.dotColor}`}
                                />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">
                              {e.gami_observacoes || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {entries.filter((e) => e.gami_corridas > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          Nenhum lançamento de entregas Gami neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DeliveryDayEntryDialog
        open={openEntryDialog}
        onOpenChange={setOpenEntryDialog}
        initialDate={dialogDate}
        existingEntry={selectedEntryToEdit}
      />

      <DeliveryConfigDialog open={openConfigDialog} onOpenChange={setOpenConfigDialog} />
    </div>
  );
}
