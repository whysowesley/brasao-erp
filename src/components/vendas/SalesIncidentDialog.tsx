import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  MessageSquare,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  INCIDENT_CATEGORIES,
  type IncidentCategory,
  type IncidentStatus,
  type SalesIncident,
} from "@/lib/vendas-types";
import { getTodayDateString, useSaveSalesIncident } from "@/lib/vendas";

interface SalesIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  incidentToEdit?: SalesIncident | null;
  onSaved?: () => void;
}

export function SalesIncidentDialog({
  open,
  onOpenChange,
  initialDate,
  incidentToEdit,
  onSaved,
}: SalesIncidentDialogProps) {
  const { user } = useAuth();
  const saveMutation = useSaveSalesIncident();

  const [date, setDate] = useState<string>(initialDate || getTodayDateString());
  const [category, setCategory] = useState<string>(INCIDENT_CATEGORIES[0]);
  const [incident, setIncident] = useState<string>("");
  const [actionTaken, setActionTaken] = useState<string>("");
  const [toMeeting, setToMeeting] = useState<boolean>(false);
  const [status, setStatus] = useState<IncidentStatus>("pendente");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (incidentToEdit) {
        setDate(incidentToEdit.date);
        setCategory(incidentToEdit.category || INCIDENT_CATEGORIES[0]);
        setIncident(incidentToEdit.incident || "");
        setActionTaken(incidentToEdit.action_taken || "");
        setToMeeting(Boolean(incidentToEdit.to_meeting));
        setStatus(incidentToEdit.status || "pendente");
        setResolutionNotes(incidentToEdit.resolution_notes || "");
      } else {
        setDate(initialDate || getTodayDateString());
        setCategory(INCIDENT_CATEGORIES[0]);
        setIncident("");
        setActionTaken("");
        setToMeeting(false);
        setStatus("pendente");
        setResolutionNotes("");
      }
    }
  }, [open, incidentToEdit, initialDate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!date) {
      toast.error("Por favor, selecione a data do ocorrido.");
      return;
    }

    if (!incident.trim()) {
      toast.error("Informe qual foi a intercorrência ocorrida.");
      return;
    }

    if (!actionTaken.trim()) {
      toast.error("Informe a ação tomada pela equipe.");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        id: incidentToEdit?.id,
        date,
        category,
        incident,
        action_taken: actionTaken,
        to_meeting: toMeeting,
        status,
        resolution_notes: resolutionNotes,
        user_id: user?.uid || null,
        user_name: user?.displayName || user?.email?.split("@")[0] || "Operador",
      });

      toast.success(
        incidentToEdit
          ? "Intercorrência atualizada com sucesso!"
          : "Intercorrência registrada com sucesso!",
      );
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error("Erro ao salvar intercorrência:", err);
      toast.error("Erro ao salvar intercorrência no banco de dados.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSave} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {incidentToEdit
                    ? "Editar Intercorrência / Contato"
                    : "Registrar Intercorrência / Contato"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Registre imprevistos, problemas de entrega, contatos de faturamento e ações
                  tomadas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* DATA */}
            <div className="space-y-1.5">
              <Label
                htmlFor="incident-date"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Data do Ocorrido
              </Label>
              <Input
                id="incident-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* CATEGORIA */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoria da Intercorrência</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DESCRIÇÃO DA INTERCORRÊNCIA */}
          <div className="space-y-1.5">
            <Label
              htmlFor="incident-desc"
              className="text-xs font-semibold flex items-center justify-between"
            >
              <span>Qual foi a intercorrência? *</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                O que aconteceu no dia
              </span>
            </Label>
            <Textarea
              id="incident-desc"
              rows={3}
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              placeholder="Ex: Chuva torrencial a partir das 19h derrubou entregas do iFood; aplicativo ficou 45min instável e faltou entregador próprio..."
              className="text-xs resize-none"
              required
            />
          </div>

          {/* AÇÃO TOMADA */}
          <div className="space-y-1.5">
            <Label
              htmlFor="action-taken"
              className="text-xs font-semibold flex items-center justify-between"
            >
              <span>Ação tomada pela equipe *</span>
              <span className="text-[11px] font-normal text-muted-foreground">Medida imediata</span>
            </Label>
            <Textarea
              id="action-taken"
              rows={2}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Ex: Abrimos raio de entrega emergencial no Anota Aí, acionamos mais 2 motoboys parceiros e avisamos clientes com pedido pendente."
              className="text-xs resize-none"
              required
            />
          </div>

          {/* CONTROLE DE PAUTA DE REUNIÃO & STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg border border-border/70 bg-muted/30">
            {/* PAUTA DE REUNIÃO */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="to-meeting" className="text-xs font-semibold cursor-pointer">
                  Levar como Pauta de Reunião?
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Destacar para discussão com diretoria e equipe
                </p>
              </div>
              <Switch id="to-meeting" checked={toMeeting} onCheckedChange={setToMeeting} />
            </div>

            {/* STATUS */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status de Resolução</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as IncidentStatus)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente" className="text-xs">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-rose-500" />
                      Pendente (Aguardando Retorno)
                    </span>
                  </SelectItem>
                  <SelectItem value="em_andamento" className="text-xs">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      Em Andamento (Em Tratativa)
                    </span>
                  </SelectItem>
                  <SelectItem value="resolvido" className="text-xs">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Resolvido (Finalizado)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* RETORNO / HISTÓRICO DE RESOLUÇÃO */}
          <div className="space-y-1.5">
            <Label
              htmlFor="resolution-notes"
              className="text-xs font-semibold flex items-center justify-between"
            >
              <span>Retorno sobre o ocorrido / Solução definitiva</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                Histórico
              </Badge>
            </Label>
            <Textarea
              id="resolution-notes"
              rows={2}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Ex: Suporte do iFood reembolsou as taxas canceladas; ajustamos a escala de motoqueiros reserva para sextas-feiras."
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saveMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{incidentToEdit ? "Salvar Alterações" : "Registrar Intercorrência"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
