import { useState, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Printer,
  Download,
  FileText,
  X,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranding } from "@/lib/branding";
import { formatCurrencyBRL } from "@/lib/currency-utils";
import { resolveTransactionStatus, getTodayString } from "@/lib/financeiro";
import type { FinancialTransaction, TipoTransacao, StatusTransacao } from "@/lib/financeiro-types";

interface ExtratoFinanceiroPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: FinancialTransaction[];
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
}

export function ExtratoFinanceiroPdfModal({
  open,
  onOpenChange,
  transactions,
  periodLabel = "Período Atual",
  startDate,
  endDate,
}: ExtratoFinanceiroPdfModalProps) {
  const { companyName, subtitle, logoUrl } = useBranding();
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Estados de customização do Extrato
  const [filterType, setFilterType] = useState<"todas" | "receita" | "despesa">("todas");
  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">(
    "todos",
  );
  const [sortOption, setSortOption] = useState<
    "date_desc" | "date_asc" | "amount_desc" | "desc_asc"
  >("date_desc");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const today = getTodayString();
  const now = new Date();
  const emissionDateFormatted = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // 1. Filtragem dos Lançamentos do Extrato
  const filteredList = useMemo(() => {
    let list = [...transactions];

    if (filterType !== "todas") {
      list = list.filter((t) => t.type === filterType);
    }

    if (filterStatus !== "todos") {
      list = list.filter((t) => {
        const st = resolveTransactionStatus(t.status, t.due_date, today);
        return st === filterStatus;
      });
    }

    // Ordenação
    list.sort((a, b) => {
      switch (sortOption) {
        case "date_asc":
          return a.due_date.localeCompare(b.due_date);
        case "date_desc":
          return b.due_date.localeCompare(a.due_date);
        case "amount_desc": {
          const amtA = a.status === "pago" && a.paid_amount ? a.paid_amount : a.amount;
          const amtB = b.status === "pago" && b.paid_amount ? b.paid_amount : b.amount;
          return amtB - amtA;
        }
        case "desc_asc":
          return (a.description || "").localeCompare(b.description || "", "pt-BR");
        default:
          return 0;
      }
    });

    return list;
  }, [transactions, filterType, filterStatus, sortOption, today]);

  // 2. Totais do Extrato
  const metrics = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let pagasTotal = 0;
    let pendentesTotal = 0;

    for (const t of filteredList) {
      if (t.status === "cancelado") continue;
      const amt = t.status === "pago" && t.paid_amount ? t.paid_amount : t.amount;
      const st = resolveTransactionStatus(t.status, t.due_date, today);

      if (t.type === "receita") {
        entradas += amt;
      } else {
        saidas += amt;
      }

      if (st === "pago") {
        pagasTotal += amt;
      } else {
        pendentesTotal += amt;
      }
    }

    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      totalCount: filteredList.length,
      pagasTotal,
      pendentesTotal,
    };
  }, [filteredList, today]);

  // 3. Paginação A4 Dinâmica e Harmônica
  // Página 1 tem cabeçalho principal e resumo executivo (cabe menos linhas)
  // Páginas 2+ têm apenas cabeçalho compacto (cabe mais linhas)
  const pages = useMemo(() => {
    const page1Capacity = density === "compact" ? 24 : 18;
    const pageNextCapacity = density === "compact" ? 32 : 24;

    const result: FinancialTransaction[][] = [];
    if (filteredList.length === 0) {
      return [[]];
    }

    // Primeira página
    result.push(filteredList.slice(0, page1Capacity));

    // Páginas subsequentes
    let currentIndex = page1Capacity;
    while (currentIndex < filteredList.length) {
      result.push(filteredList.slice(currentIndex, currentIndex + pageNextCapacity));
      currentIndex += pageNextCapacity;
    }

    return result;
  }, [filteredList, density]);

  const totalPages = pages.length;

  // Impressão nativa do navegador (Salvar como PDF ou Imprimir)
  const handlePrint = () => {
    window.print();
  };

  // Download direto do arquivo PDF multi-página via jsPDF e html2canvas
  const handleDownloadPdf = async () => {
    if (!printContainerRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Gerando arquivo PDF em alta definição...");

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Seleciona cada página A4 individual renderizada
      const pageElements =
        printContainerRef.current.querySelectorAll<HTMLElement>(".a4-sheet-page");

      if (pageElements.length === 0) {
        throw new Error("Nenhuma folha para exportar");
      }

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        if (i > 0) {
          pdf.addPage();
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        // Preenche a página A4 perfeitamente sem corte
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      }

      const cleanPeriod = (periodLabel || "extrato").replace(/[/\\?%*:|"<> ]/g, "_");
      const filename = `Extrato_Financeiro_${cleanPeriod}_${format(now, "yyyyMMdd")}.pdf`;

      pdf.save(filename);
      toast.success("PDF do extrato baixado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error(
        "Não foi possível converter automaticamente. Use o botão 'Imprimir' e escolha 'Salvar como PDF'.",
        { id: toastId },
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[94vh] p-0 flex flex-col bg-background overflow-hidden border-border shadow-2xl">
        {/* Barra Superior / Cabeçalho de Ações (Oculto na Impressão) */}
        <div className="p-4 border-b bg-card flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 print:hidden">
          <div>
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>Extrato Financeiro Oficial (Formato A4)</span>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {totalPages} {totalPages === 1 ? "página A4" : "páginas A4"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Extrato harmônico pronto para impressão e exportação em PDF de alta qualidade.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Salvar como PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar Arquivo PDF (.pdf)</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Barra de Filtros e Customização do Extrato (Oculto na Impressão) */}
        <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between gap-2 flex-wrap text-xs print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">Opções do Extrato:</span>
            </div>

            {/* Filtro de Tipo */}
            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os Tipos</SelectItem>
                <SelectItem value="receita">Apenas Entradas (+)</SelectItem>
                <SelectItem value="despesa">Apenas Saídas (-)</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro de Status */}
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pago">Apenas Pagos</SelectItem>
                <SelectItem value="pendente">Apenas Pendentes</SelectItem>
                <SelectItem value="atrasado">Apenas Atrasados</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordenação */}
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as typeof sortOption)}>
              <SelectTrigger className="h-7 text-xs w-[160px] bg-background">
                <SelectValue placeholder="Ordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Vencimento (Mais recente)</SelectItem>
                <SelectItem value="date_asc">Vencimento (Mais antigo)</SelectItem>
                <SelectItem value="amount_desc">Valor (Maior para menor)</SelectItem>
                <SelectItem value="desc_asc">Descrição (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* Densidade */}
            <Select value={density} onValueChange={(v) => setDensity(v as typeof density)}>
              <SelectTrigger className="h-7 text-xs w-[125px] bg-background">
                <SelectValue placeholder="Densidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Padrão</SelectItem>
                <SelectItem value="compact">Mais linhas (Compacto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-[11px] text-muted-foreground font-medium">
            Exibindo <strong>{filteredList.length}</strong> de {transactions.length} lançamentos
          </div>
        </div>

        {/* Visualizador de Páginas A4 com Scroll (Área que é impressa ou convertida em PDF) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-200/70 dark:bg-neutral-900/80 flex flex-col items-center gap-6">
          <div
            ref={printContainerRef}
            id="printable-extrato-financeiro"
            className="w-full flex flex-col items-center gap-6"
          >
            {pages.map((pageTransactions, pageIdx) => {
              const pageNumber = pageIdx + 1;
              const isFirstPage = pageNumber === 1;

              return (
                <div
                  key={`a4-page-${pageNumber}`}
                  className="a4-sheet-page a4-print-page bg-white text-neutral-900 shadow-xl border border-neutral-300 w-full max-w-[210mm] min-h-[297mm] p-[10mm] flex flex-col justify-between box-border select-none print:shadow-none print:border-none print:m-0 print:p-[10mm] print:w-[210mm] print:min-h-[297mm]"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  {/* TOPO DA PÁGINA */}
                  <div>
                    {isFirstPage ? (
                      /* CABEÇALHO COMPLETO NA PÁGINA 1 */
                      <div className="border-b-2 border-neutral-900 pb-3 mb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt="Logo"
                                className="h-12 w-12 object-contain rounded-md border border-neutral-200"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-md bg-neutral-900 text-white flex items-center justify-center font-bold text-lg">
                                GB
                              </div>
                            )}
                            <div>
                              <h1 className="text-lg font-black tracking-tight uppercase text-neutral-900 leading-tight">
                                {companyName || "Galeteria Brasão"}
                              </h1>
                              <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                                {subtitle || "Sistema de Gestão Financeira & Caixa"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-black uppercase bg-neutral-900 text-white tracking-widest">
                              Extrato de Fluxo de Caixa
                            </span>
                            <p className="text-[11px] text-neutral-600 font-semibold mt-1">
                              Período:{" "}
                              <span className="text-neutral-900 font-bold">{periodLabel}</span>
                            </p>
                            {startDate && endDate && (
                              <p className="text-[10px] text-neutral-500 font-mono">
                                ({format(parseISO(startDate), "dd/MM/yyyy")} a{" "}
                                {format(parseISO(endDate), "dd/MM/yyyy")})
                              </p>
                            )}
                          </div>
                        </div>

                        {/* QUADRO DE RESUMO FINANCEIRO EXECUTIVO */}
                        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-neutral-200">
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                            <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">
                              Total Entradas (+)
                            </span>
                            <span className="text-xs font-black text-emerald-700 font-mono">
                              {formatCurrencyBRL(metrics.entradas)}
                            </span>
                          </div>

                          <div className="p-2 rounded bg-rose-50 border border-rose-200">
                            <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wider block">
                              Total Saídas (-)
                            </span>
                            <span className="text-xs font-black text-rose-700 font-mono">
                              {formatCurrencyBRL(metrics.saidas)}
                            </span>
                          </div>

                          <div
                            className={`p-2 rounded border ${
                              metrics.saldo >= 0
                                ? "bg-blue-50 border-blue-200"
                                : "bg-amber-50 border-amber-200"
                            }`}
                          >
                            <span className="text-[9px] font-bold text-neutral-700 uppercase tracking-wider block">
                              Saldo Líquido (=)
                            </span>
                            <span
                              className={`text-xs font-black font-mono ${
                                metrics.saldo >= 0 ? "text-blue-800" : "text-amber-800"
                              }`}
                            >
                              {formatCurrencyBRL(metrics.saldo)}
                            </span>
                          </div>

                          <div className="p-2 rounded bg-neutral-50 border border-neutral-200 text-right">
                            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider block">
                              Lançamentos
                            </span>
                            <span className="text-xs font-black text-neutral-900 font-mono">
                              {metrics.totalCount} itens
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CABEÇALHO COMPACTO NAS PÁGINAS 2 EM DIANTE */
                      <div className="border-b border-neutral-400 pb-2 mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-neutral-900">
                            {companyName || "Galeteria Brasão"}
                          </span>
                          <span className="text-neutral-400">•</span>
                          <span className="text-[11px] font-bold text-neutral-700 uppercase">
                            Extrato de Fluxo de Caixa (Continuação)
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {periodLabel} | Pág. {pageNumber} de {totalPages}
                        </div>
                      </div>
                    )}

                    {/* TABELA DE LANÇAMENTOS HARMÔNICA PARA A4 */}
                    <div className="w-full">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-neutral-900 text-white text-[9px] font-bold uppercase tracking-wider">
                            <th className="py-1.5 px-2 w-[16%]">Vencimento</th>
                            <th className="py-1.5 px-2 w-[28%]">Descrição / Identificação</th>
                            <th className="py-1.5 px-2 w-[16%]">Categoria</th>
                            <th className="py-1.5 px-2 w-[14%]">Centro / Fornec.</th>
                            <th className="py-1.5 px-2 text-center w-[8%]">Tipo</th>
                            <th className="py-1.5 px-2 text-right w-[11%]">Valor</th>
                            <th className="py-1.5 px-2 text-center w-[7%]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 text-[10px]">
                          {pageTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-neutral-500 italic">
                                Nenhum lançamento encontrado para os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            pageTransactions.map((tx, idx) => {
                              const isEntrada = tx.type === "receita";
                              const status = resolveTransactionStatus(
                                tx.status,
                                tx.due_date,
                                today,
                              );
                              const isPaid = status === "pago";
                              const effectiveAmt =
                                isPaid && tx.paid_amount ? tx.paid_amount : tx.amount;

                              return (
                                <tr
                                  key={tx.id || idx}
                                  className={`${
                                    idx % 2 === 0 ? "bg-white" : "bg-neutral-50/70"
                                  } hover:bg-neutral-100 transition-colors`}
                                >
                                  {/* Data */}
                                  <td className="py-1.5 px-2 font-mono text-[9.5px] leading-tight">
                                    <div className="font-bold text-neutral-900">
                                      {format(parseISO(tx.due_date), "dd/MM/yyyy")}
                                    </div>
                                    {isPaid && tx.payment_date && (
                                      <div className="text-[8px] text-emerald-700">
                                        Pago: {format(parseISO(tx.payment_date), "dd/MM")}
                                      </div>
                                    )}
                                    {!isPaid &&
                                      tx.expected_payment_date &&
                                      tx.expected_payment_date !== tx.due_date && (
                                        <div className="text-[8px] text-blue-600">
                                          Prev:{" "}
                                          {format(parseISO(tx.expected_payment_date), "dd/MM")}
                                        </div>
                                      )}
                                  </td>

                                  {/* Descrição */}
                                  <td className="py-1.5 px-2 font-medium text-neutral-900 leading-snug">
                                    <div className="line-clamp-1 font-semibold">
                                      {tx.description || "Lançamento sem descrição"}
                                    </div>
                                    {tx.notes && (
                                      <div className="text-[8.5px] text-neutral-500 line-clamp-1 italic">
                                        {tx.notes}
                                      </div>
                                    )}
                                  </td>

                                  {/* Categoria */}
                                  <td className="py-1.5 px-2 text-neutral-700 leading-tight">
                                    <div className="line-clamp-1">
                                      {tx.category?.name || tx.category_name || "Geral"}
                                    </div>
                                  </td>

                                  {/* Centro de Custo / Fornecedor */}
                                  <td className="py-1.5 px-2 text-neutral-600 leading-tight text-[9px]">
                                    <div className="line-clamp-1 font-medium text-neutral-800">
                                      {tx.cost_center?.name || tx.cost_center_name || "—"}
                                    </div>
                                    {(tx.supplier?.name || tx.supplier_name) && (
                                      <div className="line-clamp-1 text-[8px] text-neutral-500">
                                        {tx.supplier?.name || tx.supplier_name}
                                      </div>
                                    )}
                                  </td>

                                  {/* Tipo */}
                                  <td className="py-1.5 px-2 text-center">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                                        isEntrada
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {isEntrada ? "Entrada" : "Saída"}
                                    </span>
                                  </td>

                                  {/* Valor */}
                                  <td className="py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap">
                                    <span
                                      className={isEntrada ? "text-emerald-700" : "text-rose-700"}
                                    >
                                      {isEntrada ? "+ " : "- "}
                                      {formatCurrencyBRL(effectiveAmt)}
                                    </span>
                                  </td>

                                  {/* Status */}
                                  <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                    {status === "pago" ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-emerald-700">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> Pago
                                      </span>
                                    ) : status === "atrasado" ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-rose-600">
                                        <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-amber-600">
                                        <Clock className="h-2.5 w-2.5" /> Pendente
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* RODAPÉ DA FOLHA A4 */}
                  <div className="pt-2 border-t border-neutral-300 mt-3 flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                    <div className="flex items-center gap-2">
                      <span>Emitido em: {emissionDateFormatted}</span>
                      <span>•</span>
                      <span>{companyName || "Galeteria Brasão"}</span>
                    </div>

                    <div className="font-bold text-neutral-800">
                      Página {pageNumber} de {totalPages}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
