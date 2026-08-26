import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineCreate } from "@/components/InlineCreate";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCategories,
  useInvalidateAll,
  useSuppliers,
  useUnits,
  useRules,
  applyMovement,
} from "@/lib/data";

import type { ComputedProduct } from "@/lib/inventory";
import { DEFAULT_RULES, computeProduct, formatQty } from "@/lib/inventory";


type FormState = {
  description: string;
  code: string;
  category_id: string;
  supplier_id: string;
  unit: string;
  current_stock: string;
  avg_weekly_consumption: string;
  min_stock: string;
  desired_stock: string;
  safety_stock: string;
  coverage_weeks: string;
  lead_time_days: string;
  notes: string;
};

const empty: FormState = {
  description: "",
  code: "",
  category_id: "",
  supplier_id: "",
  unit: "UN",
  current_stock: "0",
  avg_weekly_consumption: "0",
  min_stock: "0",
  desired_stock: "0",
  safety_stock: "0",
  coverage_weeks: "",
  lead_time_days: "0",
  notes: "",
};

const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")) || 0);

export function ProductDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: ComputedProduct | null;
}) {
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: units } = useUnits();
  const invalidate = useInvalidateAll();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const { data: rules } = useRules();

  const preview = (() => {
    const current = num(form.current_stock);
    const consumption = num(form.avg_weekly_consumption);
    const c = computeProduct(
      {
        id: "",
        code: null,
        description: form.description,
        unit: form.unit,
        current_stock: current,
        avg_weekly_consumption: consumption,
        min_stock: num(form.min_stock),
        desired_stock: num(form.desired_stock),
        coverage_weeks: form.coverage_weeks.trim() === "" ? null : num(form.coverage_weeks),
        safety_stock: num(form.safety_stock),
        lead_time_days: Math.round(num(form.lead_time_days)),
        notes: null,
        active: true,
        category_id: null,
        supplier_id: null,
      },
      rules ?? DEFAULT_RULES,
    );
    return { current, consumption, suggestedPurchase: c.suggestedPurchase, futureStock: c.futureStock };
  })();



  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? {
            description: product.description,
            code: product.code?.toString() ?? "",
            category_id: product.category_id ?? "",
            supplier_id: product.supplier_id ?? "",
            unit: product.unit,
            current_stock: String(product.current_stock),
            avg_weekly_consumption: String(product.avg_weekly_consumption),
            min_stock: String(product.min_stock),
            desired_stock: String(product.desired_stock),
            safety_stock: String(product.safety_stock),
            coverage_weeks: product.coverage_weeks?.toString() ?? "",
            lead_time_days: String(product.lead_time_days),
            notes: product.notes ?? "",
          }
        : empty,
    );
  }, [open, product]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.description.trim()) {
      toast.error("Informe a descrição do produto.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        code: form.code.trim() === "" ? null : Number(form.code),
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        unit: form.unit,
        avg_weekly_consumption: num(form.avg_weekly_consumption),
        min_stock: num(form.min_stock),
        desired_stock: num(form.desired_stock),
        safety_stock: num(form.safety_stock),
        coverage_weeks: form.coverage_weeks.trim() === "" ? null : num(form.coverage_weeks),
        lead_time_days: Math.round(num(form.lead_time_days)),
        notes: form.notes.trim() || null,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        const newStock = num(form.current_stock);
        if (newStock !== Number(product.current_stock)) {
          await applyMovement({
            productId: product.id,
            type: newStock > Number(product.current_stock) ? "ajuste_positivo" : "ajuste_negativo",
            newQuantity: newStock,
            notes: "Ajuste manual pelo cadastro do produto",
          });
        }
        toast.success("Produto atualizado.");
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({ ...payload, current_stock: 0 })
          .select("id")
          .single();
        if (error) throw error;
        const initial = num(form.current_stock);
        if (initial !== 0) {
          await applyMovement({
            productId: data.id,
            type: "contagem",
            newQuantity: initial,
            notes: "Estoque inicial no cadastro",
          });
        }
        toast.success("Produto cadastrado.");
      }
      invalidate();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            Alterações no estoque atual geram automaticamente uma movimentação no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="desc">Descrição do produto</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="code">Código</Label>
            <Input id="code" value={form.code} onChange={(e) => set("code")(e.target.value)} />
          </div>
          <div>
            <Label>Unidade / embalagem</Label>
            <div className="flex items-center gap-2">
              <Select value={form.unit} onValueChange={set("unit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units?.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.code} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InlineCreate
                title="Nova unidade"
                placeholder="Sigla (ex.: CX)"
                extraPlaceholder="Nome (ex.: Caixa)"
                onCreate={async (code, name) => {
                  const value = code.toUpperCase();
                  const { error } = await supabase
                    .from("units")
                    .insert({ code: value, name: name || value });
                  if (error) throw error;
                  invalidate();
                  set("unit")(value);
                  toast.success("Unidade criada.");
                }}
              />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <div className="flex items-center gap-2">
              <Select value={form.category_id} onValueChange={set("category_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InlineCreate
                title="Nova categoria"
                placeholder="Nome da categoria"
                onCreate={async (name) => {
                  const { data, error } = await supabase
                    .from("categories")
                    .insert({ name: name.toUpperCase() })
                    .select("id")
                    .single();
                  if (error) throw error;
                  invalidate();
                  set("category_id")(data.id);
                  toast.success("Categoria criada.");
                }}
              />
            </div>
          </div>
          <div>
            <Label>Fornecedor</Label>
            <div className="flex items-center gap-2">
              <Select value={form.supplier_id} onValueChange={set("supplier_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InlineCreate
                title="Novo fornecedor"
                placeholder="Nome do fornecedor"
                onCreate={async (name) => {
                  const { data, error } = await supabase
                    .from("suppliers")
                    .insert({ name: name.toUpperCase() })
                    .select("id")
                    .single();
                  if (error) throw error;
                  invalidate();
                  set("supplier_id")(data.id);
                  toast.success("Fornecedor criado.");
                }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cur">Estoque atual</Label>
            <Input
              id="cur"
              inputMode="decimal"
              value={form.current_stock}
              onChange={(e) => set("current_stock")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cons">Consumo médio semanal</Label>
            <Input
              id="cons"
              inputMode="decimal"
              value={form.avg_weekly_consumption}
              onChange={(e) => set("avg_weekly_consumption")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="min">Estoque mínimo</Label>
            <Input
              id="min"
              inputMode="decimal"
              value={form.min_stock}
              onChange={(e) => set("min_stock")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="des">Estoque desejado</Label>
            <Input
              id="des"
              inputMode="decimal"
              value={form.desired_stock}
              onChange={(e) => set("desired_stock")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="saf">Estoque de segurança</Label>
            <Input
              id="saf"
              inputMode="decimal"
              value={form.safety_stock}
              onChange={(e) => set("safety_stock")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cov">Semanas de cobertura (opcional)</Label>
            <Input
              id="cov"
              inputMode="decimal"
              placeholder="Usa a configuração global"
              value={form.coverage_weeks}
              onChange={(e) => set("coverage_weeks")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lead">Prazo de entrega (dias)</Label>
            <Input
              id="lead"
              inputMode="numeric"
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days")(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="obs">Observação</Label>
            <Textarea
              id="obs"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-4">
          <Preview label="Estoque atual" value={preview.current} unit={form.unit} />
          <Preview label="Consumo da semana" value={preview.consumption} unit={form.unit} />
          <Preview label="Compra sugerida" value={preview.suggestedPurchase} unit={form.unit} />
          <Preview label="Estoque futuro" value={preview.futureStock} unit={form.unit} />
        </div>



        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Preview({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num text-lg font-semibold">{formatQty(value, unit)}</p>
    </div>
  );
}
