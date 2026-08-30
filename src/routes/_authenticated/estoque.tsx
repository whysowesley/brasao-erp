import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { ProductDialog } from "@/components/ProductDialog";
import { StatusBadge } from "@/components/StatusBadge";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  applyMovement,
  deleteProduct,
  updateProductConsumption,
  useCategories,
  useInvalidateAll,
  useProducts,
  useRules,
  useSuppliers,
} from "@/lib/data";
import { formatQty, futureStatusFor, type ComputedProduct } from "@/lib/inventory";
import { usePurchasePlan } from "@/lib/purchase-plan";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Controle de Estoque | Brasão" },
      {
        name: "description",
        content:
          "Tabela completa de estoque da Brasão com consumo semanal, compra sugerida, estoque futuro e status automático.",
      },
      { property: "og:title", content: "Controle de Estoque | Brasão" },
      {
        property: "og:description",
        content: "Pesquise, filtre e edite rapidamente os produtos do estoque.",
      },
    ],
  }),
  component: EstoquePage,
});

type SortKey =
  | "description"
  | "current_stock"
  | "unit"
  | "supplierName"
  | "avg_weekly_consumption"
  | "suggestedPurchase"
  | "futureStock"
  | "status";

const statusOrder = { critico: 0, atencao: 1, normal: 2 } as const;

function EstoquePage() {
  const { data: products, isLoading } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useCategories();
  const { data: rules } = useRules();
  const invalidate = useInvalidateAll();

  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("todos");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "description",
    dir: "asc",
  });
  const [editing, setEditing] = useState<ComputedProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Quantidade que o usuário pretende comprar — compartilhada com as outras telas. */
  const { plan, setPlanned, clearPlan } = usePurchasePlan();

  const buyQty = (p: ComputedProduct) => plan[p.id] ?? p.suggestedPurchase;
  const futureWithBuy = (p: ComputedProduct) =>
    Number(p.current_stock) + buyQty(p) - Number(p.avg_weekly_consumption);
  /** Status projetado em tempo real conforme a quantidade que será comprada (só fica crítico se <= 0). */
  const futureStatus = (p: ComputedProduct) =>
    futureStatusFor(futureWithBuy(p), Number(p.min_stock), rules);

  const rows = useMemo(() => {
    let list = products ?? [];
    if (search.trim())
      list = list.filter((p) => p.description.toLowerCase().includes(search.trim().toLowerCase()));
    if (supplier !== "todos") list = list.filter((p) => p.supplier_id === supplier);
    if (category !== "todas") list = list.filter((p) => p.category_id === category);
    if (status !== "todos") list = list.filter((p) => p.status === status);

    const sorted = [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "status") return (statusOrder[a.status] - statusOrder[b.status]) * dir;
      const av = a[sort.key] as string | number;
      const bv = b[sort.key] as string | number;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "pt-BR") * dir;
    });

    if (!groupBySupplier) return sorted;
    return [...sorted].sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName, "pt-BR") ||
        a.description.localeCompare(b.description, "pt-BR"),
    );
  }, [products, search, supplier, category, status, sort, groupBySupplier]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  async function removeProduct(p: ComputedProduct) {
    try {
      await deleteProduct(p.id);
      invalidate();
      toast.success(`Produto ${p.description} apagado.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function quickSaveStock(p: ComputedProduct, value: string) {
    const v = Number(value.replace(",", ".")) || 0;
    if (v === Number(p.current_stock)) return;
    try {
      await applyMovement({
        productId: p.id,
        type: v > Number(p.current_stock) ? "ajuste_positivo" : "ajuste_negativo",
        newQuantity: v,
        notes: "Edição rápida na tela de estoque",
      });
      clearPlan([p.id]);
      invalidate();
      toast.success(`Estoque de ${p.description} atualizado.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function quickSaveConsumption(p: ComputedProduct, value: string) {
    const v = Number(value.replace(",", ".")) || 0;
    if (v === Number(p.avg_weekly_consumption)) return;
    try {
      await updateProductConsumption(p.id, v);
      clearPlan([p.id]);
      invalidate();
      toast.success("Consumo médio semanal atualizado.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const Th = ({ k, children, align }: { k: SortKey; children: string; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Controle de Estoque"
        description="Todos os produtos, com cálculo automático de compra sugerida e estoque futuro."
        actions={
          <div className="flex items-center gap-2">
            {Object.keys(plan).length > 0 && (
              <Button variant="outline" onClick={() => clearPlan()}>
                Limpar plano de compra
              </Button>
            )}
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger>
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fornecedores</SelectItem>
            {suppliers?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Switch
          id="group-supplier"
          checked={groupBySupplier}
          onCheckedChange={setGroupBySupplier}
        />
        <Label htmlFor="group-supplier" className="text-sm text-muted-foreground">
          Ver estoque agrupado por fornecedor
        </Label>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th k="description">Produto</Th>
                <Th k="current_stock" align="right">
                  Estoque Atual
                </Th>
                <Th k="unit">Embalagem</Th>
                <Th k="supplierName">Fornecedor</Th>
                <Th k="avg_weekly_consumption" align="right">
                  Consumo Médio Semanal
                </Th>
                <Th k="suggestedPurchase" align="right">
                  Compra Sugerida
                </Th>
                <TableHead className="text-right">Quero Comprar</TableHead>
                <TableHead className="text-right">Estoque Futuro</TableHead>
                <Th k="status">Status</Th>
                <TableHead>Status Futuro</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={12}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {rows.map((p, i) => (
                <Fragment key={p.id}>
                  {groupBySupplier && rows[i - 1]?.supplierName !== p.supplierName && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={12} className="py-2 text-xs font-semibold uppercase">
                        {p.supplierName}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {rows.filter((r) => r.supplierName === p.supplierName).length} produto(s)
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="font-medium">
                      <Link to="/produtos/$id" params={{ id: p.id }} className="hover:underline">
                        {p.description}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{p.categoryName}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        defaultValue={String(p.current_stock)}
                        onBlur={(e) => quickSaveStock(p, e.target.value)}
                        className="num ml-auto h-8 w-24 text-right"
                        inputMode="decimal"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{p.supplierName}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        defaultValue={String(p.avg_weekly_consumption)}
                        onBlur={(e) => quickSaveConsumption(p, e.target.value)}
                        className="num ml-auto h-8 w-24 text-right"
                        inputMode="decimal"
                      />
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      {p.suggestedPurchase > 0 ? formatQty(p.suggestedPurchase, p.unit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        value={String(buyQty(p))}
                        onChange={(e) =>
                          setPlanned(p.id, Number(e.target.value.replace(",", ".")) || 0)
                        }
                        className="num ml-auto h-8 w-24 text-right"
                        inputMode="decimal"
                      />
                    </TableCell>
                    <TableCell className="num text-right font-semibold">
                      {formatQty(futureWithBuy(p), p.unit)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={futureStatus(p)} />
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {p.notes ?? ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-critical" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apagar {p.description}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O produto será removido junto com seu histórico de movimentações,
                                itens de pedidos e de contagens. Essa ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeProduct(p)}>
                                Apagar produto
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                    Nenhum produto encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length} produto(s) exibido(s). Edições de estoque geram movimentação automática no
        histórico. A coluna "Quero comprar" fica salva e aparece igual nas telas de Sugestões,
        Contagem e Dashboard.
      </p>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
    </div>
  );
}
