import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  Columns2,
  Copy,
  Download,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Printer,
  Share2,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranding } from "@/lib/branding";
import { formatDateTime, formatQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface ReplenishmentProductItem {
  id: string;
  description: string;
  code?: string | number | null;
  unit: string;
  current_stock: number;
  avg_weekly_consumption: number;
  suggestedPurchase: number;
  status: "critico" | "atencao" | "normal";
  categoryName?: string;
  supplierName?: string;
}

interface ReplenishmentReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ReplenishmentProductItem[];
  filterLabel: string;
  scopeLabel: string;
  searchQuery?: string;
}

export function ReplenishmentReportModal({
  open,
  onOpenChange,
  products,
  filterLabel,
  scopeLabel,
  searchQuery,
}: ReplenishmentReportModalProps) {
  const { branding } = useBranding();
  const printContainerRef = useRef<HTMLDivElement>(null);

  const [layoutMode, setLayoutMode] = useState<"auto" | "single" | "two-columns">("auto");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isCapturingImage, setIsCapturingImage] = useState(false);

  // Determina layout eficaz: se houver mais de 10 produtos e estiver em 'auto', divide em 2 colunas para caber na tela
  const effectiveLayout = useMemo(() => {
    if (layoutMode === "two-columns") return "two-columns";
    if (layoutMode === "single") return "single";
    if (products.length > 10) return "two-columns";
    return "single";
  }, [layoutMode, products.length]);

  // Estatísticas do relatório
  const stats = useMemo(() => {
    let zeroOrNeg = 0;
    let critical = 0;
    let attention = 0;
    let totalSuggested = 0;

    for (const p of products) {
      if (Number(p.current_stock) <= 0) zeroOrNeg++;
      if (p.status === "critico") critical++;
      if (p.status === "atencao") attention++;
      totalSuggested += Number(p.suggestedPurchase) || 0;
    }

    return { zeroOrNeg, critical, attention, totalSuggested };
  }, [products]);

  // Separação em 2 colunas quando necessário
  const { col1, col2 } = useMemo(() => {
    if (effectiveLayout !== "two-columns") {
      return { col1: products, col2: [] };
    }
    const mid = Math.ceil(products.length / 2);
    return {
      col1: products.slice(0, mid),
      col2: products.slice(mid),
    };
  }, [products, effectiveLayout]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printContainerRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Gerando PDF em alta definição...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = printContainerRef.current;
      const prevZoom = element.style.zoom;
      element.style.zoom = "100%";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      element.style.zoom = prevZoom;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: effectiveLayout === "two-columns" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      } else {
        const ratio = (pdfHeight - margin * 2) / imgHeight;
        pdf.addImage(imgData, "PNG", margin, margin, imgWidth * ratio, pdfHeight - margin * 2);
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`;
      pdf.save(`Reposicao_Estoque_Brasao_${dateStr}.pdf`);
      toast.success("PDF baixado com sucesso!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF: " + (err as Error).message, { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyImage = async () => {
    if (!printContainerRef.current) return;
    setIsCapturingImage(true);
    const toastId = toast.loading("Capturando imagem em alta definição...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const element = printContainerRef.current;
      const prevZoom = element.style.zoom;
      element.style.zoom = "100%";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      element.style.zoom = prevZoom;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Não foi possível gerar a imagem.", { id: toastId });
          return;
        }

        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            toast.success("Imagem copiada com sucesso! Cole direto no WhatsApp ou e-mail.", {
              id: toastId,
            });
            return;
          }
        } catch {
          // Fallback para download caso a área de transferência não seja suportada pelo navegador
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reposicao_Estoque_Brasao_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagem baixada com sucesso!", { id: toastId });
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao capturar imagem: " + (err as Error).message, { id: toastId });
    } finally {
      setIsCapturingImage(false);
    }
  };

  const renderTableSection = (itemsList: ReplenishmentProductItem[], startIndex: number) => {
    return (
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-semibold text-[11px]">
            <th className="py-1.5 px-2 w-8 text-center">#</th>
            <th className="py-1.5 px-2">Produto</th>
            <th className="py-1.5 px-2 text-right">Estoque</th>
            <th className="py-1.5 px-2 text-right">Consumo/sem</th>
            <th className="py-1.5 px-2 text-right">Comprar</th>
            <th className="py-1.5 px-2 text-center w-16">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {itemsList.map((p, idx) => {
            const isZeroOrNeg = Number(p.current_stock) <= 0;
            const itemNumber = startIndex + idx + 1;
            return (
              <tr
                key={p.id}
                className={cn(
                  "hover:bg-slate-50 transition-colors",
                  isZeroOrNeg && "bg-rose-50/50",
                )}
              >
                <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[10px]">
                  {itemNumber}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-900 leading-snug">
                      {p.description}
                    </span>
                    {isZeroOrNeg && (
                      <span
                        className={cn(
                          "px-1 py-0.2 rounded text-[9px] font-bold uppercase",
                          Number(p.current_stock) < 0
                            ? "bg-rose-100 text-rose-700 border border-rose-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300",
                        )}
                      >
                        {Number(p.current_stock) < 0 ? "Negativo" : "Zerado"}
                      </span>
                    )}
                  </div>
                  {p.code && (
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Cód: {p.code}
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right font-medium font-mono text-[11px]">
                  <span className={cn(isZeroOrNeg ? "text-rose-700 font-bold" : "text-slate-800")}>
                    {formatQty(p.current_stock, p.unit)}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-slate-600 font-mono text-[11px]">
                  {formatQty(p.avg_weekly_consumption, p.unit)}
                </td>
                <td className="py-1.5 px-2 text-right font-bold text-slate-900 font-mono text-[11px]">
                  {p.suggestedPurchase > 0 ? (
                    <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                      {formatQty(p.suggestedPurchase, p.unit)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span
                    className={cn(
                      "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                      p.status === "critico" && "bg-rose-600 text-white",
                      p.status === "atencao" && "bg-amber-500 text-white",
                      p.status === "normal" && "bg-slate-200 text-slate-700",
                    )}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[96vh] flex flex-col p-2.5 sm:p-5 overflow-hidden bg-background">
        <DialogHeader className="shrink-0 space-y-1.5 border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-primary" />
                Produtos que Precisam de Reposição
                <Badge variant="secondary" className="text-xs">
                  {products.length} {products.length === 1 ? "produto" : "produtos"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Visualização em tela cheia otimizada para tirar print, salvar PDF ou enviar via
                WhatsApp.
              </DialogDescription>
            </div>

            {/* Ações principais no topo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyImage}
                disabled={isCapturingImage}
                className="h-8 text-xs gap-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30"
                title="Copia o relatório inteiro como imagem para colar direto no WhatsApp"
              >
                {isCapturingImage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>Copiar Imagem (WhatsApp)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Salvar PDF</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs gap-1.5 hidden sm:inline-flex"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </Button>
            </div>
          </div>

          {/* Barra de controle de visualização (Layout e Zoom) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs bg-muted/40 p-2 rounded-md border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Columns2 className="h-3 w-3" /> Layout:
              </span>
              <div className="inline-flex rounded-md border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setLayoutMode("auto")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                    layoutMode === "auto"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Automático
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("single")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                    layoutMode === "single"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  1 Coluna
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("two-columns")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                    layoutMode === "two-columns"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Divide em duas colunas para caber tudo em 1 tela única"
                >
                  2 Colunas (Caber em 1 tela)
                </button>
              </div>
            </div>

            {/* Ajuste de zoom para caber na tela */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-muted-foreground">Zoom:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="h-6 w-6 p-0"
                title="Reduzir zoom"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-[11px] font-mono tabular-nums w-8 text-center">
                {zoomLevel}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="h-6 w-6 p-0"
                title="Aumentar zoom"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(100)}
                className="h-6 text-[10px] px-1.5"
              >
                100%
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Área de rolagem com o documento imprimível */}
        <div className="flex-1 overflow-auto p-1 sm:p-2 bg-slate-200/60 dark:bg-slate-900/60 rounded-md">
          <div
            ref={printContainerRef}
            id="printable-replenishment-report"
            style={{ zoom: `${zoomLevel}%` }}
            className="mx-auto bg-white text-slate-900 shadow-md border border-slate-300 rounded-sm p-4 sm:p-6 transition-all min-h-[500px]"
          >
            {/* Cabeçalho do Relatório de Reposição */}
            <div className="border-b-2 border-slate-800 pb-3 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {branding.logoUrl && (
                    <img
                      src={branding.logoUrl}
                      alt={branding.companyName}
                      className="h-11 w-11 object-contain rounded border border-slate-200 p-0.5 bg-white shrink-0"
                    />
                  )}
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900">
                      {branding.companyName || "Galeteria Brasão"}
                    </h1>
                    <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">
                      {branding.subtitle || "Controle de Estoque & Compras"}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-1">
                    Relatório de Reposição
                  </span>
                  <p className="text-[11px] text-slate-600 font-mono">
                    {formatDateTime(new Date().toISOString())}
                  </p>
                </div>
              </div>

              {/* Badges de filtros ativos */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-200 text-xs">
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900">Filtro aplicado:</span>
                  <span className="font-bold text-amber-700">{filterLabel}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900">Escopo:</span>
                  <span>{scopeLabel}</span>
                </div>
                {searchQuery && (
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900">Busca:</span>
                    <span>"{searchQuery}"</span>
                  </div>
                )}
                <div className="ml-auto text-[11px] font-bold text-slate-800">
                  Total listado: {products.length} {products.length === 1 ? "item" : "itens"}
                </div>
              </div>
            </div>

            {/* Painel de Resumo Rápido */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                  Itens no Relatório
                </span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {products.length}
                </span>
              </div>
              <div className="p-2 rounded bg-rose-50 border border-rose-200">
                <span className="text-[10px] uppercase font-semibold text-rose-600 block">
                  Estoque Zerado / Negativo
                </span>
                <span className="text-base font-black text-rose-700 font-mono">
                  {stats.zeroOrNeg}
                </span>
              </div>
              <div className="p-2 rounded bg-amber-50 border border-amber-200">
                <span className="text-[10px] uppercase font-semibold text-amber-700 block">
                  Críticos / Atenção
                </span>
                <span className="text-base font-black text-amber-800 font-mono">
                  {stats.critical + stats.attention}
                </span>
              </div>
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] uppercase font-semibold text-emerald-700 block">
                  Total Compra Sugerida
                </span>
                <span className="text-base font-black text-emerald-800 font-mono">
                  {formatQty(stats.totalSuggested)}
                </span>
              </div>
            </div>

            {/* Listagem de Produtos (1 ou 2 colunas) */}
            {effectiveLayout === "two-columns" && col2.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded overflow-hidden">
                  {renderTableSection(col1, 0)}
                </div>
                <div className="border border-slate-200 rounded overflow-hidden">
                  {renderTableSection(col2, col1.length)}
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded overflow-hidden">
                {renderTableSection(products, 0)}
              </div>
            )}

            {/* Rodapé do Relatório */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
              <span>
                Sistema Brasão Gestão & ERP · Relatório para conferência física e reposição de
                estoque
              </span>
              <span>Página 1 de 1</span>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <DialogFooter className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t mt-2">
          <p className="text-[11px] text-muted-foreground">
            Dica: clique em <strong>Copiar Imagem</strong> para colar no WhatsApp sem precisar
            salvar arquivo.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleCopyImage}
              disabled={isCapturingImage}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Imagem
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
