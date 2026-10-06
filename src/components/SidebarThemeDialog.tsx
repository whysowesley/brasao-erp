import { useState } from "react";
import { Palette, Check, Sparkles, LayoutDashboard, Layers, FileText } from "lucide-react";
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
import { SIDEBAR_THEMES, useSidebarTheme, createCustomSidebarTheme } from "@/lib/theme-manager";

interface SidebarThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SidebarThemeDialog({ open, onOpenChange }: SidebarThemeDialogProps) {
  const { themeId, customHex, customTextColor, setTheme } = useSidebarTheme();

  const [selectedTheme, setSelectedTheme] = useState(themeId);
  const [selectedHex, setSelectedHex] = useState(customHex);
  const [selectedText, setSelectedText] = useState<"black" | "white">(customTextColor);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedTheme(themeId);
      setSelectedHex(customHex);
      setSelectedText(customTextColor);
    }
    onOpenChange(isOpen);
  };

  const previewConfig =
    selectedTheme === "custom"
      ? createCustomSidebarTheme(selectedHex, selectedText)
      : SIDEBAR_THEMES[selectedTheme] || SIDEBAR_THEMES["vinho"];

  const handleApply = async () => {
    setSaving(true);
    try {
      await setTheme(
        selectedTheme,
        selectedTheme === "custom" ? selectedHex : undefined,
        selectedTheme === "custom" ? selectedText : undefined,
      );
      toast.success(`Tema do menu lateral alterado para "${previewConfig.name}" com sucesso!`);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar tema do menu lateral.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Personalizar Cor do Menu Lateral (Barra Esquerda)
          </DialogTitle>
          <DialogDescription>
            Personalize a cor de fundo e o texto do menu lateral de navegação.
          </DialogDescription>
        </DialogHeader>

        {/* Pré-visualização ao vivo do Menu Lateral */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Pré-visualização do Menu Lateral
          </Label>
          <div
            className="rounded-xl border p-3.5 space-y-2 transition-all shadow-inner"
            style={{
              backgroundColor: previewConfig.sidebar,
              borderColor: previewConfig.sidebarBorder,
              color: previewConfig.sidebarForeground,
            }}
          >
            <div
              className="flex items-center justify-between pb-2 border-b"
              style={{ borderColor: previewConfig.sidebarBorder }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: previewConfig.sidebarPrimary,
                    color: previewConfig.sidebarPrimaryForeground,
                  }}
                >
                  B
                </div>
                <div>
                  <p
                    className="text-xs font-bold leading-tight"
                    style={{ color: previewConfig.sidebarForeground }}
                  >
                    Galeteria Brasão
                  </p>
                  <p
                    className="text-[10px] opacity-75 leading-none"
                    style={{ color: previewConfig.sidebarForeground }}
                  >
                    Gestão &amp; ERP
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{
                  borderColor: previewConfig.sidebarBorder,
                  color: previewConfig.sidebarForeground,
                }}
              >
                {previewConfig.name}
              </Badge>
            </div>

            <div className="space-y-1 pt-1">
              <div
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer"
                style={{
                  backgroundColor: previewConfig.sidebarAccent,
                  color: previewConfig.sidebarAccentForeground,
                }}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Dashboard / Início</span>
                <span className="ml-auto text-[10px] opacity-70">Ativo</span>
              </div>

              <div
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium opacity-85 hover:opacity-100"
                style={{ color: previewConfig.sidebarForeground }}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>Estoque &amp; Produtos</span>
              </div>

              <div
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium opacity-85 hover:opacity-100"
                style={{ color: previewConfig.sidebarForeground }}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Contas a Pagar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grade de Temas Prontos */}
        <div className="space-y-2 pt-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Temas Prontos Selecionáveis
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(SIDEBAR_THEMES).map((thm) => {
              const isSelected = selectedTheme === thm.id;
              return (
                <button
                  key={thm.id}
                  type="button"
                  onClick={() => setSelectedTheme(thm.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary font-semibold"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <div
                    className="h-8 w-8 rounded-lg shrink-0 shadow-sm border border-black/15 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: thm.previewBg, color: thm.previewText }}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4" style={{ color: thm.previewText }} />
                    ) : (
                      <span className="text-[10px] font-bold">Aa</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground leading-tight truncate">
                        {thm.name}
                      </p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                        {thm.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {thm.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Opção Personalizada Livre */}
        <div className="rounded-lg border border-border p-3 space-y-2.5 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="sidebarThemeSelect"
                checked={selectedTheme === "custom"}
                onChange={() => setSelectedTheme("custom")}
                className="accent-primary"
              />
              Cor Livre Personalizada
            </Label>
            <Badge variant="outline" className="text-[10px]">
              Custom
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
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
                placeholder="#E5C158"
                className="h-9 font-mono text-xs uppercase"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground shrink-0">Cor do Texto:</Label>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border border-input">
                <Button
                  type="button"
                  variant={selectedText === "black" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setSelectedText("black");
                    setSelectedTheme("custom");
                  }}
                >
                  Preto
                </Button>
                <Button
                  type="button"
                  variant={selectedText === "white" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setSelectedText("white");
                    setSelectedTheme("custom");
                  }}
                >
                  Branco
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            Aplica instantaneamente em todo o painel
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply} disabled={saving}>
              {saving ? "Salvando..." : "Aplicar no Menu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
