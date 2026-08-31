import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";

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
  saveProduct,
  saveCategory,
  saveSupplier,
  saveUnit,
} from "@/lib/data";

import type { ComputedProduct, ConsumptionMode, DayOfWeek } from "@/lib/inventory";
import {
  DEFAULT_RULES,
  DAYS_OF_WEEK,
  computeProduct,
  formatQty,
  futureStatusFor,
  sumDailyConsumption,
} from "@/lib/inventory";

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

type DailyFormState = {
  seg: string;
  ter: string;
  qua: string;
  qui: string;
  sex: string;
  sab: string;
  dom: string;
  seg2: string;
};

const emptyDaily: DailyFormState = {
  seg: "0",
  ter: "0",
  qua: "0",
  qui: "0",
  sex: "0",
  sab: "0",
  dom: "0",
  seg2: "0",
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
const roundVal = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round((n + Number.EPSILON) * 100) / 100);

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
  const [consumptionMode, setConsumptionMode] = useState<ConsumptionMode>("constant");
  const [constantDaily, setConstantDaily] = useState<string>("0");
  const [daily, setDaily] = useState<DailyFormState>(emptyDaily);
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
    const futureStatus = futureStatusFor(
      c.futureStock,
      num(form.min_stock),
      rules ?? DEFAULT_RULES,
    );
    return {
      current,
      consumption,
      suggestedPurchase: c.suggestedPurchase,
      futureStock: c.futureStock,
      status: c.status,
      futureStatus,
    };
  })();

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
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
      });

      const mode = product.daily_consumption_mode ?? "constant";
      setConsumptionMode(mode);

      if (product.daily_consumption) {
        setDaily({
          seg: String(product.daily_consumption.seg ?? 0),
          ter: String(product.daily_consumption.ter ?? 0),
          qua: String(product.daily_consumption.qua ?? 0),
          qui: String(product.daily_consumption.qui ?? 0),
          sex: String(product.daily_consumption.sex ?? 0),
          sab: String(product.daily_consumption.sab ?? 0),
          dom: String(product.daily_consumption.dom ?? 0),
          seg2: String(product.daily_consumption.seg2 ?? product.daily_consumption.seg ?? 0),
        });
      } else {
        const perDay = roundVal(Number(product.avg_weekly_consumption) / 8);
        setDaily({
          seg: perDay,
          ter: perDay,
          qua: perDay,
          qui: perDay,
          sex: perDay,
          sab: perDay,
          dom: perDay,
          seg2: perDay,
        });
      }

      if (
        product.constant_daily_consumption !== undefined &&
        product.constant_daily_consumption !== null
      ) {
        setConstantDaily(String(product.constant_daily_consumption));
      } else {
        setConstantDaily(roundVal(Number(product.avg_weekly_consumption) / 8));
      }
    } else {
      setForm(empty);
      setConsumptionMode("constant");
      setConstantDaily("0");
      setDaily(emptyDaily);
    }
  }, [open, product]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Atualização no modo Consumo Constante (replicado para os 8 dias - Segunda a Segunda)
  const handleConstantChange = (val: string) => {
    setConstantDaily(val);
    const dailyNum = num(val);
    const weeklyTotal = roundVal(dailyNum * 8);
    setForm((f) => ({ ...f, avg_weekly_consumption: weeklyTotal }));
    setDaily({
      seg: val,
      ter: val,
      qua: val,
      qui: val,
      sex: val,
      sab: val,
      dom: val,
      seg2: val,
    });
  };

  // Atualização em um dia individual no modo Personalizado
  const handleDayChange = (day: DayOfWeek, val: string) => {
    const updatedDaily = { ...daily, [day]: val };
    setDaily(updatedDaily);
    const sum = sumDailyConsumption({
      seg: num(updatedDaily.seg),
      ter: num(updatedDaily.ter),
      qua: num(updatedDaily.qua),
      qui: num(updatedDaily.qui),
      sex: num(updatedDaily.sex),
      sab: num(updatedDaily.sab),
      dom: num(updatedDaily.dom),
      seg2: num(updatedDaily.seg2),
    });
    setForm((f) => ({ ...f, avg_weekly_consumption: roundVal(sum) }));
  };

  // Troca de modo de consumo
  const handleModeChange = (mode: ConsumptionMode) => {
    setConsumptionMode(mode);
    if (mode === "constant") {
      const currentWeekly = num(form.avg_weekly_consumption);
      const perDay = roundVal(currentWeekly / 8);
      setConstantDaily(perDay);
      setDaily({
        seg: perDay,
        ter: perDay,
        qua: perDay,
        qui: perDay,
        sex: perDay,
        sab: perDay,
        dom: perDay,
        seg2: perDay,
      });
    }
  };

  async function save() {
    if (!form.description.trim()) {
      toast.error("Informe a descrição do produto.");
      return;
    }

    setSaving(true);
    try {
      const dailyObj = {
        seg: num(daily.seg),
        ter: num(daily.ter),
        qua: num(daily.qua),
        qui: num(daily.qui),
        sex: num(daily.sex),
        sab: num(daily.sab),
        dom: num(daily.dom),
        seg2: num(daily.seg2),
      };

      await saveProduct(
        {
          description: form.description,
          code: form.code.trim() === "" ? null : Number(form.code),
          category_id: form.category_id || null,
          supplier_id: form.supplier_id || null,
          unit: form.unit,
          avg_weekly_consumption: num(form.avg_weekly_consumption),
          daily_consumption_mode: consumptionMode,
          daily_consumption: dailyObj,
          ...(consumptionMode === "constant"
            ? { constant_daily_consumption: num(constantDaily) }
            : {}),
          min_stock: num(form.min_stock),
          desired_stock: num(form.desired_stock),
          safety_stock: num(form.safety_stock),
          coverage_weeks: form.coverage_weeks.trim() === "" ? null : num(form.coverage_weeks),
          lead_time_days: Math.round(num(form.lead_time_days)),
          notes: form.notes.trim() || null,
          current_stock: num(form.current_stock),
        },
        product ? { id: product.id, current_stock: Number(product.current_stock) } : undefined,
      );

      toast.success(product ? "Produto atualizado." : "Produto cadastrado.");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            Defina o consumo diário por dia da semana ou use consumo constante padrão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="desc">Descrição do produto</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Ex.: Filé Mignon"
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
                  const result = await saveUnit(code, name);
                  invalidate();
                  set("unit")(result.code);
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
                  const result = await saveCategory(name);
                  invalidate();
                  set("category_id")(result.id);
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
                  const result = await saveSupplier({ name: name.toUpperCase() });
                  invalidate();
                  set("supplier_id")(result.id);
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
            <Label htmlFor="lead">Prazo de entrega (dias)</Label>
            <Input
              id="lead"
              inputMode="numeric"
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days")(e.target.value)}
            />
          </div>

          {/* Configuração de Consumo Diário e Semanal (Segunda a Segunda - 8 dias) */}
          <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  Consumo Diário (Segunda a Segunda — 8 dias)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina manualmente o consumo de cada um dos 8 dias (Seg a Seg) ou use a semana
                  padrão para replicar para todos os dias.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-normal"
                  onClick={() => {
                    const baseVal = constantDaily || "10";
                    handleConstantChange(baseVal);
                    toast.info(`Replicado ${baseVal} ${form.unit}/dia para os 8 dias (Seg a Seg)`);
                  }}
                >
                  Replicar {constantDaily || "10"} p/ os 8 dias
                </Button>
              </div>
            </div>

            {/* Atalho / Flag de Semana Padrão (Replicação Automática) */}
            <div className="rounded-md border bg-background/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="standard-week-val" className="text-xs font-medium text-foreground">
                  Semana Padrão (Consumo Diário Fixo)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Digite um valor fixo por dia para replicar automaticamente para os 8 dias (Segunda
                  a Segunda, ex.: 10 {form.unit}/dia).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-28">
                  <Input
                    id="standard-week-val"
                    inputMode="decimal"
                    value={constantDaily}
                    onChange={(e) => handleConstantChange(e.target.value)}
                    placeholder="Ex.: 10"
                    className="num h-8 text-xs text-right pr-7"
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">
                    /dia
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleConstantChange(constantDaily || "0")}
                >
                  Aplicar aos 8 dias
                </Button>
              </div>
            </div>

            {/* Inputs individuais para cada DIA (Seg, Ter, Qua, Qui, Sex, Sáb, Dom, Seg 2) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">
                  Ajuste manual dia por dia (8 dias):
                </span>
                <span className="text-xs text-muted-foreground">
                  Altere individualmente qualquer dia abaixo
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-md border bg-card p-2 text-center transition-colors focus-within:ring-1 focus-within:ring-primary focus-within:border-primary"
                  >
                    <Label
                      htmlFor={`day-${d.key}`}
                      className="block text-[11px] font-bold text-foreground/80 uppercase"
                    >
                      {d.short}
                    </Label>
                    <span className="block text-[9px] text-muted-foreground truncate mb-1">
                      {d.key === "seg2" ? "2ª Segunda" : d.label.split("-")[0]}
                    </span>
                    <Input
                      id={`day-${d.key}`}
                      inputMode="decimal"
                      value={daily[d.key]}
                      onChange={(e) => handleDayChange(d.key, e.target.value)}
                      placeholder="0"
                      className="num h-8 text-center text-xs px-1 font-bold bg-background"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Totalizador semanal calculado em tempo real */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md bg-muted/60 px-3 py-2 border gap-1">
              <div className="text-xs flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  Consumo Total (Soma dos 8 dias — Seg a Seg):
                </span>
                <span className="font-bold text-foreground text-sm">
                  {form.avg_weekly_consumption} {form.unit}/período
                </span>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal w-fit">
                Média: {roundVal(num(form.avg_weekly_consumption) / 8)} {form.unit}/dia
              </Badge>
            </div>
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

        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-5 items-center">
          <Preview label="Estoque atual" value={preview.current} unit={form.unit} />
          <Preview label="Consumo semanal" value={preview.consumption} unit={form.unit} />
          <Preview label="Compra sugerida" value={preview.suggestedPurchase} unit={form.unit} />
          <Preview label="Estoque futuro" value={preview.futureStock} unit={form.unit} />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Status Futuro
            </p>
            <StatusBadge status={preview.futureStatus} />
          </div>
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
