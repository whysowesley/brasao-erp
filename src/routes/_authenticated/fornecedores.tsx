import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Layers,
  Ruler,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { SupplierDialog, type SupplierData } from "@/components/SupplierDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteCategory,
  deleteSupplier,
  deleteUnit,
  saveCategory,
  saveUnit,
  updateCategory,
  updateUnit,
  useCategories,
  useInvalidateAll,
  useProducts,
  useSuppliers,
  useUnits,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores & Cadastros | Brasão" },
      {
        name: "description",
        content:
          "Gestão unificada de fornecedores com dados bancários/PIX para Estoque e Financeiro, além de categorias e unidades.",
      },
      { property: "og:title", content: "Fornecedores & Cadastros | Brasão" },
      {
        property: "og:description",
        content: "Cadastre e edite fornecedores com dados de contato e financeiro unificados.",
      },
    ],
  }),
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const { canWrite, isMaster } = useAuth();
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers();
  const { data: categories = [] } = useCategories();
  const { data: units = [] } = useUnits();
  const { data: products = [] } = useProducts();
  const invalidate = useInvalidateAll();

  // Estados de busca e modais
  const [searchTerm, setSearchTerm] = useState("");
  const [openSupplierDialog, setOpenSupplierDialog] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<SupplierData | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierData | null>(null);

  // Estados de edição rápida (Categorias e Unidades)
  const [categoryName, setCategoryName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [editingItem, setEditingItem] = useState<{
    table: "categories" | "units";
    id: string;
  } | null>(null);
  const [editItemValue, setEditItemValue] = useState("");

  const countProductsBySupplier = (supplierId: string) =>
    products.filter((p) => p.supplier_id === supplierId).length;

  const countProductsByCategory = (categoryId: string) =>
    products.filter((p) => p.category_id === categoryId).length;

  const countProductsByUnit = (unitCode: string) =>
    products.filter((p) => p.unit === unitCode).length;

  // Filtro de Fornecedores
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const s = searchTerm.toLowerCase();
    return suppliers.filter(
      (sup) =>
        sup.name.toLowerCase().includes(s) ||
        (sup.cnpj_cpf && sup.cnpj_cpf.toLowerCase().includes(s)) ||
        (sup.contact && sup.contact.toLowerCase().includes(s)) ||
        (sup.phone && sup.phone.toLowerCase().includes(s)) ||
        (sup.pix_key && sup.pix_key.toLowerCase().includes(s)) ||
        (sup.bank_name && sup.bank_name.toLowerCase().includes(s)),
    );
  }, [suppliers, searchTerm]);

  // Exclusão de Fornecedor
  async function handleDeleteSupplierConfirm() {
    if (!deletingSupplier?.id || !canWrite) return;
    const used = countProductsBySupplier(deletingSupplier.id);
    if (used > 0) {
      toast.error(`Não é possível excluir: ${used} produto(s) no estoque usam este fornecedor.`);
      setDeletingSupplier(null);
      return;
    }

    try {
      await deleteSupplier(deletingSupplier.id);
      toast.success("Fornecedor excluído com sucesso.");
      invalidate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir fornecedor.";
      toast.error(msg);
    } finally {
      setDeletingSupplier(null);
    }
  }

  // Adição e edição de Categoria de Estoque
  async function addCategory() {
    if (!canWrite) return;
    const name = categoryName.trim().toUpperCase();
    if (!name) return;
    try {
      await saveCategory(name);
      setCategoryName("");
      invalidate();
      toast.success("Categoria criada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  }

  // Adição e edição de Unidade
  async function addUnit() {
    if (!canWrite) return;
    const code = unitCode.trim().toUpperCase();
    if (!code) return;
    try {
      await saveUnit(code, unitName.trim() || code);
      setUnitCode("");
      setUnitName("");
      invalidate();
      toast.success("Unidade criada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar unidade.");
    }
  }

  async function saveItemRename(table: "categories" | "units", id: string) {
    if (!canWrite) return;
    const val = editItemValue.trim();
    if (!val) return;
    try {
      if (table === "units") {
        await updateUnit(id, val);
      } else {
        await updateCategory(id, val);
      }
      setEditingItem(null);
      invalidate();
      toast.success("Cadastro atualizado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar cadastro.");
    }
  }

  async function removeItem(table: "categories" | "units", id: string, usedCount: number) {
    if (!canWrite) return;
    if (usedCount > 0) {
      toast.error(`Não é possível excluir: ${usedCount} produto(s) usam este cadastro.`);
      return;
    }
    try {
      if (table === "units") {
        await deleteUnit(id);
      } else {
        await deleteCategory(id);
      }
      invalidate();
      toast.success("Cadastro excluído.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir cadastro.");
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Topo */}
      <PageHeader
        title="Fornecedores & Cadastros"
        description="Gestão unificada de parceiros comerciais, categorias e unidades para Estoque, Compras e Financeiro"
        actions={
          canWrite && (
            <div className="flex items-center gap-2">
              <Link to="/importar">
                <Button variant="outline" className="gap-1.5 text-xs sm:text-sm">
                  <Upload className="h-4 w-4" />
                  <span>Importar Planilha</span>
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setSupplierToEdit(null);
                  setOpenSupplierDialog(true);
                }}
                className="gap-1.5 bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90 text-xs sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>+ Novo Fornecedor</span>
              </Button>
            </div>
          )
        }
      />

      <Tabs defaultValue="fornecedores" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fornecedores" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span>Fornecedores ({suppliers.length})</span>
          </TabsTrigger>
          <TabsTrigger value="auxiliares" className="gap-2">
            <Layers className="h-4 w-4" />
            <span>Categorias & Unidades</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA: Fornecedores */}
        <TabsContent value="fornecedores" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Fornecedores Cadastrados</CardTitle>
                <CardDescription>
                  Entidade única compartilhada entre compras de insumos e lançamentos de despesas
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor, CNPJ, PIX..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs sm:text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Contato & Comunicação</TableHead>
                      <TableHead>Dados Financeiros / PIX</TableHead>
                      <TableHead className="text-center">Produtos</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSuppliers ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          Carregando fornecedores...
                        </TableCell>
                      </TableRow>
                    ) : filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          {searchTerm
                            ? "Nenhum fornecedor encontrado para a busca."
                            : "Nenhum fornecedor cadastrado."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSuppliers.map((s) => {
                        const prodCount = countProductsBySupplier(s.id);
                        const hasBank = !!(s.pix_key || s.bank_name || s.bank_account);

                        return (
                          <TableRow key={s.id} className="hover:bg-muted/30">
                            {/* Nome & CNPJ */}
                            <TableCell className="align-top font-medium">
                              <div>
                                <span className="text-sm font-semibold text-foreground">
                                  {s.name}
                                </span>
                                {s.cnpj_cpf && (
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                    {s.cnpj_cpf}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            {/* Contato, Tel, Email */}
                            <TableCell className="align-top text-xs space-y-1">
                              {s.contact && (
                                <p className="font-medium text-foreground">{s.contact}</p>
                              )}
                              {s.phone && (
                                <p className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3 text-muted-foreground/70" />
                                  <span>{s.phone}</span>
                                </p>
                              )}
                              {s.email && (
                                <p className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3 text-muted-foreground/70" />
                                  <span>{s.email}</span>
                                </p>
                              )}
                              {!s.contact && !s.phone && !s.email && (
                                <span className="text-muted-foreground italic">Sem contato</span>
                              )}
                            </TableCell>

                            {/* Dados Bancários & PIX */}
                            <TableCell className="align-top text-xs space-y-1">
                              {s.pix_key && (
                                <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                  <CreditCard className="h-3 w-3 shrink-0" />
                                  <span className="font-mono truncate max-w-[180px]">
                                    PIX: {s.pix_key}
                                  </span>
                                </div>
                              )}
                              {s.bank_name && (
                                <p className="text-muted-foreground">
                                  {s.bank_name}
                                  {s.bank_agency ? ` | Ag: ${s.bank_agency}` : ""}
                                  {s.bank_account ? ` | CC: ${s.bank_account}` : ""}
                                </p>
                              )}
                              {!hasBank && (
                                <span className="text-muted-foreground italic">Não informado</span>
                              )}
                            </TableCell>

                            {/* Produtos */}
                            <TableCell className="align-top text-center">
                              <Badge variant="secondary" className="font-normal text-xs">
                                {prodCount} {prodCount === 1 ? "produto" : "produtos"}
                              </Badge>
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="align-top text-right">
                              <div className="flex justify-end gap-1">
                                {canWrite && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    title="Editar Fornecedor"
                                    onClick={() => {
                                      setSupplierToEdit(s);
                                      setOpenSupplierDialog(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canWrite && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    title="Excluir Fornecedor"
                                    onClick={() => setDeletingSupplier(s)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Categorias e Unidades */}
        <TabsContent value="auxiliares" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Categorias */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Categorias de Estoque</span>
                </CardTitle>
                <CardDescription>Classificação de produtos no almoxarifado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nova categoria..."
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    />
                    <Button onClick={addCategory} size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      <span>Adicionar</span>
                    </Button>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((c) => {
                        const isThisEditing =
                          editingItem?.table === "categories" && editingItem?.id === c.id;
                        const count = countProductsByCategory(c.id);

                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">
                              {isThisEditing ? (
                                <Input
                                  value={editItemValue}
                                  onChange={(e) => setEditItemValue(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                c.name
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {count} {count === 1 ? "item" : "itens"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canWrite && (
                                <div className="flex justify-end gap-1">
                                  {isThisEditing ? (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => saveItemRename("categories", c.id)}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => setEditingItem(null)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setEditingItem({ table: "categories", id: c.id });
                                          setEditItemValue(c.name);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeItem("categories", c.id, count)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Unidades de Medida */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-primary" />
                  <span>Unidades de Medida</span>
                </CardTitle>
                <CardDescription>Padrões de medição (ex: KG, CX, UN, LT)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-24 shrink-0 uppercase"
                      placeholder="Sigla"
                      value={unitCode}
                      onChange={(e) => setUnitCode(e.target.value)}
                    />
                    <Input
                      placeholder="Nome completo (ex: Caixa)"
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addUnit()}
                    />
                    <Button onClick={addUnit} size="sm" className="gap-1 shrink-0">
                      <Plus className="h-4 w-4" />
                      <span>Adicionar</span>
                    </Button>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-20">Sigla</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map((u) => {
                        const isThisEditing =
                          editingItem?.table === "units" && editingItem?.id === u.code;
                        const count = countProductsByUnit(u.code);

                        return (
                          <TableRow key={u.code}>
                            <TableCell className="font-bold text-xs font-mono">{u.code}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {isThisEditing ? (
                                <Input
                                  value={editItemValue}
                                  onChange={(e) => setEditItemValue(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                u.name
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {count} {count === 1 ? "item" : "itens"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canWrite && (
                                <div className="flex justify-end gap-1">
                                  {isThisEditing ? (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => saveItemRename("units", u.code)}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => setEditingItem(null)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setEditingItem({ table: "units", id: u.code });
                                          setEditItemValue(u.name);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeItem("units", u.code, count)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Fornecedor (Criar / Editar) */}
      <SupplierDialog
        open={openSupplierDialog}
        onOpenChange={setOpenSupplierDialog}
        supplierToEdit={supplierToEdit}
      />

      {/* Dialog de Confirmação de Exclusão de Fornecedor */}
      <AlertDialog
        open={!!deletingSupplier}
        onOpenChange={(open) => !open && setDeletingSupplier(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Confirmar Exclusão de Fornecedor</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir o fornecedor{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{deletingSupplier?.name}&rdquo;
              </span>
              ? O histórico financeiro anterior será preservado com o snapshot do nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplierConfirm}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
