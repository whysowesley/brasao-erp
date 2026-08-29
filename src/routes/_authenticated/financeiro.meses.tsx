import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { FinanceiroStatCard } from "@/components/financeiro/FinanceiroStatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

import { useMonthlyFinancialSummary } from "@/lib/financeiro";

export const Route = createFileRoute("/_authenticated/financeiro/meses")({
  head: () => ({
    meta: [
      { title: "Visão Mensal e Anual | Brasão Financeiro" },
      {
        name: "description",
        content:
          "Comparativo de receitas, despesas e evolução do fluxo de caixa mês a mês da Brasão.",
      },
    ],
  }),
  component: VisaoMesesPage,
});

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function VisaoMesesPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { monthsData = [], isLoading } = useMonthlyFinancialSummary(selectedYear);

  // Totais do Ano
  const totals = useMemo(() => {
    let recPrev = 0;
    let recReal = 0;
    let despPrev = 0;
    let despReal = 0;

    for (const m of monthsData) {
      recPrev += m.receitasPrevistas;
      recReal += m.receitasRealizadas;
      despPrev += m.despesasPrevistas;
      despReal += m.despesasRealizadas;
    }

    return {
      receitasPrevistas: recPrev,
      receitasRealizadas: recReal,
      despesasPrevistas: despPrev,
      despesasRealizadas: despReal,
      resultadoRealizado: recReal - despReal,
      resultadoPrevisto: recPrev - despPrev,
    };
  }, [monthsData]);

  // Tabela com Saldo Acumulado
  const tableData = useMemo(() => {
    let acumuladoRealizado = 0;
    return monthsData.map((m) => {
      acumuladoRealizado += m.saldoOperacionalRealizado;
      return {
        ...m,
        saldoAcumulado: acumuladoRealizado,
      };
    });
  }, [monthsData]);

  // Dados para gráficos
  const chartBarData = useMemo(() => {
    return monthsData.map((m) => ({
      name: m.monthLabel.substring(0, 3),
      "Entradas Realizadas": m.receitasRealizadas,
      "Saídas Realizadas": m.despesasRealizadas,
      "Entradas Previstas": m.receitasPrevistas,
      "Saídas Previstas": m.despesasPrevistas,
    }));
  }, [monthsData]);

  const chartAccumulatedData = useMemo(() => {
    return tableData.map((m) => ({
      name: m.monthLabel.substring(0, 3),
      "Resultado do Mês": m.saldoOperacionalRealizado,
      "Saldo Acumulado": m.saldoAcumulado,
    }));
  }, [tableData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Topo */}
      <PageHeader
        title="Visão Mensal & Anual"
        description="Comparativo de receitas, despesas e evolução do fluxo de caixa mês a mês"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSelectedYear((y) => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm font-semibold">{selectedYear}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSelectedYear((y) => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(Number(val))}
            >
              <SelectTrigger className="w-[110px] text-xs font-medium">
                <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {[
                  currentYear - 2,
                  currentYear - 1,
                  currentYear,
                  currentYear + 1,
                  currentYear + 2,
                ].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Cards de Resumo Anual */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <FinanceiroStatCard
            title="Receitas Realizadas"
            value={totals.receitasRealizadas}
            variant="success"
            iconType="receita"
            subtitle={`Previsto: ${formatCurrency(totals.receitasPrevistas)}`}
          />

          <FinanceiroStatCard
            title="Despesas Realizadas"
            value={totals.despesasRealizadas}
            variant="danger"
            iconType="despesa"
            subtitle={`Previsto: ${formatCurrency(totals.despesasPrevistas)}`}
          />

          <FinanceiroStatCard
            title="Resultado Anual"
            value={totals.resultadoRealizado}
            variant={totals.resultadoRealizado >= 0 ? "success" : "danger"}
            iconType="saldo"
            subtitle="Receitas - Despesas Realizadas"
          />

          <FinanceiroStatCard
            title="Resultado Previsto"
            value={totals.resultadoPrevisto}
            variant={totals.resultadoPrevisto >= 0 ? "info" : "warning"}
            iconType="previsto"
            subtitle="Volume total orçado do ano"
          />

          <FinanceiroStatCard
            title="Atingimento de Receita"
            value={
              totals.receitasPrevistas > 0
                ? `${((totals.receitasRealizadas / totals.receitasPrevistas) * 100).toFixed(1)}%`
                : "—"
            }
            variant="default"
            iconType="moeda"
            subtitle="Realizado vs Orçado"
          />
        </div>
      )}

      {/* Gráficos Comparativos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico 1: Entradas x Saídas por mês */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Entradas x Saídas ({selectedYear})
            </CardTitle>
            <CardDescription>Comparativo mensal de valores realizados</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                    }
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0), ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar
                    dataKey="Entradas Realizadas"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Saídas Realizadas"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Evolução do Saldo Acumulado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Evolução do Saldo Acumulado</CardTitle>
            <CardDescription>
              Curva de lucratividade e caixa acumulado ao longo dos meses
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartAccumulatedData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                    }
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0), ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Area
                    type="monotone"
                    dataKey="Saldo Acumulado"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSaldo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Comparativa Mensal (Janeiro a Dezembro) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Tabela Comparativa Anual ({selectedYear})
          </CardTitle>
          <CardDescription>
            Detalhamento numérico mensal de entradas, saídas e resultado operacional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Mês</TableHead>
                  <TableHead className="text-right text-emerald-600 dark:text-emerald-400">
                    Entradas Previstas
                  </TableHead>
                  <TableHead className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    Entradas Realizadas
                  </TableHead>
                  <TableHead className="text-right text-rose-600 dark:text-rose-400">
                    Saídas Previstas
                  </TableHead>
                  <TableHead className="text-right font-semibold text-rose-600 dark:text-rose-400">
                    Saídas Realizadas
                  </TableHead>
                  <TableHead className="text-right font-semibold">Resultado do Mês</TableHead>
                  <TableHead className="text-right font-bold">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <>
                    {tableData.map((row) => (
                      <TableRow key={row.month} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">
                          {row.monthLabel}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatCurrency(row.receitasPrevistas)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(row.receitasRealizadas)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatCurrency(row.despesasPrevistas)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-rose-600 dark:text-rose-400">
                          {formatCurrency(row.despesasRealizadas)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            row.saldoOperacionalRealizado >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(row.saldoOperacionalRealizado)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            row.saldoAcumulado >= 0
                              ? "text-foreground"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(row.saldoAcumulado)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Linha de Totais Anuais */}
                    <TableRow className="border-t-2 border-border bg-muted/20 font-bold">
                      <TableCell className="text-foreground">TOTAL DO ANO</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatCurrency(totals.receitasPrevistas)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totals.receitasRealizadas)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatCurrency(totals.despesasPrevistas)}
                      </TableCell>
                      <TableCell className="text-right text-rose-600 dark:text-rose-400">
                        {formatCurrency(totals.despesasRealizadas)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          totals.resultadoRealizado >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatCurrency(totals.resultadoRealizado)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          totals.resultadoRealizado >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatCurrency(totals.resultadoRealizado)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
