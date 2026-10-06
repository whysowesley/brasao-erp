import { useState } from "react";
import { toast } from "sonner";
import {
  Tag,
  Layers,
  CreditCard,
  Plus,
  Trash2,
  FolderPlus,
  Pencil,
  Check,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import {
  useFinancialCategories,
  useCostCenters,
  usePaymentMethods,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateCostCenter,
  useUpdateCostCenter,
  useDeleteCostCenter,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from "@/lib/financeiro";
import { useAuth } from "@/lib/auth";

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "categorias" | "centros" | "pagamentos";
}

export function CategoriasDialog({
  open,
  onOpenChange,
  defaultTab = "categorias",
}: CategoriasDialogProps) {
  const { canWrite, isApproved } = useAuth();

  // Queries
  const { data: categories = [] } = useFinancialCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: paymentMethods = [] } = usePaymentMethods(false);

  // Mutações
  const createCatMutation = useCreateCategory();
  const updateCatMutation = useUpdateCategory();
  const deleteCatMutation = useDeleteCategory();

  const createCostMutation = useCreateCostCenter();
  const updateCostMutation = useUpdateCostCenter();
  const deleteCostMutation = useDeleteCostCenter();

  const createPayMutation = useCreatePaymentMethod();
  const updatePayMutation = useUpdatePaymentMethod();
  const deletePayMutation = useDeletePaymentMethod();

  // Estados locais para criação rápida
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"receita" | "despesa">("despesa");
  const [newCostName, setNewCostName] = useState("");
  const [newCostDesc, setNewCostDesc] = useState("");
  const [newPayName, setNewPayName] = useState("");
  const [newPayType, setNewPayType] = useState("outro");

  // Estados locais para edição
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    type: "receita" | "despesa";
    oldName: string;
  } | null>(null);

  const [editingCostCenter, setEditingCostCenter] = useState<{
    id: string;
    name: string;
    description: string;
    oldName: string;
  } | null>(null);

  const [editingPaymentMethod, setEditingPaymentMethod] = useState<{
    id: string;
    name: string;
    type: string;
    oldName: string;
  } | null>(null);

  /* ------------------- HANDLERS CATEGORIA ------------------- */
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para cadastrar categorias.");
      return;
    }
    if (!newCatName.trim()) {
      toast.error("Nome da categoria é obrigatório.");
      return;
    }

    try {
      await createCatMutation.mutateAsync({
        name: newCatName.trim(),
        type: newCatType,
      });
      setNewCatName("");
      toast.success("Categoria criada com sucesso!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    if (!canWrite || !isApproved) {
      toast.error("Sem permissão para editar.");
      return;
    }
    const trimmed = editingCategory.name.trim();
    if (!trimmed) {
      toast.error("O nome da categoria não pode ficar vazio.");
      return;
    }

    try {
      await updateCatMutation.mutateAsync({
        id: editingCategory.id,
        category: {
          name: trimmed,
          type: editingCategory.type,
        },
        oldName: editingCategory.oldName,
      });
      toast.success(`Categoria atualizada para "${trimmed}" em todos os lançamentos vinculados!`);
      setEditingCategory(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar categoria.");
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para excluir.");
      return;
    }
    if (!confirm(`Deseja realmente excluir a categoria "${name}"?`)) return;

    try {
      await deleteCatMutation.mutateAsync(id);
      toast.success("Categoria excluída com sucesso!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao excluir (verifique se está em uso).",
      );
    }
  };

  /* ----------------- HANDLERS CENTRO DE CUSTO ---------------- */
  const handleCreateCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para cadastrar centros de custo.");
      return;
    }
    if (!newCostName.trim()) {
      toast.error("Nome do centro de custo é obrigatório.");
      return;
    }

    try {
      await createCostMutation.mutateAsync({
        name: newCostName.trim(),
        description: newCostDesc.trim() || null,
      });
      setNewCostName("");
      setNewCostDesc("");
      toast.success("Centro de custo criado com sucesso!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar centro de custo.");
    }
  };

  const handleSaveCostCenter = async () => {
    if (!editingCostCenter) return;
    if (!canWrite || !isApproved) {
      toast.error("Sem permissão para editar.");
      return;
    }
    const trimmed = editingCostCenter.name.trim();
    if (!trimmed) {
      toast.error("O nome do centro de custo não pode ficar vazio.");
      return;
    }

    try {
      await updateCostMutation.mutateAsync({
        id: editingCostCenter.id,
        center: {
          name: trimmed,
          description: editingCostCenter.description?.trim() || null,
        },
        oldName: editingCostCenter.oldName,
      });
      toast.success(
        `Centro de custo atualizado para "${trimmed}" em todos os lançamentos vinculados!`,
      );
      setEditingCostCenter(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar centro de custo.");
    }
  };

  const handleDeleteCostCenter = async (id: string, name: string) => {
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para excluir.");
      return;
    }
    if (!confirm(`Deseja realmente excluir o centro de custo "${name}"?`)) return;

    try {
      await deleteCostMutation.mutateAsync(id);
      toast.success("Centro de custo excluído!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao excluir (verifique se está em uso).",
      );
    }
  };

  /* --------------- HANDLERS FORMAS DE PAGAMENTO --------------- */
  const handleCreatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para cadastrar formas de pagamento.");
      return;
    }
    if (!newPayName.trim()) {
      toast.error("Nome da forma de pagamento é obrigatório.");
      return;
    }

    try {
      await createPayMutation.mutateAsync({
        name: newPayName.trim(),
        type: newPayType,
        active: true,
      });
      setNewPayName("");
      toast.success("Forma de pagamento criada!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar forma de pagamento.");
    }
  };

  const handleSavePaymentMethod = async () => {
    if (!editingPaymentMethod) return;
    if (!canWrite || !isApproved) {
      toast.error("Sem permissão para editar.");
      return;
    }
    const trimmed = editingPaymentMethod.name.trim();
    if (!trimmed) {
      toast.error("O nome da forma de pagamento não pode ficar vazio.");
      return;
    }

    try {
      await updatePayMutation.mutateAsync({
        id: editingPaymentMethod.id,
        method: {
          name: trimmed,
          type: editingPaymentMethod.type,
        },
        oldName: editingPaymentMethod.oldName,
      });
      toast.success(
        `Forma de pagamento atualizada para "${trimmed}" em todos os lançamentos vinculados!`,
      );
      setEditingPaymentMethod(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar forma de pagamento.");
    }
  };

  const handleDeletePaymentMethod = async (id: string, name: string) => {
    if (!canWrite || !isApproved) {
      toast.error("Você não tem permissão para excluir.");
      return;
    }
    if (!confirm(`Deseja excluir a forma de pagamento "${name}"?`)) return;

    try {
      await deletePayMutation.mutateAsync(id);
      toast.success("Forma de pagamento excluída!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir forma de pagamento.");
    }
  };

  const despesasCategories = categories.filter((c) => c.type === "despesa");
  const receitasCategories = categories.filter((c) => c.type === "receita");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="categorias-dialog-content"
        className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Configurações Financeiras
          </DialogTitle>
          <DialogDescription>
            Gerencie e edite categorias, centros de custo e formas de pagamento do ERP. Ao alterar
            um nome, ele é atualizado automaticamente em todos os lançamentos e despesas vinculados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Edição com propagação automática:</strong> altere nomes a qualquer momento com o
            ícone do lápis. O novo nome é sincronizado para todos os fornecedores, despesas e
            relatórios atrelados.
          </span>
        </div>

        <Tabs defaultValue={defaultTab} className="mt-1 w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categorias" className="flex items-center gap-1.5 text-xs">
              <Tag className="h-3.5 w-3.5" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="centros" className="flex items-center gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Centros de Custo
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex items-center gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Formas de Pagamento
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CATEGORIAS */}
          <TabsContent value="categorias" className="space-y-4 pt-3">
            {canWrite && isApproved && (
              <form
                onSubmit={handleCreateCategory}
                className="rounded-lg border border-border bg-muted/40 p-3 space-y-3"
              >
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Nova Categoria Financeira
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Nome da categoria (ex: Fornecedores Hortifrúti, Aluguel...)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newCatType}
                      onChange={(e) => setNewCatType(e.target.value as "receita" | "despesa")}
                      className="rounded-md border border-input bg-background px-3 py-2 text-xs"
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                    <Button type="submit" size="sm" disabled={createCatMutation.isPending}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Despesas */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Categorias de Despesa ({despesasCategories.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {despesasCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      Nenhuma categoria de despesa.
                    </p>
                  ) : (
                    despesasCategories.map((c) => {
                      const isEditing = editingCategory?.id === c.id;
                      if (isEditing) {
                        return (
                          <div
                            key={c.id}
                            className="p-1.5 rounded-md border border-primary/50 bg-primary/10 space-y-1"
                          >
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingCategory.name}
                                onChange={(e) =>
                                  setEditingCategory({ ...editingCategory, name: e.target.value })
                                }
                                className="h-7 text-xs flex-1 bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCategory();
                                  } else if (e.key === "Escape") {
                                    setEditingCategory(null);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                                variant="ghost"
                                disabled={updateCatMutation.isPending}
                                onClick={handleSaveCategory}
                                title="Salvar alteração (atualiza todos os lançamentos)"
                              >
                                {updateCatMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                                variant="ghost"
                                onClick={() => setEditingCategory(null)}
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground px-0.5">
                              Pressione Enter para salvar e propagar
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted text-xs group transition-colors"
                        >
                          <span className="font-medium truncate pr-2">{c.name}</span>
                          {canWrite && isApproved && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() =>
                                  setEditingCategory({
                                    id: c.id,
                                    name: c.name,
                                    type: c.type,
                                    oldName: c.name,
                                  })
                                }
                                title="Editar nome da categoria"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                                onClick={() => handleDeleteCategory(c.id, c.name)}
                                title="Excluir categoria"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Receitas */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Categorias de Receita ({receitasCategories.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {receitasCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      Nenhuma categoria de receita.
                    </p>
                  ) : (
                    receitasCategories.map((c) => {
                      const isEditing = editingCategory?.id === c.id;
                      if (isEditing) {
                        return (
                          <div
                            key={c.id}
                            className="p-1.5 rounded-md border border-primary/50 bg-primary/10 space-y-1"
                          >
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingCategory.name}
                                onChange={(e) =>
                                  setEditingCategory({ ...editingCategory, name: e.target.value })
                                }
                                className="h-7 text-xs flex-1 bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCategory();
                                  } else if (e.key === "Escape") {
                                    setEditingCategory(null);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                                variant="ghost"
                                disabled={updateCatMutation.isPending}
                                onClick={handleSaveCategory}
                                title="Salvar alteração (atualiza todos os lançamentos)"
                              >
                                {updateCatMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                                variant="ghost"
                                onClick={() => setEditingCategory(null)}
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground px-0.5">
                              Pressione Enter para salvar e propagar
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted text-xs group transition-colors"
                        >
                          <span className="font-medium truncate pr-2">{c.name}</span>
                          {canWrite && isApproved && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() =>
                                  setEditingCategory({
                                    id: c.id,
                                    name: c.name,
                                    type: c.type,
                                    oldName: c.name,
                                  })
                                }
                                title="Editar nome da categoria"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                                onClick={() => handleDeleteCategory(c.id, c.name)}
                                title="Excluir categoria"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CENTROS DE CUSTO */}
          <TabsContent value="centros" className="space-y-4 pt-3">
            {canWrite && isApproved && (
              <form
                onSubmit={handleCreateCostCenter}
                className="rounded-lg border border-border bg-muted/40 p-3 space-y-3"
              >
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Novo Centro de Custo
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Nome (ex: Cozinha, Bar, Administrativo...)"
                      value={newCostName}
                      onChange={(e) => setNewCostName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Descrição (opcional)"
                      value={newCostDesc}
                      onChange={(e) => setNewCostDesc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={createCostMutation.isPending}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Centro de Custo
                  </Button>
                </div>
              </form>
            )}

            <div className="rounded-lg border border-border divide-y divide-border max-h-[300px] overflow-y-auto">
              {costCenters.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Nenhum centro de custo cadastrado.
                </p>
              ) : (
                costCenters.map((cc) => {
                  const isEditing = editingCostCenter?.id === cc.id;
                  if (isEditing) {
                    return (
                      <div
                        key={cc.id}
                        className="p-3 bg-primary/5 border-l-4 border-l-primary space-y-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Nome do Centro de Custo
                            </Label>
                            <Input
                              value={editingCostCenter.name}
                              onChange={(e) =>
                                setEditingCostCenter({
                                  ...editingCostCenter,
                                  name: e.target.value,
                                })
                              }
                              className="h-7 text-xs bg-background mt-0.5"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveCostCenter();
                                } else if (e.key === "Escape") {
                                  setEditingCostCenter(null);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Descrição (opcional)
                            </Label>
                            <Input
                              value={editingCostCenter.description}
                              onChange={(e) =>
                                setEditingCostCenter({
                                  ...editingCostCenter,
                                  description: e.target.value,
                                })
                              }
                              className="h-7 text-xs bg-background mt-0.5"
                              placeholder="Descrição opcional"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveCostCenter();
                                } else if (e.key === "Escape") {
                                  setEditingCostCenter(null);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary shrink-0" />
                            Atualiza automaticamente todos os lançamentos vinculados
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingCostCenter(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              disabled={updateCostMutation.isPending}
                              onClick={handleSaveCostCenter}
                            >
                              {updateCostMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                              )}
                              Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cc.id}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/50 group transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{cc.name}</p>
                        {cc.description && (
                          <p className="text-muted-foreground text-[11px]">{cc.description}</p>
                        )}
                      </div>
                      {canWrite && isApproved && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() =>
                              setEditingCostCenter({
                                id: cc.id,
                                name: cc.name,
                                description: cc.description || "",
                                oldName: cc.name,
                              })
                            }
                            title="Editar centro de custo"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                            onClick={() => handleDeleteCostCenter(cc.id, cc.name)}
                            title="Excluir centro de custo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* TAB 3: FORMAS DE PAGAMENTO */}
          <TabsContent value="pagamentos" className="space-y-4 pt-3">
            {canWrite && isApproved && (
              <form
                onSubmit={handleCreatePaymentMethod}
                className="rounded-lg border border-border bg-muted/40 p-3 space-y-3"
              >
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Nova Forma de Pagamento
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Nome (ex: PIX Banco Inter, Cartão Mastercard...)"
                      value={newPayName}
                      onChange={(e) => setNewPayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newPayType}
                      onChange={(e) => setNewPayType(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-xs"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="transferencia">Transferência</option>
                      <option value="outro">Outro</option>
                    </select>
                    <Button type="submit" size="sm" disabled={createPayMutation.isPending}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="rounded-lg border border-border divide-y divide-border max-h-[300px] overflow-y-auto">
              {paymentMethods.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Nenhuma forma de pagamento cadastrada.
                </p>
              ) : (
                paymentMethods.map((pm) => {
                  const isEditing = editingPaymentMethod?.id === pm.id;
                  if (isEditing) {
                    return (
                      <div
                        key={pm.id}
                        className="p-3 bg-primary/5 border-l-4 border-l-primary space-y-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Nome da Forma de Pagamento
                            </Label>
                            <Input
                              value={editingPaymentMethod.name}
                              onChange={(e) =>
                                setEditingPaymentMethod({
                                  ...editingPaymentMethod,
                                  name: e.target.value,
                                })
                              }
                              className="h-7 text-xs bg-background mt-0.5"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSavePaymentMethod();
                                } else if (e.key === "Escape") {
                                  setEditingPaymentMethod(null);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Tipo
                            </Label>
                            <select
                              value={editingPaymentMethod.type}
                              onChange={(e) =>
                                setEditingPaymentMethod({
                                  ...editingPaymentMethod,
                                  type: e.target.value,
                                })
                              }
                              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5"
                            >
                              <option value="pix">PIX</option>
                              <option value="boleto">Boleto</option>
                              <option value="cartao_credito">Cartão de Crédito</option>
                              <option value="cartao_debito">Cartão de Débito</option>
                              <option value="dinheiro">Dinheiro</option>
                              <option value="transferencia">Transferência</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary shrink-0" />
                            Atualiza automaticamente todos os lançamentos vinculados
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingPaymentMethod(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              disabled={updatePayMutation.isPending}
                              onClick={handleSavePaymentMethod}
                            >
                              {updatePayMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                              )}
                              Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={pm.id}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/50 group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{pm.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {pm.type}
                        </Badge>
                      </div>
                      {canWrite && isApproved && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() =>
                              setEditingPaymentMethod({
                                id: pm.id,
                                name: pm.name,
                                type: pm.type,
                                oldName: pm.name,
                              })
                            }
                            title="Editar forma de pagamento"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                            onClick={() => handleDeletePaymentMethod(pm.id, pm.name)}
                            title="Excluir forma de pagamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
