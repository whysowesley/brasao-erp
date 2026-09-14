import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Filter,
  MessageSquare,
  Plus,
  Trash2,
  User,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { IncidentStatus, SalesIncident } from "@/lib/vendas-types";
import { useDeleteSalesIncident, useSalesIncidents, useUpdateIncidentStatus } from "@/lib/vendas";
import { SalesIncidentDialog } from "./SalesIncidentDialog";

interface SalesIncidentsListProps {
  initialDateFilter?: string;
  onSelectDate?: (date: string) => void;
}

export function SalesIncidentsList({ initialDateFilter, onSelectDate }: SalesIncidentsListProps) {
  const [dateFilter, setDateFilter] = useState<string>(initialDateFilter || "");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [onlyMeeting, setOnlyMeeting] = useState<boolean>(false);

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingIncident, setEditingIncident] = useState<SalesIncident | null>(null);
  const [incidentToDelete, setIncidentToDelete] = useState<SalesIncident | null>(null);

  const incidentsQuery = useSalesIncidents(dateFilter || undefined);
  const deleteMutation = useDeleteSalesIncident();
  const updateStatusMutation = useUpdateIncidentStatus();

  const incidents = incidentsQuery.data || [];

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== "todos" && inc.status !== statusFilter) return false;
    if (onlyMeeting && !inc.to_meeting) return false;
    return true;
  });

  const totalCount = incidents.length;
  const pendingCount = incidents.filter((i) => i.status === "pendente").length;
  const inProgressCount = incidents.filter((i) => i.status === "em_andamento").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolvido").length;
  const meetingCount = incidents.filter((i) => i.to_meeting).length;

  async function handleToggleResolve(inc: SalesIncident) {
    const newStatus: IncidentStatus = inc.status === "resolvido" ? "pendente" : "resolvido";
    try {
      await updateStatusMutation.mutateAsync({
        id: inc.id,
        status: newStatus,
      });
      toast.success(
        newStatus === "resolvido"
          ? "Intercorrência marcada como resolvida!"
          : "Intercorrência reaberta como pendente.",
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status.");
    }
  }

  async function confirmDelete() {
    if (!incidentToDelete) return;
    try {
      await deleteMutation.mutateAsync(incidentToDelete.id);
      toast.success("Intercorrência removida.");
      setIncidentToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir intercorrência.");
    }
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS & AÇÕES */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick summary badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={statusFilter === "todos" ? "default" : "outline"}
                className="cursor-pointer text-xs py-1"
                onClick={() => setStatusFilter("todos")}
              >
                Todas ({totalCount})
              </Badge>
              <Badge
                variant={statusFilter === "pendente" ? "default" : "outline"}
                className={`cursor-pointer text-xs py-1 ${
                  statusFilter === "pendente"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "text-rose-600 border-rose-200"
                }`}
                onClick={() => setStatusFilter("pendente")}
              >
                Pendentes ({pendingCount})
              </Badge>
              <Badge
                variant={statusFilter === "em_andamento" ? "default" : "outline"}
                className={`cursor-pointer text-xs py-1 ${
                  statusFilter === "em_andamento"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "text-amber-600 border-amber-200"
                }`}
                onClick={() => setStatusFilter("em_andamento")}
              >
                Em Andamento ({inProgressCount})
              </Badge>
              <Badge
                variant={statusFilter === "resolvido" ? "default" : "outline"}
                className={`cursor-pointer text-xs py-1 ${
                  statusFilter === "resolvido"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-emerald-600 border-emerald-200"
                }`}
                onClick={() => setStatusFilter("resolvido")}
              >
                Resolvidas ({resolvedCount})
              </Badge>
              <Badge
                variant={onlyMeeting ? "default" : "outline"}
                className={`cursor-pointer text-xs py-1 ${
                  onlyMeeting
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "text-indigo-600 border-indigo-200"
                }`}
                onClick={() => setOnlyMeeting((prev) => !prev)}
              >
                📌 Pautas de Reunião ({meetingCount})
              </Badge>
            </div>

            {/* Date filter & New button */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Filtrar Data:
                </span>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-8 text-xs w-36"
                />
                {dateFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateFilter("")}
                    className="h-8 text-[11px] px-2 text-muted-foreground"
                  >
                    Limpar
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setEditingIncident(null);
                  setDialogOpen(true);
                }}
                className="h-8 text-xs gap-1.5 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Intercorrência
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE INTERCORRÊNCIAS */}
      {incidentsQuery.isLoading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">
          Carregando intercorrências e histórico de faturamento...
        </Card>
      ) : filteredIncidents.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="py-12 text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Nenhuma intercorrência encontrada
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {dateFilter
                ? `Não há intercorrências registradas para ${dateFilter.split("-").reverse().join("/")}.`
                : "Tudo rodando tranquilamente! Clique em 'Nova Intercorrência' caso precise registrar imprevistos ou contatos de faturamento."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingIncident(null);
                setDialogOpen(true);
              }}
              className="mt-2 text-xs"
            >
              Registrar Ocorrência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((inc) => {
            const [y, m, d] = inc.date.split("-");
            const formattedDate = `${d}/${m}/${y}`;
            const isResolved = inc.status === "resolvido";
            const isInProgress = inc.status === "em_andamento";

            return (
              <Card
                key={inc.id}
                className={`border-border/80 shadow-xs transition-all ${
                  isResolved
                    ? "opacity-80 hover:opacity-100 border-l-4 border-l-emerald-500"
                    : isInProgress
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-rose-500"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {/* Top line: Date + Category + Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectDate?.(inc.date)}
                        className="h-7 px-2 font-mono text-xs font-bold text-foreground hover:text-primary gap-1"
                        title="Ver análise deste dia"
                      >
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{formattedDate}</span>
                      </Button>

                      <Badge variant="outline" className="text-xs font-semibold">
                        {inc.category}
                      </Badge>

                      {inc.to_meeting && (
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-bold">
                          📌 Pauta de Reunião
                        </Badge>
                      )}

                      {isResolved ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Resolvido
                        </Badge>
                      ) : isInProgress ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Em Andamento
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pendente
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant={isResolved ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggleResolve(inc)}
                        className="h-7 text-xs gap-1 px-2.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isResolved ? "Reabrir" : "Concluir"}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingIncident(inc);
                          setDialogOpen(true);
                        }}
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => setIncidentToDelete(inc)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Body: Intercorrência & Ação Tomada */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1 bg-muted/40 p-2.5 rounded-md border border-border/60">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span>Intercorrência:</span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {inc.incident}
                      </p>
                    </div>

                    <div className="space-y-1 bg-muted/40 p-2.5 rounded-md border border-border/60">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Ação Tomada:</span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {inc.action_taken}
                      </p>
                    </div>
                  </div>

                  {/* Retorno / Solução se houver */}
                  {inc.resolution_notes && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                      <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1 mb-0.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Retorno / Solução Histórica:</span>
                      </div>
                      <p className="text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap leading-relaxed">
                        {inc.resolution_notes}
                      </p>
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Registrado por: <b>{inc.user_name}</b>
                    </span>
                    {inc.resolved_at && (
                      <span className="text-emerald-600 font-medium">
                        Resolvido em: {inc.resolved_at.split("-").reverse().join("/")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DIALOG DE EDITAR / CRIAR */}
      <SalesIncidentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={dateFilter || undefined}
        incidentToEdit={editingIncident}
      />

      {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog
        open={Boolean(incidentToDelete)}
        onOpenChange={(open) => !open && setIncidentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Remover esta intercorrência?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tem certeza que deseja apagar o registro de intercorrência do dia{" "}
              <b>
                {incidentToDelete?.date ? incidentToDelete.date.split("-").reverse().join("/") : ""}
              </b>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
