import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Clock,
  Trash2,
  Save,
  Tag,
  DollarSign,
  Info,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  COMMON_TAGS,
  PRESENCE_STATUSES,
  type PresenceLog,
  type PresenceStatus,
  useDeletePresenceLog,
  useSavePresenceLog,
} from "@/lib/presence";
import { useAuth } from "@/lib/auth";
import { fetchSalesForDate, formatCurrency } from "@/lib/vendas";

interface DayPresenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string | null; // YYYY-MM-DD
  existingLog?: PresenceLog;
}

export function DayPresenceDialog({
  open,
  onOpenChange,
  dateStr,
  existingLog,
}: DayPresenceDialogProps) {
  const { user } = useAuth();
  const saveMutation = useSavePresenceLog();
  const deleteMutation = useDeletePresenceLog();

  const [status, setStatus] = useState<PresenceStatus>("presente");
  const [notes, setNotes] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [shift, setShift] = useState<"integral" | "almoco" | "jantar" | "visita" | "outro">(
    "integral",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Carrega vendas do dia para dar contexto da operação
  const { data: daySales } = useQuery({
    queryKey: ["sales_for_date", dateStr],
    queryFn: () => (dateStr ? fetchSalesForDate(dateStr) : Promise.resolve([])),
    enabled: Boolean(dateStr && open),
    staleTime: 1000 * 30,
  });

  const totalSalesDay = daySales?.reduce((acc, s) => acc + (s.amount || 0), 0) ?? 0;

  useEffect(() => {
    if (existingLog) {
      setStatus(existingLog.status);
      setNotes(existingLog.notes || "");
      setCheckIn(existingLog.check_in || "");
      setCheckOut(existingLog.check_out || "");
      setShift(existingLog.shift || "integral");
      setSelectedTags(existingLog.tags || []);
    } else {
      setStatus("presente");
      setNotes("");
      setCheckIn("");
      setCheckOut("");
      setShift("integral");
      setSelectedTags([]);
    }
  }, [existingLog, dateStr, open]);

  if (!dateStr) return null;

  let parsedDate = new Date();
  try {
    parsedDate = parseISO(dateStr);
  } catch {
    // fallback
  }

  const formattedDateTitle = format(parsedDate, "EEEE, dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        date: dateStr,
        status,
        notes,
        check_in: checkIn,
        check_out: checkOut,
        shift,
        tags: selectedTags,
        user_id: user?.uid,
        user_name: user?.displayName || user?.email || "Operador",
      });
      toast.success(
        existingLog
          ? `Registro de ${format(parsedDate, "dd/MM")} atualizado com sucesso!`
          : `Presença de ${format(parsedDate, "dd/MM")} registrada com sucesso!`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar presença: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(`Deseja remover o registro de presença do dia ${format(parsedDate, "dd/MM/yyyy")}?`)
    ) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(dateStr);
      toast.success("Registro removido com sucesso!");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        "Erro ao remover registro: " + (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <CalendarCheck className="h-4 w-4" />
            <span>Controle de Presença & Operação</span>
          </div>
          <DialogTitle className="text-xl font-bold capitalize text-foreground">
            {formattedDateTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Marque se compareceu à galeteria e adicione o resumo da operação para o seu controle
            pessoal.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo de Vendas do Dia (se houver vendas cadastradas) */}
        {totalSalesDay > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-medium">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Vendas registradas neste dia:</span>
            </div>
            <div className="font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(totalSalesDay)}
            </div>
          </div>
        )}

        <div className="space-y-4 py-1">
          {/* Seletor de Status com Cores Vibrantes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Status da Presença <span className="text-rose-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(PRESENCE_STATUSES) as PresenceStatus[]).map((key) => {
                const cfg = PRESENCE_STATUSES[key];
                const isSelected = status === key;

                let borderAndBg = "border-border/70 hover:border-foreground/30 bg-card";
                if (isSelected) {
                  if (key === "presente") {
                    borderAndBg =
                      "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-200";
                  } else if (key === "ausente") {
                    borderAndBg =
                      "border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/30 dark:bg-rose-950/50 dark:text-rose-200";
                  } else if (key === "meio_periodo") {
                    borderAndBg =
                      "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-200";
                  } else if (key === "folga") {
                    borderAndBg =
                      "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/30 dark:bg-sky-950/50 dark:text-sky-200";
                  } else {
                    borderAndBg =
                      "border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-500/30 dark:bg-purple-950/50 dark:text-purple-200";
                  }
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all ${borderAndBg}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cfg.hex }}
                        />
                        <span>{cfg.shortLabel}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-current shrink-0" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                      {key === "presente" ? "Fui à galeteria" : cfg.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horários e Turno (visível especialmente para presente e meio período) */}
          {(status === "presente" || status === "meio_periodo" || status === "remoto") && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="checkIn" className="text-[11px] font-medium text-muted-foreground">
                  Horário de Chegada
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="checkIn"
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="checkOut" className="text-[11px] font-medium text-muted-foreground">
                  Horário de Saída
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="checkOut"
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="shiftSelect"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Turno / Período
                </Label>
                <select
                  id="shiftSelect"
                  value={shift}
                  onChange={(e) =>
                    setShift(
                      e.target.value as "integral" | "almoco" | "jantar" | "visita" | "outro",
                    )
                  }
                  className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="integral">Integral (Dia todo)</option>
                  <option value="almoco">Almoço</option>
                  <option value="jantar">Jantar / Noite</option>
                  <option value="visita">Visita Rápida / Conferência</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
          )}

          {/* Observações / Resumo da Operação */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notesField" className="text-xs font-semibold text-foreground">
                Observações &amp; Resumo da Operação
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {notes.length > 0 ? `${notes.length} caracteres` : "Opcional"}
              </span>
            </div>
            <Textarea
              id="notesField"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Movimento muito forte no salão; fornecedor de bebidas atrasou a entrega; equipe completa e sem faltas; conferido estoque de carne à noite..."
              rows={4}
              className="resize-none text-xs leading-relaxed"
            />
          </div>

          {/* Tags Rápidas */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              <span>Tags Rápidas da Operação</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {isSelected && <Check className="mr-1 inline-block h-3 w-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {existingLog && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="gap-1.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Registro
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Registro"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
