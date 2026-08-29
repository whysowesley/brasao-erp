import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  X,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Building2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { FinanceiroStatCard } from "@/components/financeiro/FinanceiroStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import {
  useFinancialTransactions,
  useFinancialCategories,
  useCostCenters,
  resolveTransactionStatus,
  getTransactionDisplayTitle,
  getTodayString,
} from "@/lib/financeiro";
import { useSuppliers } from "@/lib/data";
import type { FinancialTransaction, StatusTransacao, TipoTransacao } from "@/lib/financeiro-types";

export const Route = createFileRoute("/_authenticated/financeiro/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios & DRE | Brasão Financeiro" },
      {
        name: "description",
        content: "Demonstrativo de Resultado do Exercício e relatórios analíticos da Brasão.",
      },
    ],
  }),
  component: RelatoriosPage,
});

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#14b8a6",
  "#6366f1",
];

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function RelatoriosPage() {
  const today = getTodayString();
  const now = new Date();

  // Estados de Filtro
  const [periodPreset, setPeriodPreset] = useState<string>("mes_atual");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [typeFilter, setTypeFilter] = useState<string>("todas");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("todos");
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Queries
  const { data: categories = [] } = useFinancialCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: suppliers = [] } = useSuppliers();

  // Resolução de Datas pelo Preset
  const { startDate, endDate } = useMemo(() => {
    const currentNow = new Date();
    if (periodPreset === "mes_atual") {
      return {
        startDate: format(startOfMonth(currentNow), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentNow), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "mes_anterior") {
      const prev = subMonths(currentNow, 1);
      return {
        startDate: format(startOfMonth(prev), "yyyy-MM-dd"),
        endDate: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "trimestre_atual") {
      return {
        startDate: format(startOfQuarter(currentNow), "yyyy-MM-dd"),
        endDate: format(endOfQuarter(currentNow), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "ano_atual") {
      return {
        startDate: format(startOfYear(currentNow), "yyyy-MM-dd"),
        endDate: format(endOfYear(currentNow), "yyyy-MM-dd"),
      };
    }
    if (periodPreset === "custom") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [periodPreset, customStartDate, customEndDate]);

  // Consulta de Lançamentos
  const { data: transactions = [], isLoading } = useFinancialTransactions({
    type: typeFilter as TipoTransacao | "todas",
    category_id: categoryFilter,
    cost_center_id: costCenterFilter,
    supplier_id: supplierFilter,
    status: statusFilter as StatusTransacao | "todos",
    startDate,
    endDate,
  });

  // Métricas do Período
  const metrics = useMemo(() => {
    let recReal = 0;
    let recPrev = 0;
    let despReal = 0;
    let despPrev = 0;
    let totalPago = 0;
    let totalPendente = 0;

    for (const t of transactions) {
      if (t.status === "cancelado") continue;
      const isPago = t.status === "pago";
      const amt = Number(t.amount) || 0;
      const paid =
        t.paid_amount !== null && t.paid_amount !== undefined ? Number(t.paid_amount) : amt;

      if (t.type === "receita") {
        recPrev += amt;
        if (isPago) {
          recReal += paid;
          totalPago += paid;
        } else {
          totalPendente += amt;
        }
      } else {
        despPrev += amt;
        if (isPago) {
          despReal += paid;
          totalPago += paid;
        } else {
          totalPendente += amt;
        }
      }
    }

    const resultadoReal = recReal - despReal;
    const resultadoPrev = recPrev - despPrev;
    const margemReal = recReal > 0 ? (resultadoReal / recReal) * 100 : 0;

    return {
      recReal,
      recPrev,
      despReal,
      despPrev,
      resultadoReal,
      resultadoPrev,
      margemReal,
      totalPago,
      totalPendente,
    };
  }, [transactions]);

  // DRE Simplificado: Agrupamento por Categoria
  const dreData = useMemo(() => {
    const receitasPorCat: Record<string, { name: string; amount: number; paid: number }> = {};
    const despesasPorCat: Record<string, { name: string; amount: number; paid: number }> = {};

    for (const t of transactions) {
      if (t.status === "cancelado") continue;
      const catName = t.category?.name || "Sem Categoria";
      const amt = Number(t.amount) || 0;
      const paid = t.status === "pago" ? Number(t.paid_amount || amt) : 0;

      if (t.type === "receita") {
        if (!receitasPorCat[catName]) {
          receitasPorCat[catName] = { name: catName, amount: 0, paid: 0 };
        }
        receitasPorCat[catName].amount += amt;
        receitasPorCat[catName].paid += paid;
      } else {
        if (!despesasPorCat[catName]) {
          despesasPorCat[catName] = { name: catName, amount: 0, paid: 0 };
        }
        despesasPorCat[catName].amount += amt;
        despesasPorCat[catName].paid += paid;
      }
    }

    const listaReceitas = Object.values(receitasPorCat).sort((a, b) => b.paid - a.paid);
    const listaDespesas = Object.values(despesasPorCat).sort((a, b) => b.paid - a.paid);

    return {
      listaReceitas,
      listaDespesas,
    };
  }, [transactions]);

  // Gráfico de Despesas por Categoria
  const pieCategoryData = useMemo(() => {
    return dreData.listaDespesas.map((d) => ({
      name: d.name,
      value: d.paid > 0 ? d.paid : d.amount,
    }));
  }, [dreData.listaDespesas]);

  // Gráfico de Despesas por Fornecedor (Top 6)
  const supplierData = useMemo(() => {
    const suppMap: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== "despesa" || t.status === "cancelado") continue;
      const name = t.supplier?.name || t.supplier_name || "Sem Fornecedor";
      const amt = t.status === "pago" && t.paid_amount ? t.paid_amount : t.amount;
      suppMap[name] = (suppMap[name] || 0) + amt;
    }

    return Object.entries(suppMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  // Exportação Excel via XLSX
  function handleExportExcel() {
    if (transactions.length === 0) {
      toast.error("Nenhum registro para exportar com os filtros atuais.");
      return;
    }

    try {
      const rows = transactions.map((t) => ({
        Vencimento: t.due_date,
        "Data Pagamento": t.payment_date || "",
        Descrição: getTransactionDisplayTitle(t),
        Tipo: t.type === "receita" ? "Receita" : "Despesa",
        Categoria: t.category?.name || "",
        "Centro de Custo": t.cost_center?.name || "",
        Fornecedor: t.supplier?.name || t.supplier_name || "",
        "Valor Previsto": t.amount,
        "Valor Efetivo": t.paid_amount || "",
        Status: resolveTransactionStatus(t.status, t.due_date, today),
        Observações: t.notes || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Financeiro");

      const fileName = `Relatorio_Financeiro_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Planilha gerada e baixada com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao exportar planilha.";
      toast.error(msg);
    }
  }

  function clearFilters() {
    setPeriodPreset("mes_atual");
    setTypeFilter("todas");
    setCategoryFilter("todas");
    setCostCenterFilter("todos");
    setSupplierFilter("todos");
    setStatusFilter("todos");
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Topo */}
      <PageHeader
        title="Relatórios & DRE"
        description="Demonstrativo de Resultado do Exercício e relatórios analíticos de fluxo de caixa"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span>Exportar Excel (XLSX)</span>
            </Button>
          </div>
        }
      />

      {/* Filtros Analíticos */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodPreset} onValueChange={setPeriodPreset}>
              <SelectTrigger className="w-[180px] text-xs font-medium">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="trimestre_atual">Trimestre Atual</SelectItem>
                <SelectItem value="ano_atual">Ano Atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
                <SelectItem value="todos">Todo o Histórico</SelectItem>
              </SelectContent>
            </Select>

            {periodPreset === "custom" && (
              <div className="flex items-center gap-2 text-xs">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar Filtros
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-5">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Tipos (Todos)</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status (Todos)</SelectItem>
              <SelectItem value="pago">Quitados / Pagos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Categorias (Todas)</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Centros (Todos)</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Fornecedores (Todos)</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <FinanceiroStatCard
          title="Receitas Operacionais"
          value={metrics.recReal}
          variant="success"
          iconType="receita"
          subtitle={`Previsto: ${formatCurrency(metrics.recPrev)}`}
        />

        <FinanceiroStatCard
          title="Despesas Operacionais"
          value={metrics.despReal}
          variant="danger"
          iconType="despesa"
          subtitle={`Previsto: ${formatCurrency(metrics.despPrev)}`}
        />

        <FinanceiroStatCard
          title="Resultado Operacional"
          value={metrics.resultadoReal}
          variant={metrics.resultadoReal >= 0 ? "success" : "danger"}
          iconType="saldo"
          subtitle={
            metrics.recReal > 0
              ? `Margem Líquida: ${metrics.margemReal.toFixed(1)}%`
              : "Resultado no período"
          }
        />

        <FinanceiroStatCard
          title="Compromissos Pendentes"
          value={metrics.totalPendente}
          variant="warning"
          iconType="pendente"
          subtitle="A liquidar no período"
        />
      </div>

      {/* DRE Simplificado e Gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* DRE Simplificado */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">DRE Simplificado</CardTitle>
            <CardDescription>
              Demonstração do Resultado do Exercício agrupada por categorias no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bloco de Receitas */}
            <div>
              <div className="flex items-center justify-between border-b border-border bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                <span>(+) RECEITAS OPERACIONAIS BRUTAS</span>
                <span>{formatCurrency(metrics.recReal)}</span>
              </div>
              <div className="divide-y divide-border/40 text-xs">
                {dreData.listaReceitas.length === 0 ? (
                  <p className="p-3 text-muted-foreground">Nenhuma receita registrada.</p>
                ) : (
                  dreData.listaReceitas.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30"
                    >
                      <span className="text-muted-foreground">{r.name}</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(r.paid || r.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bloco de Despesas */}
            <div>
              <div className="flex items-center justify-between border-b border-border bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-800 dark:text-rose-300">
                <span>(-) CUSTOS E DESPESAS OPERACIONAIS</span>
                <span>{formatCurrency(metrics.despReal)}</span>
              </div>
              <div className="divide-y divide-border/40 text-xs">
                {dreData.listaDespesas.length === 0 ? (
                  <p className="p-3 text-muted-foreground">Nenhuma despesa registrada.</p>
                ) : (
                  dreData.listaDespesas.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30"
                    >
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(d.paid || d.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bloco de Resultado */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm font-bold shadow-sm">
              <span className="text-foreground">(=) RESULTADO OPERACIONAL LÍQUIDO</span>
              <span
                className={
                  metrics.resultadoReal >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {formatCurrency(metrics.resultadoReal)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico Despesas por Categoria */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição percentual dos gastos</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pt-2">
            <div className="h-64 w-full">
              {pieCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieCategoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      paddingAngle={2}
                    >
                      {pieCategoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [formatCurrency(Number(val) || 0), "Valor"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sem despesas para exibir.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Top Fornecedores */}
      {supplierData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Maiores Despesas por Fornecedor
            </CardTitle>
            <CardDescription>Top favorecidos em volume financeiro no período</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={supplierData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#888888"
                    fontSize={12}
                    tickFormatter={(val) =>
                      `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#888888"
                    fontSize={11}
                    width={120}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      formatCurrency(Number(val) || 0),
                      "Total Despesa",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada dos Lançamentos Filtrados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Lançamentos Detalhados</CardTitle>
            <CardDescription>
              {transactions.length} registros encontrados no período selecionado
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      Nenhum registro para o filtro aplicado.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => {
                    const status = resolveTransactionStatus(t.status, t.due_date, today);
                    const isReceita = t.type === "receita";
                    const isPago = status === "pago";

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">
                          {format(parseISO(t.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {getTransactionDisplayTitle(t)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-semibold ${
                              isReceita
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isReceita ? "Receita" : "Despesa"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.category?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.cost_center?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.supplier?.name || t.supplier_name || "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            isReceita
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isReceita ? "+ " : "- "}
                          {formatCurrency(isPago && t.paid_amount ? t.paid_amount : t.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {status === "pago" && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              {isReceita ? "Recebido" : "Pago"}
                            </Badge>
                          )}
                          {status === "pendente" && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              Pendente
                            </Badge>
                          )}
                          {status === "atrasado" && (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400">
                              Atrasado
                            </Badge>
                          )}
                          {status === "cancelado" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Cancelado
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
