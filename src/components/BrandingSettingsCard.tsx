import { useState, useRef } from "react";
import {
  Upload,
  RotateCcw,
  Check,
  Sparkles,
  Image as ImageIcon,
  AlertCircle,
  Palette,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrasaoLogo } from "@/components/BrasaoLogo";
import { SidebarThemeDialog } from "@/components/SidebarThemeDialog";
import { QuadrantesThemeDialog } from "@/components/financeiro/QuadrantesThemeDialog";
import { useSidebarTheme, useQuadrantesTheme } from "@/lib/theme-manager";
import {
  useBranding,
  uploadBrandingLogo,
  saveBrandingSettings,
  resetBrandingToDefault,
  DEFAULT_BRANDING,
} from "@/lib/branding";
import { useAuth } from "@/lib/auth";

export function BrandingSettingsCard() {
  const { branding, loading: brandingLoading } = useBranding();
  const { profile: userProfile, isMaster, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(branding.companyName);
  const [subtitle, setSubtitle] = useState(branding.subtitle);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [openSidebarDialog, setOpenSidebarDialog] = useState(false);
  const [openQuadranteDialog, setOpenQuadranteDialog] = useState(false);
  const { themeConfig: sidebarTheme } = useSidebarTheme();
  const { themeConfig: quadranteTheme } = useQuadrantesTheme();

  // Permissão: master ou editor podem alterar branding
  const canEdit = isMaster || role === "editor";

  // Quando o branding carrega do Firebase, sincroniza inputs caso não tenham sido alterados
  const currentLogo = previewUrl || branding.logoUrl || DEFAULT_BRANDING.logoUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de formato
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).");
      return;
    }

    // Validação de tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUploadLogo = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const userName = userProfile?.fullName || userProfile?.email || "Administrador";
      const uploadedUrl = await uploadBrandingLogo(selectedFile, userName);
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Logo atualizada com sucesso no Firebase e aplicada em todo o sistema!");
    } catch (err: unknown) {
      console.error("Erro ao salvar logo no Firebase:", err);
      toast.error(
        "Não foi possível enviar a logo: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSaveText = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingText(true);

    try {
      const userName = userProfile?.fullName || userProfile?.email || "Administrador";
      await saveBrandingSettings(
        {
          companyName: companyName.trim() || DEFAULT_BRANDING.companyName,
          subtitle: subtitle.trim() || DEFAULT_BRANDING.subtitle,
        },
        userName,
      );
      toast.success("Identidade institucional salva com sucesso!");
    } catch (err: unknown) {
      console.error("Erro ao salvar texto no Firebase:", err);
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingText(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Deseja restaurar a logo institucional padrão do Brasão?")) return;
    setUploading(true);
    try {
      const userName = userProfile?.fullName || userProfile?.email || "Administrador";
      await resetBrandingToDefault(userName);
      setPreviewUrl(null);
      setSelectedFile(null);
      setCompanyName(DEFAULT_BRANDING.companyName);
      setSubtitle(DEFAULT_BRANDING.subtitle);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Identidade padrão restaurada com sucesso!");
    } catch (err: unknown) {
      console.error("Erro ao restaurar padrão:", err);
      toast.error("Erro ao restaurar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5 shadow-card transition-all">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold">Identidade Visual & Branding</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Altere a logo oficial e o nome institucional. As mudanças sincronizam em tempo real no
            Firebase Firestore e Storage.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={uploading || brandingLoading}
            className="mt-2 h-8 text-xs sm:mt-0"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restaurar Padrão
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            Apenas usuários com perfil <strong>Master</strong> ou <strong>Editor</strong> possuem
            permissão para atualizar a identidade visual do sistema.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-12">
        {/* Preview da Logo */}
        <div className="md:col-span-5 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <div className="relative mb-4 flex h-32 w-32 items-center justify-center rounded-xl bg-background/80 p-3 shadow-inner ring-1 ring-border">
            <BrasaoLogo size="lg" {...(currentLogo ? { customSrc: currentLogo } : {})} />
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold">
              {branding.companyName || DEFAULT_BRANDING.companyName}
            </p>
            <p className="text-xs text-muted-foreground">
              {branding.subtitle || DEFAULT_BRANDING.subtitle}
            </p>
          </div>

          {previewUrl && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <ImageIcon className="h-3 w-3" />
              Pré-visualização (não salva)
            </div>
          )}

          {canEdit && (
            <div className="mt-5 w-full space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="branding-logo-upload"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {previewUrl ? "Escolher outra imagem" : "Selecionar nova logo"}
              </Button>

              {selectedFile && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                  onClick={handleUploadLogo}
                  disabled={uploading}
                >
                  {uploading ? (
                    "Salvando no Firebase..."
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Salvar Logo no Firebase
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Formulário de Textos Institucionais */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <form onSubmit={handleSaveText} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-xs font-medium">
                Nome da Empresa / Estabelecimento
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Galeteria Brasão"
                disabled={!canEdit || savingText}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subtitle" className="text-xs font-medium">
                Slogan / Subtítulo Institucional
              </Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Sistema de Gestão & ERP"
                disabled={!canEdit || savingText}
                className="h-9 text-sm"
              />
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Onde esta logo aparece:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Tela de Login e Cadastro do sistema (`/auth`)</li>
                <li>Cabeçalho do Menu Lateral (`AppSidebar`)</li>
                <li>Impressões e relatórios de estoque e pedidos</li>
                <li>Metatags e favicons do navegador</li>
              </ul>
            </div>

            {canEdit && (
              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingText || uploading}
                  className="h-9 px-4 text-xs font-medium"
                >
                  {savingText ? "Salvando..." : "Salvar Dados Institucionais"}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Seção de Cores do Sistema (Menu Lateral e Quadrantes) */}
      <div className="mt-6 pt-6 border-t space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Cores do Sistema (Menu Lateral &amp; Quadrantes de Vencimento)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalize a cor da barra lateral esquerda (Vinho, Dourado com texto preto, etc.) e a
            cor dos quadrantes diários.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Menu Lateral */}
          <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Menu Lateral Esquerdo</span>
              <span
                className="h-4 w-4 rounded-full border border-black/20 shadow-xs"
                style={{ backgroundColor: sidebarTheme.sidebar }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tema atual: <strong className="text-foreground">{sidebarTheme.name}</strong>
            </p>
            <div
              className="p-2.5 rounded-md text-xs font-medium flex items-center justify-between border"
              style={{
                backgroundColor: sidebarTheme.sidebar,
                color: sidebarTheme.sidebarForeground,
                borderColor: sidebarTheme.sidebarBorder,
              }}
            >
              <span>Exemplo de Item</span>
              <span className="text-[10px] opacity-80">Ativo</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 gap-1.5"
              onClick={() => setOpenSidebarDialog(true)}
            >
              <Palette className="h-3.5 w-3.5" />
              Alterar Cor do Menu
            </Button>
          </div>

          {/* Card 2: Quadrantes por Dia */}
          <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Quadrantes de Vencimento
              </span>
              <span
                className="h-4 w-4 rounded-full border border-black/20 shadow-xs"
                style={{ backgroundColor: quadranteTheme.previewBg }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cor atual: <strong className="text-foreground">{quadranteTheme.name}</strong>
            </p>
            <div
              style={quadranteTheme.headerStyle}
              className={`p-2 rounded-md text-xs font-bold flex items-center justify-between ${quadranteTheme.headerBgClass} ${quadranteTheme.headerTextClass}`}
            >
              <span className="uppercase text-[11px]">02 DE OUTUBRO</span>
              <span className="text-[10px] opacity-90">R$ 1.850,00</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 gap-1.5"
              onClick={() => setOpenQuadranteDialog(true)}
            >
              <Palette className="h-3.5 w-3.5" />
              Alterar Cor dos Quadrantes
            </Button>
          </div>
        </div>
      </div>

      <SidebarThemeDialog open={openSidebarDialog} onOpenChange={setOpenSidebarDialog} />
      <QuadrantesThemeDialog open={openQuadranteDialog} onOpenChange={setOpenQuadranteDialog} />
    </section>
  );
}
