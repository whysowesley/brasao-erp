import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, CircleDollarSign, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SalesWeeklyProjectionModule } from "@/components/vendas/SalesWeeklyProjectionModule";
import { LancarVendaDialog } from "@/components/vendas/LancarVendaDialog";
import { getCurrentMonthKey, getMonthLabel, getTodayDateString, useDailySales } from "@/lib/vendas";
import { useCanWrite } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/vendas-projecao")({
  head: () => ({
    meta: [
      { title: "Projeção & Médias de Vendas | Galeteria Brasão" },
      {
        name: "description",
        content:
          "Projeção inteligente de vendas por semana e peso médio diário, visão em tabela, calendário do mês e controle de feriados/atipicidades.",
      },
    ],
  }),
  component: VendasProjecaoPage,
});

function VendasProjecaoPage() {
  const canWrite = useCanWrite();
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Dialog de lançamento de vendas
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingDate, setEditingDate] = useState<string>(getTodayDateString());

  // Consulta de vendas do mês selecionado (tempo real com Firestore)
  const { data: records = [] } = useDailySales(selectedMonth);

  const monthLabel = useMemo(() => getMonthLabel(selectedMonth), [selectedMonth]);

  // Navegação de mês
  function handlePrevMonth() {
    const [year = "", month = ""] = selectedMonth.split("-");
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) return;
    if (m === 1) {
      setSelectedMonth(`${y - 1}-12`);
    } else {
      setSelectedMonth(`${y}-${String(m - 1).padStart(2, "0")}`);
    }
  }

  function handleNextMonth() {
    const [year = "", month = ""] = selectedMonth.split("-");
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) return;
    if (m === 12) {
      setSelectedMonth(`${y + 1}-01`);
    } else {
      setSelectedMonth(`${y}-${String(m + 1).padStart(2, "0")}`);
    }
  }

  function handleCurrentMonth() {
    setSelectedMonth(currentMonthKey);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER DA PÁGINA */}
      <PageHeader
        title="Projeção & Médias Diárias"
        description="Análise semanal de faturamento, pesos médios por dia da semana e projeção em tempo real com suporte a feriados."
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
                {monthLabel}
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

              {/* Link para o módulo de Canais */}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 text-xs font-medium gap-1.5"
              >
                <Link to="/vendas">
                  <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Vendas por Canal</span>
                  <span className="sm:hidden">Canais</span>
                </Link>
              </Button>

              {canWrite && (
                <Button
                  onClick={() => {
                    setEditingDate(getTodayDateString());
                    setDialogOpen(true);
                  }}
                  className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Lançar Vendas</span>
                </Button>
              )}
            </div>
          </div>
        }
      />

      {/* MÓDULO DE PROJEÇÃO E ANÁLISE POR SEMANA & DIA */}
      <SalesWeeklyProjectionModule
        salesRecords={records}
        monthKey={selectedMonth}
        onOpenSaleEntry={(date) => {
          setEditingDate(date);
          setDialogOpen(true);
        }}
        canWrite={canWrite}
      />

      {/* DIALOG DE LANÇAMENTO DE VENDAS */}
      <LancarVendaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={editingDate}
        existingRecords={records}
      />
    </div>
  );
}
