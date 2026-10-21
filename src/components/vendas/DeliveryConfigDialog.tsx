import { useState, useEffect } from "react";
import { Settings, Save, AlertCircle, Sparkles, Bike, Truck, RotateCcw } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDeliveryConfig, useSaveDeliveryConfig } from "@/lib/delivery";
import { DEFAULT_DELIVERY_CONFIG, type DeliveryConfig } from "@/lib/delivery-types";
import { useAuth } from "@/lib/auth";

interface DeliveryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryConfigDialog({ open, onOpenChange }: DeliveryConfigDialogProps) {
  const { data: currentConfig = DEFAULT_DELIVERY_CONFIG } = useDeliveryConfig();
  const saveMutation = useSaveDeliveryConfig();
  const { profile } = useAuth();

  const [formConfig, setFormConfig] = useState<DeliveryConfig>(currentConfig);

  useEffect(() => {
    if (open) {
      setFormConfig(currentConfig);
    }
  }, [open, currentConfig]);

  const handleResetDefaults = () => {
    setFormConfig(DEFAULT_DELIVERY_CONFIG);
    toast.info("Valores padrão restaurados no formulário. Clique em Salvar para confirmar.");
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        config: formConfig,
        userName: profile?.fullName || "Administrador",
      });
      toast.success("Configurações de delivery salvas com sucesso!");
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar configurações.";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Configurações & Parâmetros de Delivery
              </DialogTitle>
              <DialogDescription className="text-xs">
                Defina os valores padrão das entregas próprias e os limites de criticidade (Ótimo,
                Normal, Crítico) para cada modalidade.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Seção 1: Parâmetros Base de Entregas Próprias */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-semibold text-foreground">
                Parâmetros Padrão: Entregas Próprias
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-semibold">Valor Fixo por Corrida (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.10"
                    min="0"
                    className="pl-9 h-9 text-sm font-medium"
                    value={formConfig.propria_taxa_por_corrida}
                    onChange={(e) =>
                      setFormConfig((prev) => ({
                        ...prev,
                        propria_taxa_por_corrida: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Multiplicador padrão por corrida (ex: R$ 3,50).
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-semibold">Diária Fixa Padrão (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="1.00"
                    min="0"
                    className="pl-9 h-9 text-sm font-medium"
                    value={formConfig.propria_diaria_padrao}
                    onChange={(e) =>
                      setFormConfig((prev) => ({
                        ...prev,
                        propria_diaria_padrao: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Diária fixa paga ao motoboy por dia trabalhado (ex: R$ 50,00).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">Fórmula da Própria:</span> (Qtd Corridas × R${" "}
              {formConfig.propria_taxa_por_corrida.toFixed(2)}) + R${" "}
              {formConfig.propria_diaria_padrao.toFixed(2)} de diária.
            </div>
          </div>

          {/* Seção 2: Faixas de Criticidade Próprias */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                  Própria
                </Badge>
                <h4 className="text-sm font-semibold text-foreground">
                  Limites de Criticidade do Custo Médio / Corrida
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Limite Máximo para &ldquo;Ótimo&rdquo; (R$)
                  </Label>
                </div>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  className="h-9 text-sm font-medium"
                  value={formConfig.propria_thresholds.otimo_max}
                  onChange={(e) =>
                    setFormConfig((prev) => ({
                      ...prev,
                      propria_thresholds: {
                        ...prev.propria_thresholds,
                        otimo_max: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Custo médio até R$ {formConfig.propria_thresholds.otimo_max.toFixed(2)} será
                  classificado como Ótimo.
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Gatilho para &ldquo;Crítico&rdquo; (R$)
                  </Label>
                </div>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  className="h-9 text-sm font-medium"
                  value={formConfig.propria_thresholds.dentro_max}
                  onChange={(e) =>
                    setFormConfig((prev) => ({
                      ...prev,
                      propria_thresholds: {
                        ...prev.propria_thresholds,
                        dentro_max: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Acima de R$ {formConfig.propria_thresholds.dentro_max.toFixed(2)} será
                  classificado como Crítico.
                </p>
              </div>
            </div>
          </div>

          {/* Seção 3: Faixas de Criticidade Gami / Terceirizadas */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-600 border-blue-500/30">
                  Gami / Terceirizada
                </Badge>
                <h4 className="text-sm font-semibold text-foreground">
                  Limites de Criticidade do Custo Médio / Corrida
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Limite Máximo para &ldquo;Ótimo&rdquo; (R$)
                  </Label>
                </div>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  className="h-9 text-sm font-medium"
                  value={formConfig.gami_thresholds.otimo_max}
                  onChange={(e) =>
                    setFormConfig((prev) => ({
                      ...prev,
                      gami_thresholds: {
                        ...prev.gami_thresholds,
                        otimo_max: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Custo médio Gami até R$ {formConfig.gami_thresholds.otimo_max.toFixed(2)} será
                  classificado como Ótimo.
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Gatilho para &ldquo;Crítico&rdquo; (R$)
                  </Label>
                </div>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  className="h-9 text-sm font-medium"
                  value={formConfig.gami_thresholds.dentro_max}
                  onChange={(e) =>
                    setFormConfig((prev) => ({
                      ...prev,
                      gami_thresholds: {
                        ...prev.gami_thresholds,
                        dentro_max: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Custo médio Gami acima de R$ {formConfig.gami_thresholds.dentro_max.toFixed(2)}{" "}
                  será classificado como Crítico.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrões
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
