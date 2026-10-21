import { useState } from "react";
import {
  History,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  User,
  Search,
  Filter,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFinancialDateMovements,
  type FinancialDateMovement,
  type FinancialMovementType,
} from "@/lib/financial-movements";
import { safeFormatDate } from "@/lib/date-utils";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
}

function formatRelativeTime(dateIso: string): string {
  if (!dateIso) return "—";
  try {
    const d = parseISO(dateIso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Agora mesmo";
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    if (diffHours < 24) return `Hoje às ${format(d, "HH:mm")}`;
    if (diffDays === 1) return `Ontem às ${format(d, "HH:mm")}`;
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateIso;
  }
}

interface FinancialMovementsHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceModule?: "contas_pagar" | "fluxo_caixa";
}

export function FinancialMovementsHistoryModal({
  open,
  onOpenChange,
  sourceModule,
}: FinancialMovementsHistoryModalProps) {
  const { data: movements = [], isLoading } = useFinancialDateMovements();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("todos");

  const filteredMovements = movements.filter((m) => {
    if (selectedType !== "todos" && m.movement_type !== selectedType) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(term);
      const matchUser = m.user_name.toLowerCase().includes(term);
      const matchSummary = m.summary.toLowerCase().includes(term);
      return matchTitle || matchUser || matchSummary;
    }
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l shadow-2xl"
      >
        {/* Cabeçalho do Sheet */}
        <SheetHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base sm:text-lg font-bold text-foreground">
                  Histórico de Movimentações
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Registro dos últimos 20 movimentos de datas e quadrantes (Contas a Pagar &amp;
                  Fluxo de Caixa).
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold bg-background shrink-0">
              {movements.length} de 20 max
            </Badge>
          </div>

          {/* Filtros rápidos e busca */}
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor, descrição ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <Button
                variant={selectedType === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("todos")}
                className="h-6 px-2 text-[11px] rounded-full"
              >
                Todos ({movements.length})
              </Button>
              <Button
                variant={selectedType === "mudanca_quadrante" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("mudanca_quadrante")}
                className="h-6 px-2 text-[11px] rounded-full"
              >
                Quadrantes
              </Button>
              <Button
                variant={selectedType === "data_postergada" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("data_postergada")}
                className="h-6 px-2 text-[11px] rounded-full"
              >
                Postergadas
              </Button>
              <Button
                variant={selectedType === "vencimento_alterado" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("vencimento_alterado")}
                className="h-6 px-2 text-[11px] rounded-full"
              >
                Vencimentos
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Lista de Movimentações */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border bg-card space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center space-y-3 max-w-sm mx-auto">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Clock className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Nenhuma movimentação encontrada
              </p>
              <p className="text-xs text-muted-foreground">
                Quando uma data postergada, vencimento ou quadrante for alterado no Contas a Pagar
                ou no Fluxo de Caixa, o registro de quem moveu aparecerá aqui em tempo real.
              </p>
            </div>
          ) : (
            filteredMovements.map((m) => {
              const isQuadrant = m.movement_type === "mudanca_quadrante";
              const isPostponed = m.movement_type === "data_postergada";
              const isDue = m.movement_type === "vencimento_alterado";

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5"
                >
                  {/* Linha 1: Badges de Tipo, Módulo e Tempo Relativo */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isQuadrant && (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-semibold gap-1">
                          <Layers className="h-3 w-3" />
                          <span>Movido de Quadrante</span>
                        </Badge>
                      )}
                      {isPostponed && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-semibold gap-1">
                          <CalendarClock className="h-3 w-3" />
                          <span>Data Postergada</span>
                        </Badge>
                      )}
                      {isDue && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-semibold gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Vencimento Alterado</span>
                        </Badge>
                      )}
                      {m.movement_type === "ambas_datas" && (
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] font-semibold gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Vencimento &amp; Previsão</span>
                        </Badge>
                      )}

                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/60 px-1.5 py-0.5 rounded">
                        {m.source_module === "contas_pagar" ? "Contas a Pagar" : "Fluxo de Caixa"}
                      </span>
                    </div>

                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatRelativeTime(m.created_at)}
                    </span>
                  </div>

                  {/* Linha 2: Fornecedor / Descrição e Valor */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-snug">{m.title}</h4>
                      {m.description && m.description !== m.title && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {m.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-foreground font-mono shrink-0">
                      {formatCurrency(m.amount)}
                    </span>
                  </div>

                  {/* Linha 3: Caixinha comparativa das datas (De -> Para) */}
                  <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1.5 border border-border/60">
                    <div className="flex items-center gap-2 text-foreground font-medium flex-wrap">
                      <span className="text-muted-foreground text-[11px]">De:</span>
                      <span className="line-through text-muted-foreground font-mono">
                        {safeFormatDate(
                          m.previous_expected_date || m.previous_due_date,
                          "dd/MM/yyyy",
                        )}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-muted-foreground text-[11px]">Para:</span>
                      <span className="font-bold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                        {safeFormatDate(m.new_expected_date || m.new_due_date, "dd/MM/yyyy")}
                      </span>
                    </div>

                    {/* Vencimento original mantido caso tenha movido apenas de quadrante/previsão */}
                    {isQuadrant && m.due_date_original && (
                      <p className="text-[10px] text-muted-foreground">
                        Data de vencimento original:{" "}
                        <span className="font-semibold text-foreground">
                          {safeFormatDate(m.due_date_original, "dd/MM/yyyy")}
                        </span>{" "}
                        (não alterada)
                      </p>
                    )}

                    <p className="text-[11px] text-foreground/80 leading-relaxed font-sans pt-0.5">
                      {m.summary}
                    </p>
                  </div>

                  {/* Linha 4: Quem realizou a ação */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{m.user_name}</span>
                      {m.user_email && m.user_email !== "sistema" && (
                        <span className="text-[10px] text-muted-foreground hidden xs:inline">
                          ({m.user_email})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {safeFormatDate(m.created_at, "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
