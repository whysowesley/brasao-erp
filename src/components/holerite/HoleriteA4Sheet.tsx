import React, { useRef, useState } from "react";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { Download, Printer, Scissors, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type HoleriteData } from "@/lib/holerites";
import { HoleriteReceipt } from "./HoleriteReceipt";

interface HoleriteA4SheetProps {
  data: HoleriteData;
  onClose?: () => void;
}

export const HoleriteA4Sheet: React.FC<HoleriteA4SheetProps> = ({ data }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Exportar para PDF A4 com 2 vias (Colaborador em cima + Empresa embaixo)
  const handleExportPdf = async () => {
    if (!sheetRef.current) return;
    setGeneratingPdf(true);
    const toastId = toast.loading("Gerando arquivo PDF A4 para download...");

    try {
      const node = sheetRef.current;

      // Gerar imagem em alta definição usando html-to-image (compatível com Tailwind v4, SVG inline e CSS moderno)
      let imgData: string;
      try {
        imgData = await toPng(node, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
        });
      } catch (firstErr) {
        console.warn(
          "Primeira tentativa com cacheBust falhou, tentando sem fontes remotas:",
          firstErr,
        );
        imgData = await toPng(node, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          skipFonts: true,
        });
      }

      // Medir as dimensões reais da imagem gerada para preservar proporção
      const img = new Image();
      img.src = imgData;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem para o PDF"));
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Margem reduzida de 5mm para preencher a página A4 perfeitamente
      const margin = 5;
      const printWidth = pdfWidth - margin * 2;
      const printHeight = (img.height * printWidth) / img.width;

      pdf.addImage(
        imgData,
        "PNG",
        margin,
        margin,
        printWidth,
        Math.min(printHeight, pdfHeight - margin * 2),
        undefined,
        "FAST",
      );

      const cleanMonth = (data.reference_month || "recibo").replace(/[/\\?%*:|"<>]/g, "_");
      const cleanName = (data.employee_name || "colaborador")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .slice(0, 20);
      const filename = `Holerite_${data.employee_code || "00"}_${cleanName}_${cleanMonth}.pdf`;

      // Download nativo garantido via Blob e link temporário
      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      toast.success("Download do PDF A4 iniciado no seu computador!", { id: toastId });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error(
        "Não foi possível converter a folha para PDF automaticamente. Use a opção 'Imprimir' e selecione 'Salvar como PDF' no seu navegador.",
        { id: toastId },
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Barra de Ações do PDF / Impressão */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-[800px] mb-4 bg-muted/60 p-3 rounded-lg border print:hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <FileCheck2 className="h-4 w-4 text-emerald-600" />
          <span>Folha A4 (2 Vias: 1ª Metade Colaborador / 2ª Metade Empresa)</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>

          <Button
            size="sm"
            onClick={handleExportPdf}
            disabled={generatingPdf}
            className="h-8 gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Exportar PDF A4
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Folha A4 que será renderizada e impressa */}
      <div className="overflow-x-auto w-full flex justify-center py-2">
        <div
          ref={sheetRef}
          id="printable-holerite"
          className="bg-white p-5 text-black shadow-md border rounded-sm w-[780px] print:w-full print:p-0 print:border-none print:shadow-none flex flex-col justify-between"
          style={{ minHeight: "1050px" }}
        >
          {/* PRIMEIRA PARTE EM CIMA: VIA DO COLABORADOR */}
          <div className="flex flex-col">
            <HoleriteReceipt data={data} copyLabel="1ª VIA - COLABORADOR" className="w-full" />
          </div>

          {/* LINHA DE CORTE TRACEJADA COM ÍCONE DE TESOURA */}
          <div className="my-5 flex items-center justify-center gap-2 text-neutral-400 print:text-neutral-600 select-none py-1">
            <div className="flex-1 border-t-2 border-dashed border-neutral-300 print:border-neutral-500" />
            <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest font-bold px-2">
              <Scissors className="h-3.5 w-3.5" />
              <span>Destaque aqui</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-neutral-300 print:border-neutral-500" />
          </div>

          {/* SEGUNDA PARTE EMBAIXO: VIA DA EMPRESA */}
          <div className="flex flex-col">
            <HoleriteReceipt data={data} copyLabel="2ª VIA - EMPRESA" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
