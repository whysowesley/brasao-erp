import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  useCategories,
  useInvalidateAll,
  useProducts,
  useSuppliers,
  useUnits,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores e Categorias | Brasão" },
      {
        name: "description",
        content: "Cadastro de fornecedores, categorias e unidades de medida do estoque da Brasão.",
      },
      { property: "og:title", content: "Fornecedores e Categorias | Brasão" },
      {
        property: "og:description",
        content: "Crie, renomeie e exclua fornecedores, categorias e unidades usados nos produtos.",
      },
    ],
  }),
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useCategories();
  const { data: units } = useUnits();
  const { data: products } = useProducts();
  const invalidate = useInvalidateAll();
  const [supplierName, setSupplierName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [editing, setEditing] = useState<{ table: string; id: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  async function add(table: "suppliers" | "categories", name: string, reset: () => void) {
    if (!name.trim()) return;
    const { error } = await supabase.from(table).insert({ name: name.trim().toUpperCase() });
    if (error) {
      toast.error(error.message);
      return;
    }
    reset();
    invalidate();
    toast.success("Cadastro criado.");
  }

  async function addUnit() {
    const code = unitCode.trim().toUpperCase();
    if (!code) return;
    const { error } = await supabase
      .from("units")
      .insert({ code, name: unitName.trim() || code });
    if (error) {
      toast.error(error.message);
      return;
    }
    setUnitCode("");
    setUnitName("");
    invalidate();
    toast.success("Unidade criada.");
  }

  async function rename(table: "suppliers" | "categories" | "units", id: string) {
    const value = editValue.trim();
    if (!value) return;
    const { error } =
      table === "units"
        ? await supabase.from("units").update({ name: value }).eq("code", id)
        : await supabase.from(table).update({ name: value.toUpperCase() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    invalidate();
    toast.success("Cadastro atualizado.");
  }

  async function remove(table: "suppliers" | "categories" | "units", id: string, used: number) {
    if (used > 0) {
      toast.error(`Não é possível excluir: ${used} produto(s) usam este cadastro.`);
      return;
    }
    const { error } =
      table === "units"
        ? await supabase.from("units").delete().eq("code", id)
        : await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
    toast.success("Cadastro excluído.");
  }

  const countBy = (key: "supplier_id" | "category_id" | "unit", id: string) =>
    (products ?? []).filter((p) => p[key] === id).length;

  const isEditing = (table: string, id: string) =>
    editing?.table === table && editing?.id === id;

  function rowActions(table: "suppliers" | "categories" | "units", id: string, name: string, used: number) {
    if (isEditing(table, id)) {
      return (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rename(table, id)}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <div className="flex justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => {
            setEditing({ table, id });
            setEditValue(name);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          onClick={() => remove(table, id, used)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Fornecedores"
        description="Fornecedores, categorias e unidades usados no cadastro de produtos e nos pedidos de compra."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card shadow-card">
          <header className="flex items-center gap-2 border-b p-3">
            <Input
              placeholder="Novo fornecedor"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && add("suppliers", supplierName, () => setSupplierName(""))
              }
            />
            <Button onClick={() => add("suppliers", supplierName, () => setSupplierName(""))}>
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {isEditing("suppliers", s.id) ? (
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    ) : (
                      s.name
                    )}
                  </TableCell>
                  <TableCell className="num text-right">{countBy("supplier_id", s.id)}</TableCell>
                  <TableCell>
                    {rowActions("suppliers", s.id, s.name, countBy("supplier_id", s.id))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border bg-card shadow-card">
          <header className="flex items-center gap-2 border-b p-3">
            <Input
              placeholder="Nova categoria"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && add("categories", categoryName, () => setCategoryName(""))
              }
            />
            <Button onClick={() => add("categories", categoryName, () => setCategoryName(""))}>
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {isEditing("categories", c.id) ? (
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    ) : (
                      c.name
                    )}
                  </TableCell>
                  <TableCell className="num text-right">{countBy("category_id", c.id)}</TableCell>
                  <TableCell>
                    {rowActions("categories", c.id, c.name, countBy("category_id", c.id))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center gap-2 border-b p-3">
            <Input
              className="sm:max-w-[160px]"
              placeholder="Sigla (ex.: CX)"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
            />
            <Input
              placeholder="Nome da unidade (ex.: Caixa)"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUnit()}
            />
            <Button onClick={addUnit}>
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Sigla</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units?.map((u) => (
                <TableRow key={u.code}>
                  <TableCell className="font-medium">{u.code}</TableCell>
                  <TableCell>
                    {isEditing("units", u.code) ? (
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    ) : (
                      u.name
                    )}
                  </TableCell>
                  <TableCell className="num text-right">{countBy("unit", u.code)}</TableCell>
                  <TableCell>
                    {rowActions("units", u.code, u.name, countBy("unit", u.code))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
