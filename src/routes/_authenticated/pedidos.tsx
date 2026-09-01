import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, PackageCheck, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { PurchaseOrderPrintDialog } from "@/components/PurchaseOrderPrintDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteOrder,
  updateOrderStatus,
  useInvalidateAll,
  useOrders,
  useProducts,
  useSuppliers,
} from "@/lib/data";
import { ORDER_STATUSES, formatDateTime, formatQty, orderStatusLabel } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos de Compra | Brasão" },
      {
        name: "description",
        content:
          "Ordens de compra da Brasão por fornecedor, com acompanhamento de status e recebimento com baixa automática no estoque.",
      },
      { property: "og:title", content: "Pedidos de Compra | Brasão" },
      {
        property: "og:description",
        content: "Acompanhe, aprove e receba os pedidos de compra.",
      },
    ],
  }),
  component: PedidosPage,
});

type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  products: { description: string; unit: string } | null;
};

function PedidosPage() {
  const { data: orders, isLoading } = useOrders();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const invalidate = useInvalidateAll();
  const [busy, setBusy] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    (products ?? []).forEach((p) => {
      map.set(p.id, p.description);
    });
    return map;
  }, [products]);

  const filteredOrders = useMemo(() => {
    return (orders ?? []).filter((o) => {
      const supplierId = (o as { supplier_id?: string | null }).supplier_id;
      const supplierMatch = supplierFilter === "all" || supplierId === supplierFilter;
      const term = search.trim().toLowerCase();
      const numStr = String(o.number ?? 1);
      const paddedNumStr = numStr.padStart(4, "0");
      const searchMatch =
        !term ||
        numStr.includes(term) ||
        paddedNumStr.includes(term) ||
        `#${numStr}`.includes(term) ||
        `#${paddedNumStr}`.includes(term) ||
        ((o.suppliers as { name?: string } | null)?.name ?? "").toLowerCase().includes(term);
      return supplierMatch && searchMatch;
    });
  }, [orders, supplierFilter, search]);

  async function changeStatus(orderId: string, status: string, items: OrderItem[]) {
    setBusy(orderId);
    try {
      await updateOrderStatus(orderId, status, items);
      invalidate();
      toast.success(
        status === "recebido"
          ? "Pedido recebido e estoque atualizado."
          : `Status alterado para ${orderStatusLabel(status)}.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeOrder(orderId: string) {
    setBusy(orderId);
    try {
      await deleteOrder(orderId);
      invalidate();
      toast.success("Pedido apagado do histórico.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pedidos de Compra"
        description="Ordens geradas a partir das sugestões, agrupadas por fornecedor."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Fornecedor</label>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Todos os fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Buscar pedido
          </label>
          <Input
            placeholder="Número ou fornecedor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredOrders.length} pedido{filteredOrders.length === 1 ? "" : "s"}
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando pedidos...</p>}
      {!isLoading && filteredOrders.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          {orders?.length
            ? "Nenhum pedido encontrado para o filtro selecionado."
            : "Nenhum pedido criado ainda. Gere um pedido na tela de Sugestões de Compra."}
        </div>
      )}

      <div className="space-y-4">
        {filteredOrders.map((o) => {
          const items = (o.purchase_order_items ?? []) as unknown as OrderItem[];
          return (
            <section key={o.id} className="rounded-lg border bg-card shadow-card">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="num text-sm font-semibold">
                      PEDIDO DE COMPRA #{String(o.number ?? 1).padStart(4, "0")}
                    </h2>
                    <Badge variant="secondary">{orderStatusLabel(o.status)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {(o.suppliers as { name: string } | null)?.name ?? "Sem fornecedor"} ·{" "}
                    {formatDateTime(o.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PurchaseOrderPrintDialog order={o} productMap={productMap} />
                  <Select
                    value={o.status}
                    onValueChange={(v) => changeStatus(o.id, v, items)}
                    disabled={busy === o.id}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {o.status !== "recebido" && o.status !== "cancelado" && (
                    <Button
                      variant="outline"
                      disabled={busy === o.id}
                      onClick={() => changeStatus(o.id, "recebido", items)}
                      className="text-xs"
                    >
                      <PackageCheck className="h-4 w-4" /> Registrar recebimento
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={busy === o.id}>
                        <Trash2 className="h-4 w-4 text-critical" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Apagar pedido #{String(o.number ?? 1).padStart(4, "0")}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          O pedido e seus itens serão removidos do histórico de pedidos. As
                          movimentações de estoque já registradas permanecem no histórico.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeOrder(o.id)}>
                          Apagar pedido
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const desc =
                      it.products?.description ||
                      (it as { product_description?: string }).product_description ||
                      productMap.get(it.product_id) ||
                      "Produto";
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{desc}</TableCell>
                        <TableCell className="num text-right">{formatQty(it.quantity)}</TableCell>
                        <TableCell className="text-muted-foreground">{it.unit}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {o.notes && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">{o.notes}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
