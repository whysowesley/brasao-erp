import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sliders, Check, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRules, useUpdatePurchaseRules } from "@/lib/data";
import { DEFAULT_RULES } from "@/lib/inventory";

export function PurchaseRulesCard() {
  const { data: rules, isLoading } = useRules();
  const updateMutation = useUpdatePurchaseRules();

  const [marginPercent, setMarginPercent] = useState<string>("5");
  const [coverageWeeks, setCoverageWeeks] = useState<string>("1");
  const [attentionThreshold, setAttentionThreshold] = useState<string>("20");

  useEffect(() => {
    if (rules) {
      setMarginPercent(String(rules.safety_margin_percent ?? DEFAULT_RULES.safety_margin_percent));
      setCoverageWeeks(String(rules.coverage_weeks ?? DEFAULT_RULES.coverage_weeks));
      setAttentionThreshold(
        String(rules.attention_threshold_percent ?? DEFAULT_RULES.attention_threshold_percent),
      );
    }
  }, [rules]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        safety_margin_percent: Math.max(0, Number(marginPercent) || 0),
        coverage_weeks: Math.max(1, Number(coverageWeeks) || 1),
        attention_threshold_percent: Math.max(0, Number(attentionThreshold) || 0),
      });
      toast.success("Parâmetros de compras e estoque salvos com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar parâmetros de estoque.");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Parâmetros de Compra na Margem & Estoque
            </h2>
            <p className="text-xs text-muted-foreground">
              Regras centrais do ERP para compra justa de Segunda a Segunda (8 dias).
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="margin-pct" className="text-xs font-semibold">
                Margem de Segurança (%)
              </Label>
              <span className="text-[10px] text-muted-foreground">Padrão: 5%</span>
            </div>
            <div className="relative">
              <Input
                id="margin-pct"
                inputMode="decimal"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="num h-9 text-right pr-7 font-medium"
                placeholder="5"
                disabled={isLoading}
              />
              <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">
                %
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Colchão sobre o consumo para chegar na próxima segunda-feira próximo do zero.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cov-weeks" className="text-xs font-semibold">
                Cobertura do Ciclo (Semanas)
              </Label>
              <span className="text-[10px] text-muted-foreground">Padrão: 1</span>
            </div>
            <div className="relative">
              <Input
                id="cov-weeks"
                inputMode="decimal"
                value={coverageWeeks}
                onChange={(e) => setCoverageWeeks(e.target.value)}
                className="num h-9 text-right pr-14 font-medium"
                placeholder="1"
                disabled={isLoading}
              />
              <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">
                sem.
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Giro padrão para perecíveis (1 semana = dura até a entrega da próxima segunda).
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="att-thresh" className="text-xs font-semibold">
                Limiar de Atenção (%)
              </Label>
              <span className="text-[10px] text-muted-foreground">Padrão: 20%</span>
            </div>
            <div className="relative">
              <Input
                id="att-thresh"
                inputMode="decimal"
                value={attentionThreshold}
                onChange={(e) => setAttentionThreshold(e.target.value)}
                className="num h-9 text-right pr-7 font-medium"
                placeholder="20"
                disabled={isLoading}
              />
              <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">
                %
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Percentual acima do estoque mínimo que ativa a etiqueta amarela de atenção.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span>Como o cálculo opera na prática:</span>
          </div>
          <ul className="space-y-1 list-disc list-inside leading-relaxed">
            <li>
              <strong className="text-foreground">Compra estritamente na margem:</strong> Se o giro
              semanal da maminha for 80 kg e o estoque atual for 20 kg, a sugestão comprará a
              diferença exata para durar até a 2ª feira e chegar na entrega com a margem desejada
              (ex.: 5% ou 5 kg, bem próximo de 0 kg).
            </li>
            <li>
              <strong className="text-foreground">Pós-Operação:</strong> O consumo de hoje já é dado
              como realizado e o estoque informado já é o físico apurado. O cálculo abastece da
              terça-feira em diante (7 dias), reduzindo a demanda e fazendo a sugestão recair.
            </li>
            <li>
              <strong className="text-foreground">Pré-Operação:</strong> O consumo de hoje ainda vai
              ocorrer, suprindo o ciclo completo de 8 dias (Segunda a Segunda 2).
            </li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={updateMutation.isPending || isLoading}
            className="gap-1.5 font-medium"
          >
            <Check className="h-4 w-4" />
            {updateMutation.isPending ? "Salvando..." : "Salvar Parâmetros"}
          </Button>
        </div>
      </form>
    </section>
  );
}
