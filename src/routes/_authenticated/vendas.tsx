import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DollarSign,
  Download,
  Edit2,
  Filter,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
  Bike,
  PhoneCall,
  CalendarDays,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from "recharts";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LancarVendaDialog } from "@/components/vendas/LancarVendaDialog";
import {
  computeMonthSalesMetrics,
  formatCurrency,
  getCurrentMonthKey,
  getMonthLabel,
  getTodayDateString,
  useDailySales,
  useDeleteDaySales,
} from "@/lib/vendas";
import { SALES_CHANNELS, type SalesChannelKey } from "@/lib/vendas-types";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas & Faturamento | Galeteria Brasão" },
      {
        name: "description",
        content:
          "Lançamento diário de vendas por canal (Balcão/Salão, iFood, Anota Aí, 99Food, SW Fast) e faturamento mensal.",
      },
    ],
  }),
  component: VendasPage,
});

function VendasPage() {
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [showOnlyDaysWithSales, setShowOnlyDaysWithSales] = useState<boolean>(false);

  // Dialog de lançamento
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingDate, setEditingDate] = useState<string>(getTodayDateString());

  // Confirmação de exclusão
  const [deleteDate, setDeleteDate] = useState<string | null>(null);

  // Queries e Mutations
  const { data: records = [], isLoading } = useDailySales(selectedMonth);
  const deleteDaySales = useDeleteDaySales();

  // Métricas do mês
  const metrics = useMemo(() => {
    return computeMonthSalesMetrics(records, selectedMonth);
  }, [records, selectedMonth]);

  // Navegação de mês
  function handlePrevMonth() {
    const [year = "", month = ""] = selectedMonth.split("-");
    const y = Number(year);
    const m = Number(month);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${newY}-${newM}`);
  }

  function handleNextMonth() {
    const [year = "", month = ""] = selectedMonth.split("-");
    const y = Number(year);
    const m = Number(month);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${newY}-${newM}`);
  }

  function handleCurrentMonth() {
    setSelectedMonth(currentMonthKey);
  }

  // Abertura de modal
  function openNewSale(date?: string) {
    setEditingDate(date || getTodayDateString());
    setDialogOpen(true);
  }

  // Exclusão de dia
  async function confirmDeleteDay() {
    if (!deleteDate) return;
    try {
      await deleteDaySales.mutateAsync(deleteDate);
      const [y, m, d] = deleteDate.split("-");
      toast.success(`Lançamentos do dia ${d}/${m}/${y} removidos.`);
      setDeleteDate(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover lançamentos do dia.");
    }
  }

  // Exportar para Excel
  function exportToExcel() {
    if (metrics.days.length === 0) {
      toast.error("Sem dados para exportar neste mês.");
      return;
    }

    const rows = metrics.days.map((d) => ({
      Data: d.date,
      "Dia da Semana": d.dayOfWeek,
      "Balcão / Salão (R$)": d.balcao_salao,
      "iFood (R$)": d.delivery_ifood,
      "Anota Aí (R$)": d.delivery_anota_ai,
      "99Food (R$)": d.delivery_99,
      "SW Fast (R$)": d.delivery_sw_fast,
      "Total Delivery (R$)": d.totalDelivery,
      "Total do Dia (R$)": d.totalDay,
      "Faturamento Acumulado Mês (R$)": d.cumulativeMonth,
      "Nº Pedidos": d.totalOrders || 0,
    }));

    // Linha de total
    rows.push({
      Data: "TOTAL GERAL",
      "Dia da Semana": "-",
      "Balcão / Salão (R$)": metrics.totalBalcao,
      "iFood (R$)": metrics.channelTotals.delivery_ifood,
      "Anota Aí (R$)": metrics.channelTotals.delivery_anota_ai,
      "99Food (R$)": metrics.channelTotals.delivery_99,
      "SW Fast (R$)": metrics.channelTotals.delivery_sw_fast,
      "Total Delivery (R$)": metrics.totalDelivery,
      "Total do Dia (R$)": metrics.totalRevenue,
      "Faturamento Acumulado Mês (R$)": metrics.totalRevenue,
      "Nº Pedidos": metrics.totalOrdersCount,
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas Diárias");

    const fileName = `Vendas_Galeteria_Brasao_${selectedMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Relatório de vendas exportado com sucesso!");
  }

  // Linhas a exibir na tabela
  const displayDays = useMemo(() => {
    if (showOnlyDaysWithSales) {
      return metrics.days.filter((d) => d.totalDay > 0);
    }
    return metrics.days;
  }, [metrics.days, showOnlyDaysWithSales]);

  // Dados para o gráfico diário
  const chartData = useMemo(() => {
    return metrics.days.map((d) => ({
      name: `${String(d.dayOfMonth).padStart(2, "0")} ${d.dayOfWeek}`,
      "Balcão / Salão": d.balcao_salao,
      iFood: d.delivery_ifood,
      "Anota Aí": d.delivery_anota_ai,
      "99Food": d.delivery_99,
      "SW Fast": d.delivery_sw_fast,
      Total: d.totalDay,
      Acumulado: d.cumulativeMonth,
    }));
  }, [metrics.days]);

  // Dados para o gráfico de pizza (Market Share dos Canais)
  const pieData = useMemo(() => {
    const list = [
      {
        name: "Balcão / Salão",
        value: metrics.channelTotals.balcao_salao,
        color: SALES_CHANNELS.balcao_salao.color,
      },
      {
        name: "iFood",
        value: metrics.channelTotals.delivery_ifood,
        color: SALES_CHANNELS.delivery_ifood.color,
      },
      {
        name: "Anota Aí",
        value: metrics.channelTotals.delivery_anota_ai,
        color: SALES_CHANNELS.delivery_anota_ai.color,
      },
      {
        name: "99Food",
        value: metrics.channelTotals.delivery_99,
        color: SALES_CHANNELS.delivery_99.color,
      },
      {
        name: "SW Fast",
        value: metrics.channelTotals.delivery_sw_fast,
        color: SALES_CHANNELS.delivery_sw_fast.color,
      },
    ];
    return list.filter((item) => item.value > 0);
  }, [metrics.channelTotals]);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER DA PÁGINA */}
      <PageHeader
        title="Vendas & Faturamento"
        description="Acompanhamento diário de vendas por canal (Balcão/Salão, iFood, Anota Aí, 99Food, SW Fast) com soma progressiva mensal."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Seletor de Mês */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 sm:p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevMonth}
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 sm:px-3 text-xs font-semibold text-foreground min-w-[120px] sm:min-w-[140px] text-center capitalize">
                {metrics.monthLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextMonth}
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedMonth !== currentMonthKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCurrentMonth}
                  className="h-8 text-xs font-medium"
                >
                  Mês Atual
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Exportar</span>
              </Button>

              <Button
                onClick={() => openNewSale()}
                className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Lançar Vendas</span>
              </Button>
            </div>
          </div>
        }
      />

      {/* KPI CARDS (RESUMO DO MÊS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. FATURAMENTO TOTAL DO MÊS */}
        <Card className="border-border/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Faturamento Total do Mês</span>
              <CircleDollarSign className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(metrics.totalRevenue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Dias com vendas:</span>
              <span className="font-semibold text-foreground">
                {metrics.daysWithSalesCount} dias
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Soma acumulada:</span>
              <span className="font-semibold text-primary">100% computado</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. BALCÃO / SALÃO (PRESENCIAL) */}
        <Card className="border-border/80 shadow-xs border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>Balcão / Salão</span>
              <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(metrics.totalBalcao)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Participação no mês:</span>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold"
              >
                {metrics.percentBalcao.toFixed(1)}% do total
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              Almoço no local e retiradas balcão
            </p>
          </CardContent>
        </Card>

        {/* 3. CANAIS DELIVERY */}
        <Card className="border-border/80 shadow-xs border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Delivery (Total Canais)</span>
              <Bike className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                formatCurrency(metrics.totalDelivery)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Participação no mês:</span>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold"
              >
                {metrics.percentDelivery.toFixed(1)}% do total
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
              <span className="truncate">
                iFood:{" "}
                <b className="text-foreground">
                  {formatCurrency(metrics.channelTotals.delivery_ifood)}
                </b>
              </span>
              <span className="truncate">
                Anota Aí:{" "}
                <b className="text-foreground">
                  {formatCurrency(metrics.channelTotals.delivery_anota_ai)}
                </b>
              </span>
              <span className="truncate">
                99Food:{" "}
                <b className="text-foreground">
                  {formatCurrency(metrics.channelTotals.delivery_99)}
                </b>
              </span>
              <span className="truncate">
                SW Fast:{" "}
                <b className="text-foreground">
                  {formatCurrency(metrics.channelTotals.delivery_sw_fast)}
                </b>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. MÉDIA DIÁRIA & DESTAQUES */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Média Diária & Recorde</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                formatCurrency(metrics.avgDailyRevenue)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Melhor dia:</span>
              <span className="font-semibold text-emerald-600">
                {metrics.bestDay ? formatCurrency(metrics.bestDay.amount) : "R$ 0,00"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Data do melhor dia:</span>
              <span className="font-medium text-foreground">
                {metrics.bestDay ? metrics.bestDay.date.split("-").reverse().join("/") : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS DE VISUALIZAÇÃO */}
      <Tabs defaultValue="tabela" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="tabela" className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Diário de Vendas & Soma Mês
            </TabsTrigger>
            <TabsTrigger value="graficos" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Gráficos & Comparativo de Canais
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyDaysWithSales((prev) => !prev)}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-3 w-3" />
              {showOnlyDaysWithSales
                ? "Mostrando apenas dias com venda"
                : "Mostrar todos os dias do mês"}
            </Button>
          </div>
        </div>

        {/* TAB 1: TABELA DIÁRIA */}
        <TabsContent value="tabela" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    Lançamentos Dia a Dia ({metrics.monthLabel})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cada venda lançada se soma progressivamente para compor o faturamento total
                    acumulado do mês.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openNewSale()}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Lançamento
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="sm:hidden flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground bg-muted/40 border-b">
                <span>Arraste para o lado para ver todos os canais</span>
                <span className="font-mono text-[10px] text-primary">↔ deslize</span>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[120px]">Data</TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1 text-emerald-700 dark:text-emerald-300">
                          <UtensilsCrossed className="h-3.5 w-3.5" />
                          <span>Balcão / Salão</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1 text-rose-600">
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>iFood</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sky-600">
                          <Smartphone className="h-3.5 w-3.5" />
                          <span>Anota Aí</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1 text-amber-600">
                          <Bike className="h-3.5 w-3.5" />
                          <span>99Food</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1 text-violet-600">
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>SW Fast</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-bold text-foreground">
                        Total do Dia
                      </TableHead>
                      <TableHead className="text-right font-bold text-primary bg-primary/5">
                        Acumulado Mês
                      </TableHead>
                      <TableHead className="w-[90px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          Carregando lançamentos de vendas do banco de dados...
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && displayDays.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          Nenhum lançamento de venda registrado neste mês. Clique em "Lançar Vendas
                          do Dia" para começar.
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading &&
                      displayDays.map((d) => {
                        const isToday = d.date === getTodayDateString();
                        const hasSales = d.totalDay > 0;

                        return (
                          <TableRow
                            key={d.date}
                            className={
                              isToday
                                ? "bg-amber-50/40 dark:bg-amber-950/20 font-medium"
                                : hasSales
                                  ? undefined
                                  : "opacity-60 hover:opacity-100"
                            }
                          >
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">
                                  {d.formattedDate}
                                </span>
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  {d.dayOfWeek}
                                </span>
                                {isToday && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 bg-amber-100 text-amber-900 border-amber-300"
                                  >
                                    Hoje
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            {/* Balcão / Salão */}
                            <TableCell className="text-right font-mono text-xs text-emerald-800 dark:text-emerald-300">
                              {d.balcao_salao > 0 ? formatCurrency(d.balcao_salao) : "-"}
                            </TableCell>

                            {/* iFood */}
                            <TableCell className="text-right font-mono text-xs">
                              {d.delivery_ifood > 0 ? formatCurrency(d.delivery_ifood) : "-"}
                            </TableCell>

                            {/* Anota Aí */}
                            <TableCell className="text-right font-mono text-xs">
                              {d.delivery_anota_ai > 0 ? formatCurrency(d.delivery_anota_ai) : "-"}
                            </TableCell>

                            {/* 99Food */}
                            <TableCell className="text-right font-mono text-xs">
                              {d.delivery_99 > 0 ? formatCurrency(d.delivery_99) : "-"}
                            </TableCell>

                            {/* SW Fast */}
                            <TableCell className="text-right font-mono text-xs">
                              {d.delivery_sw_fast > 0 ? formatCurrency(d.delivery_sw_fast) : "-"}
                            </TableCell>

                            {/* Total do Dia */}
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                              {d.totalDay > 0 ? formatCurrency(d.totalDay) : "R$ 0,00"}
                            </TableCell>

                            {/* Faturamento Acumulado no Mês */}
                            <TableCell className="text-right font-mono text-xs font-bold text-primary bg-primary/5">
                              {formatCurrency(d.cumulativeMonth)}
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => openNewSale(d.date)}
                                  title="Editar ou lançar vendas deste dia"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                {hasSales && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    onClick={() => setDeleteDate(d.date)}
                                    title="Remover lançamentos deste dia"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/80 font-bold text-xs">
                      <TableCell>TOTAL DO MÊS</TableCell>
                      <TableCell className="text-right font-mono text-emerald-800 dark:text-emerald-300">
                        {formatCurrency(metrics.totalBalcao)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(metrics.channelTotals.delivery_ifood)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(metrics.channelTotals.delivery_anota_ai)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(metrics.channelTotals.delivery_99)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(metrics.channelTotals.delivery_sw_fast)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground text-sm">
                        {formatCurrency(metrics.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary bg-primary/10 text-sm">
                        {formatCurrency(metrics.totalRevenue)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: GRÁFICOS & ANÁLISE DE CANAIS */}
        <TabsContent value="graficos" className="space-y-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Evolução Diária & Acumulado */}
            <Card className="lg:col-span-2 border-border/80 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Evolução das Vendas no Mês ({metrics.monthLabel})
                </CardTitle>
                <CardDescription className="text-xs">
                  Barras representam o total faturado no dia; a linha vermelha demonstra o acúmulo
                  financeiro no mês.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis
                        yAxisId="daily"
                        tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="acum"
                        orientation="right"
                        tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), ""]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        yAxisId="daily"
                        dataKey="Balcão / Salão"
                        stackId="a"
                        fill={SALES_CHANNELS.balcao_salao.color}
                      />
                      <Bar
                        yAxisId="daily"
                        dataKey="iFood"
                        stackId="a"
                        fill={SALES_CHANNELS.delivery_ifood.color}
                      />
                      <Bar
                        yAxisId="daily"
                        dataKey="Anota Aí"
                        stackId="a"
                        fill={SALES_CHANNELS.delivery_anota_ai.color}
                      />
                      <Bar
                        yAxisId="daily"
                        dataKey="99Food"
                        stackId="a"
                        fill={SALES_CHANNELS.delivery_99.color}
                      />
                      <Bar
                        yAxisId="daily"
                        dataKey="SW Fast"
                        stackId="a"
                        fill={SALES_CHANNELS.delivery_sw_fast.color}
                      />
                      <Line
                        yAxisId="acum"
                        type="monotone"
                        dataKey="Acumulado"
                        stroke="#b91c1c"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico 2: Pizza de Market Share dos Canais */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Participação por Canal (%)
                </CardTitle>
                <CardDescription className="text-xs">
                  Divisão do faturamento entre os canais de atendimento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground text-center">
                    Sem lançamentos registrados para exibir no gráfico.
                  </div>
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [formatCurrency(val), ""]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mini Legenda com Porcentagens */}
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  {Object.entries(SALES_CHANNELS).map(([key, cfg]) => {
                    const chKey = key as SalesChannelKey;
                    const val = metrics.channelTotals[chKey] || 0;
                    const pct = metrics.channelPercentages[chKey] || 0;
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <span className="text-muted-foreground">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(val)}
                          </span>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TABELA RESUMO DETALHADA POR CANAL */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">
                Performance Consolidada por Canal de Venda
              </CardTitle>
              <CardDescription className="text-xs">
                Resumo comparativo do volume gerado em cada plataforma neste mês.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Canal</TableHead>
                      <TableHead>Tipo / Categoria</TableHead>
                      <TableHead className="text-right">Faturamento Total</TableHead>
                      <TableHead className="text-right">Participação (%)</TableHead>
                      <TableHead className="text-right">Média Diária</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(SALES_CHANNELS).map(([key, cfg]) => {
                      const chKey = key as SalesChannelKey;
                      const total = metrics.channelTotals[chKey] || 0;
                      const pct = metrics.channelPercentages[chKey] || 0;
                      const dailyAvg =
                        metrics.daysWithSalesCount > 0 ? total / metrics.daysWithSalesCount : 0;

                      return (
                        <TableRow key={key}>
                          <TableCell className="font-semibold text-xs flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: cfg.color }}
                            />
                            {cfg.label}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={cfg.badgeBg}>
                              {cfg.categoryLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatCurrency(dailyAvg)} / dia
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE LANÇAMENTO */}
      <LancarVendaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={editingDate}
        existingRecords={records}
      />

      {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={Boolean(deleteDate)} onOpenChange={(open) => !open && setDeleteDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold tracking-tight">
              Remover lançamentos do dia?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar todos os lançamentos de vendas do dia{" "}
              <b>{deleteDate ? deleteDate.split("-").reverse().join("/") : ""}</b>? Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDay}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Sim, Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
