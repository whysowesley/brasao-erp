import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Settings,
  Calendar,
  CheckCircle2,
  DollarSign,
  Building2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { FinanceiroStatCard } from "@/components/financeiro/FinanceiroStatCard";
import { LancamentoDialog } from "@/components/financeiro/LancamentoDialog";
import { MarcarPagoDialog } from "@/components/financeiro/MarcarPagoDialog";
import { CategoriasDialog } from "@/components/financeiro/CategoriasDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useFinancialDashboard,
  useFinancialTransactions,
  useMonthlyFinancialSummary,
  getTodayString,
  resolveTransactionStatus,
  getTransactionDisplayTitle,
} from "@/lib/financeiro";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction } from "@/lib/financeiro-types";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  head: () => ({
    meta: [
      { title: "Financeiro | Galeteria Brasão" },
      {
        name: "description",
        content: "Visão geral do fluxo de caixa e desempenho financeiro da Galeteria Brasão.",
      },
    ],
  }),
  component: FinanceiroDashboardPage,
});

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function FinanceiroDashboardPage() {
  const { canWrite } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Queries
  const { summary, isLoading: loadingDashboard } = useFinancialDashboard(currentMonth, currentYear);
  const { data: transactions = [], isLoading: loadingTransactions } = useFinancialTransactions();
  const { monthsData, isLoading: loadingMonths } = useMonthlyFinancialSummary(currentYear);

  // Estados de modais
  const [openLancamento, setOpenLancamento] = useState(false);
  const [openCategorias, setOpenCategorias] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);

  const today = getTodayString();

  // Contas vencidas e a vencer
  const contasVencidas = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === "despesa" &&
          t.status !== "pago" &&
          t.status !== "cancelado" &&
          resolveTransactionStatus(t.status, t.due_date, today) === "atrasado",
      )
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [transactions, today]);

  const contasHoje = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === "despesa" &&
          t.status !== "pago" &&
          t.status !== "cancelado" &&
          t.due_date === today,
      )
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, today]);

  const proximosPagamentos = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === "despesa" &&
          t.status !== "pago" &&
          t.status !== "cancelado" &&
          t.due_date >= today,
      )
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
  }, [transactions, today]);

  // Últimos lançamentos
  const ultimosLancamentos = useMemo(() => {
    return transactions.slice(0, 8);
  }, [transactions]);

  // Dados do gráfico dos últimos 6 meses
  const chartData = useMemo(() => {
    if (!monthsData) return [];
    return monthsData.slice(Math.max(0, currentMonth - 5), currentMonth + 1).map((m) => ({
      name: m.monthLabel.substring(0, 3),
      Receitas: m.receitasRealizadas,
      Despesas: m.despesasRealizadas,
      Resultado: m.saldoOperacionalRealizado,
    }));
  }, [monthsData, currentMonth]);

  function handleOpenEdit(t: FinancialTransaction) {
    if (!canWrite) return;
    setEditingTransaction(t);
    setOpenLancamento(true);
  }

  function handleOpenPay(t: FinancialTransaction) {
    if (!canWrite) return;
    setPayingTransaction(t);
  }

  const isLoading = loadingDashboard || loadingTransactions || loadingMonths;

  return (
    <div className="space-y-6 pb-12">
      {/* Topo / Page Header */}
      <PageHeader
        title="Financeiro"
        description="Visão geral do fluxo de caixa e desempenho financeiro"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCategorias(true)}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              <span>Categorias & Cadastros</span>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to="/financeiro/relatorios">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Relatórios</span>
              </Link>
            </Button>
            {canWrite && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingTransaction(null);
                  setOpenLancamento(true);
                }}
                className="gap-1.5 bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span>+ Novo Lançamento</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Alertas Críticos (Contas Vencidas e Vencendo Hoje) */}
      {(contasVencidas.length > 0 || contasHoje.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {contasVencidas.length > 0 && (
            <div className="flex items-start justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-800 dark:text-rose-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <h4 className="text-sm font-semibold">
                    {contasVencidas.length}{" "}
                    {contasVencidas.length === 1 ? "conta vencida" : "contas vencidas"}
                  </h4>
                  <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">
                    Total em atraso:{" "}
                    <span className="font-semibold">
                      {formatCurrency(contasVencidas.reduce((acc, c) => acc + c.amount, 0))}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-300 bg-rose-50 text-xs text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
                asChild
              >
                <Link to="/financeiro/contas-pagar">Ver todas</Link>
              </Button>
            </div>
          )}

          {contasHoje.length > 0 && (
            <div className="flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="text-sm font-semibold">
                    {contasHoje.length}{" "}
                    {contasHoje.length === 1 ? "conta vence hoje" : "contas vencem hoje"}
                  </h4>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                    Total previsto para hoje:{" "}
                    <span className="font-semibold">
                      {formatCurrency(contasHoje.reduce((acc, c) => acc + c.amount, 0))}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 bg-amber-50 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                asChild
              >
                <Link to="/financeiro/contas-pagar">Ver contas</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Grid de KPIs Principais (6 Cards) */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <FinanceiroStatCard
            title="Saldo Realizado"
            value={summary?.saldoRealizado ?? 0}
            variant={(summary?.saldoRealizado ?? 0) >= 0 ? "success" : "danger"}
            iconType="saldo"
            subtitle="Em caixa e bancos"
          />

          <FinanceiroStatCard
            title="Entradas do Mês"
            value={summary?.totalMesReceitas ?? 0}
            variant="success"
            iconType="receita"
            subtitle="Receitas realizadas"
          />

          <FinanceiroStatCard
            title="Saídas do Mês"
            value={summary?.totalMesDespesas ?? 0}
            variant="danger"
            iconType="despesa"
            subtitle="Despesas realizadas"
          />

          <FinanceiroStatCard
            title="Contas a Pagar"
            value={summary?.totalDespesasPendentes ?? 0}
            variant="warning"
            iconType="pendente"
            subtitle="Compromissos pendentes"
          />

          <FinanceiroStatCard
            title="Contas Vencidas"
            value={summary?.totalContasVencidas ?? 0}
            variant={summary?.totalContasVencidas ? "danger" : "default"}
            iconType="atrasado"
            badge={
              summary?.qtdContasVencidas ? `${summary.qtdContasVencidas} pendentes` : undefined
            }
            subtitle="Atrasadas no momento"
          />

          <FinanceiroStatCard
            title="Resultado Líquido"
            value={summary?.resultadoLiquidoMes ?? 0}
            variant={(summary?.resultadoLiquidoMes ?? 0) >= 0 ? "info" : "danger"}
            iconType="moeda"
            subtitle="Receitas - Despesas (Mês)"
          />
        </div>
      )}

      {/* Gráfico de Fluxo & Próximos Pagamentos */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico Entradas x Saídas */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Fluxo Financeiro Recente</CardTitle>
              <CardDescription>Comparativo de Entradas e Saídas Realizadas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
              <Link to="/financeiro/meses">
                <span>Ver todos os meses</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
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
                    <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem dados para exibição do gráfico.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Próximos Pagamentos */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Próximos Pagamentos</CardTitle>
              <CardDescription>Contas a vencer nos próximos dias</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
              <Link to="/financeiro/contas-pagar">
                <span>Ver mais</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 pt-2">
            {proximosPagamentos.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/40" />
                <p>Nenhuma conta pendente para os próximos dias.</p>
              </div>
            ) : (
              proximosPagamentos.map((t) => {
                const isHoje = t.due_date === today;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{t.description}</p>
                        {isHoje && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                          >
                            Hoje
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.supplier?.name ||
                          t.supplier_name ||
                          t.category?.name ||
                          "Sem fornecedor"}{" "}
                        · {format(parseISO(t.due_date), "dd/MM/yyyy")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {formatCurrency(t.amount)}
                      </span>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOpenPay(t)}
                        >
                          Baixar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Últimos Lançamentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Últimos Lançamentos</CardTitle>
            <CardDescription>Movimentações financeiras registradas recentemente</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <Link to="/financeiro/lancamentos">
              <span>Ver fluxo completo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
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
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  {canWrite && <TableHead className="w-24 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimosLancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 8 : 7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Nenhum lançamento registrado no momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  ultimosLancamentos.map((t) => {
                    const status = resolveTransactionStatus(t.status, t.due_date, today);
                    const isReceita = t.type === "receita";
                    const isPago = status === "pago";

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">
                          {format(parseISO(t.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{getTransactionDisplayTitle(t)}</span>
                            {t.is_recurring && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                Recorrente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              isReceita
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isReceita ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {isReceita ? "Receita" : "Despesa"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.category?.name || "—"}
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
                            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400">
                              Pago
                            </Badge>
                          )}
                          {status === "pendente" && (
                            <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400">
                              Pendente
                            </Badge>
                          )}
                          {status === "atrasado" && (
                            <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-400">
                              Atrasado
                            </Badge>
                          )}
                          {status === "cancelado" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Cancelado
                            </Badge>
                          )}
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isPago && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  onClick={() => handleOpenPay(t)}
                                >
                                  Baixar
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleOpenEdit(t)}
                              >
                                Editar
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modais Compartilhados */}
      <LancamentoDialog
        open={openLancamento}
        onOpenChange={setOpenLancamento}
        transactionToEdit={editingTransaction}
      />

      <MarcarPagoDialog
        open={!!payingTransaction}
        onOpenChange={(open) => !open && setPayingTransaction(null)}
        transaction={payingTransaction}
      />

      <CategoriasDialog open={openCategorias} onOpenChange={setOpenCategorias} />
    </div>
  );
}
