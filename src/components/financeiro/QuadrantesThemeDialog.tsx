import { useState } from "react";
import { Palette, Check, Sparkles, CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QUADRANTE_THEMES, useQuadrantesTheme, getCustomQuadranteTheme } from "@/lib/theme-manager";

interface QuadrantesThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuadrantesThemeDialog({ open, onOpenChange }: QuadrantesThemeDialogProps) {
  const { themeId, customHex, setTheme } = useQuadrantesTheme();

  const [selectedTheme, setSelectedTheme] = useState(themeId);
  const [selectedHex, setSelectedHex] = useState(customHex);
  const [saving, setSaving] = useState(false);

  // Mantém sincronizado ao abrir
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedTheme(themeId);
      setSelectedHex(customHex);
    }
    onOpenChange(isOpen);
  };

  const activeConfig =
    selectedTheme === "custom"
      ? getCustomQuadranteTheme(selectedHex)
      : QUADRANTE_THEMES[selectedTheme] || QUADRANTE_THEMES["azul"];

  const handleApply = async () => {
    setSaving(true);
    try {
      await setTheme(selectedTheme, selectedTheme === "custom" ? selectedHex : undefined);
      toast.success(`Cor dos quadrantes alterada para "${activeConfig.name}" com sucesso!`);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar personalização de cor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Personalizar Cor dos Quadrantes
          </DialogTitle>
          <DialogDescription>
            Escolha uma cor de destaque para os cabeçalhos e molduras dos dias em Vencimentos por
            Dia.
          </DialogDescription>
        </DialogHeader>

        {/* Pré-visualização ao vivo */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Pré-visualização do Quadrante
          </Label>
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div
              style={activeConfig.headerStyle}
              className={`${activeConfig.headerBgClass} ${activeConfig.headerTextClass} px-3.5 py-2.5 flex items-center justify-between transition-colors`}
            >
              <div className="flex items-center gap-2">
                <CalendarClock className={`h-4 w-4 ${activeConfig.headerSubtextClass}`} />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
                  02 DE OUTUBRO - SEXTA-FEIRA
                </span>
                <Badge className="bg-amber-400 text-black font-bold text-[9px] uppercase border-none px-1.5 py-0">
                  Hoje
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${activeConfig.headerSubtextClass} font-medium`}>
                  R$ 1.850,00
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded ${activeConfig.headerBtnBg} font-semibold flex items-center gap-1`}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </span>
              </div>
            </div>
            <div className="p-2.5 text-xs text-muted-foreground flex justify-between bg-muted/20">
              <span>3 contas • 2 a vencer</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Pendente: R$ 850,00
              </span>
            </div>
          </div>
        </div>

        {/* Paletas Pré-definidas */}
        <div className="space-y-2 pt-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Cores Recomendadas
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(QUADRANTE_THEMES).map((thm) => {
              const isSelected = selectedTheme === thm.id;
              return (
                <button
                  key={thm.id}
                  type="button"
                  onClick={() => setSelectedTheme(thm.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary font-semibold"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full shrink-0 shadow-xs border border-black/10 flex items-center justify-center"
                    style={{ backgroundColor: thm.previewBg }}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-foreground leading-tight">{thm.name}</p>
                    <span className="text-[10px] text-muted-foreground">{thm.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cor Personalizada (Hex Livre) */}
        <div className="rounded-lg border border-border p-3 space-y-2.5 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="themeSelect"
                checked={selectedTheme === "custom"}
                onChange={() => setSelectedTheme("custom")}
                className="accent-primary"
              />
              Usar Cor Livre (Personalizada)
            </Label>
            <Badge variant="outline" className="text-[10px]">
              Seletor Livre
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedHex}
              onChange={(e) => {
                setSelectedHex(e.target.value);
                setSelectedTheme("custom");
              }}
              className="h-9 w-12 rounded cursor-pointer border border-input bg-background p-0.5"
            />
            <Input
              type="text"
              value={selectedHex}
              onChange={(e) => {
                setSelectedHex(e.target.value);
                setSelectedTheme("custom");
              }}
              placeholder="#0047AB"
              className="h-9 font-mono text-xs uppercase"
            />
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            Salvo na sua conta e aplicado instantaneamente
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply} disabled={saving}>
              {saving ? "Salvando..." : "Aplicar Cor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
