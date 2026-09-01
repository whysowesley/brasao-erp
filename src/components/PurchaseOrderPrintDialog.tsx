import { useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Grid2X2,
  ListFilter,
  Maximize2,
  Printer,
  Share2,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBranding } from "@/lib/branding";
import { formatDateTime, formatQty, orderStatusLabel } from "@/lib/inventory";

export interface PurchaseOrderItemData {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  products?: { description: string; unit: string; code?: number | string | null } | null;
  product_description?: string;
  product_code?: number | string | null;
}

export interface PurchaseOrderData {
  id: string;
  number?: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  suppliers?: { name: string; phone?: string; email?: string } | null;
  status: string;
  user_name?: string | null;
  notes?: string | null;
  created_at: string;
  purchase_order_items?: PurchaseOrderItemData[];
}

interface PurchaseOrderPrintDialogProps {
  order: PurchaseOrderData;
  productMap?: Map<string, string>;
  triggerButton?: React.ReactNode;
}

export function PurchaseOrderPrintDialog({
  order,
  productMap,
  triggerButton,
}: PurchaseOrderPrintDialogProps) {
  const [open, setOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"auto" | "single" | "two-columns">("auto");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showCheckboxes, setShowCheckboxes] = useState(true);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();

  const items = useMemo(() => {
    const raw = (order.purchase_order_items ?? []) as PurchaseOrderItemData[];
    return raw.map((it, idx) => {
      const desc =
        it.products?.description ||
        it.product_description ||
        (productMap ? productMap.get(it.product_id) : undefined) ||
        "Produto sem nome";
      const code = it.products?.code || it.product_code || null;
      return {
        ...it,
        index: idx + 1,
        resolvedDescription: desc,
        resolvedCode: code,
      };
    });
  }, [order, productMap]);

  const supplierName =
    (order.suppliers as { name?: string } | null)?.name ||
    order.supplier_name ||
    "Fornecedor Geral / Não especificado";

  const orderNumberStr = String(order.number ?? 1).padStart(4, "0");

  const totalQuantity = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [items]);

  // Escolhe automaticamente se divide em 2 colunas para caber em 1 tela quando tiver mais de 8 itens
  const effectiveLayout = useMemo(() => {
    if (layoutMode === "two-columns") return "two-columns";
    if (layoutMode === "single") return "single";
    return items.length > 8 ? "two-columns" : "single";
  }, [layoutMode, items.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = () => {
    const lines: string[] = [
      `📋 *PEDIDO DE COMPRA #${orderNumberStr}*`,
      `🏢 *Fornecedor:* ${supplierName}`,
      `📅 *Data:* ${formatDateTime(order.created_at)}`,
      `📦 *Status:* ${orderStatusLabel(order.status).toUpperCase()}`,
      `----------------------------------------`,
    ];

    items.forEach((it) => {
      const num = String(it.index).padStart(2, "0");
      lines.push(`${num}. *${it.resolvedDescription}*: ${formatQty(it.quantity)} ${it.unit}`);
    });

    lines.push(`----------------------------------------`);
    lines.push(`📊 *Total de Itens:* ${items.length} produto(s)`);
    if (order.notes) {
      lines.push(`📝 *Observação:* ${order.notes}`);
    }
    lines.push(`\n_Gerado por ${branding.companyName || "Brasão ERP"}_`);

    const textToCopy = lines.join("\n");
    navigator.clipboard.writeText(textToCopy);
    toast.success("Texto do pedido copiado! Pronto para colar no WhatsApp.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <FileText className="h-4 w-4 text-primary" />
            PDF / Visualizar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[96vh] max-w-4xl overflow-hidden p-0 sm:max-h-[92vh]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5 text-primary" />
                Pedido de Compra #{orderNumberStr} — Impressão & PDF
              </DialogTitle>
              <DialogDescription className="text-xs">
                Visualização estruturada e compacta para impressão, download em PDF ou captura de
                tela.
              </DialogDescription>
            </div>

            {/* Controles de Layout e Zoom */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-md border bg-background p-0.5 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode("auto")}
                  className={`rounded px-2 py-1 transition-colors ${
                    layoutMode === "auto"
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Ajuste automático para caber na tela"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("single")}
                  className={`rounded px-2 py-1 transition-colors ${
                    layoutMode === "single"
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="1 Coluna corrida"
                >
                  <ListFilter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("two-columns")}
                  className={`rounded px-2 py-1 transition-colors ${
                    layoutMode === "two-columns"
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="2 Colunas compactas (ótimo para print em 1 tela)"
                >
                  <Grid2X2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                  title="Reduzir zoom (caber mais itens)"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="px-1 text-[11px] font-mono text-muted-foreground">
                  {zoomLevel}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setShowCheckboxes((v) => !v)}
              >
                <Check className={`h-3 w-3 ${showCheckboxes ? "text-primary" : "opacity-30"}`} />
                Conferência
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo do Documento Imprimível */}
        <div className="max-h-[calc(92vh-130px)] overflow-y-auto bg-muted/20 p-4 sm:p-6">
          <div
            ref={printContainerRef}
            id="printable-purchase-order"
            className="printable-purchase-order mx-auto rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-all duration-150 sm:p-8"
            style={{
              zoom: `${zoomLevel}%`,
              maxWidth: effectiveLayout === "two-columns" ? "880px" : "780px",
            }}
          >
            {/* Cabeçalho do Pedido */}
            <div className="border-b pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.companyName || "Logo"}
                      className="h-12 w-12 rounded object-contain border bg-white p-1"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10 font-bold text-primary">
                      {branding.companyName
                        ? branding.companyName.substring(0, 2).toUpperCase()
                        : "BR"}
                    </div>
                  )}
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                      {branding.companyName || "Galeteria Brasão"}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {branding.subtitle || "Sistema de Gestão & ERP"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    <span>PEDIDO DE COMPRA #{orderNumberStr}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                    <span>Status:</span>
                    <Badge variant="outline" className="text-[11px] font-medium uppercase">
                      {orderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Informações do Fornecedor e Emissão */}
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Fornecedor / Destinatário
                  </span>
                  <p className="mt-0.5 font-bold text-foreground text-sm">{supplierName}</p>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Data de Emissão
                  </span>
                  <p className="mt-0.5 font-medium text-foreground">
                    {formatDateTime(order.created_at)}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Responsável / Emissor
                  </span>
                  <p className="mt-0.5 font-medium text-foreground">
                    {order.user_name || "Administrador"}
                  </p>
                </div>
              </div>
            </div>

            {/* Listagem dos Itens do Pedido */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens do Pedido ({items.length} produtos)
                </span>
                <span className="text-xs text-muted-foreground">
                  Qtd total acumulada:{" "}
                  <strong className="text-foreground">{formatQty(totalQuantity)}</strong>
                </span>
              </div>

              {effectiveLayout === "two-columns" ? (
                /* Layout em 2 Colunas Compactas */
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between rounded border bg-card/60 px-3 py-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        {showCheckboxes && (
                          <div className="h-3.5 w-3.5 shrink-0 rounded-xs border border-muted-foreground/40 bg-background" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground">
                          #{String(it.index).padStart(2, "0")}
                        </span>
                        <span
                          className="truncate font-semibold text-foreground"
                          title={it.resolvedDescription}
                        >
                          {it.resolvedDescription}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono font-bold text-primary">
                          {formatQty(it.quantity)}
                        </span>{" "}
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {it.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Layout em Tabela Completa */
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/60 text-[11px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        {showCheckboxes && <th className="w-8 px-3 py-2 text-center">Conf.</th>}
                        <th className="w-12 px-3 py-2 text-center">Item</th>
                        <th className="px-3 py-2">Descrição do Produto</th>
                        <th className="w-28 px-3 py-2 text-right">Quantidade</th>
                        <th className="w-20 px-3 py-2 text-left">Unidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/20">
                          {showCheckboxes && (
                            <td className="px-3 py-2 text-center">
                              <div className="mx-auto h-3.5 w-3.5 rounded-xs border border-muted-foreground/40 bg-background" />
                            </td>
                          )}
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                            #{String(it.index).padStart(2, "0")}
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">
                            {it.resolvedDescription}
                          </td>
                          <td className="num px-3 py-2 text-right font-bold text-foreground">
                            {formatQty(it.quantity)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground uppercase">{it.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Observações */}
            {order.notes && (
              <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-50/40 p-2.5 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  Observações:
                </span>
                <p className="mt-0.5 text-xs">{order.notes}</p>
              </div>
            )}

            {/* Rodapé e Assinatura */}
            <div className="mt-6 border-t pt-4">
              <div className="grid grid-cols-2 gap-6 text-[11px] text-muted-foreground">
                <div>
                  <p>
                    Documento gerado automaticamente pelo{" "}
                    <strong>{branding.companyName || "Brasão ERP"}</strong> em{" "}
                    {new Date().toLocaleDateString("pt-BR")} às{" "}
                    {new Date().toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                </div>
                <div className="flex flex-col items-end justify-end">
                  <div className="w-48 border-b border-dashed border-muted-foreground/60 pb-1 text-center">
                    <span className="text-[10px] text-muted-foreground">
                      Assinatura / Recebido por
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal com Botões de Ação */}
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-3 sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Dica: Use <strong>Ajustar / 2 Colunas</strong> para enquadrar perfeitamente em 1
              print.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyWhatsApp}
              className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
            >
              <Share2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Copiar WhatsApp
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
