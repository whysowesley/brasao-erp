import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  History,
  LayoutGrid,
  Save,
  Search,
  Table as TableIcon,
  UserCheck,
  CheckCircle2,
  RotateCcw,
  Plus,
  Minus,
  AlertCircle,
  Trash2,
  Sparkles,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { AdjustCountDialog } from "@/components/AdjustCountDialog";
import { PageHeader } from "@/components/PageHeader";
import { PlanInput } from "@/components/PlanInput";
import { WhatsAppStockImportDialog } from "@/components/WhatsAppStockImportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useMe } from "@/lib/auth";
import {
  recordStockCount,
  useCounts,
  useInvalidateAll,
  useProducts,
  useRules,
  type StockCountRow,
} from "@/lib/data";
import {
  computeProduct,
  DEFAULT_RULES,
  formatDateTime,
  formatQty,
  getDayOfWeekFromDate,
} from "@/lib/inventory";
import { usePostOperationMode } from "@/lib/post-operation";
import { usePurchasePlan } from "@/lib/purchase-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contagens")({
  head: () => ({
    meta: [
      { title: "Contagens de Estoque | Brasão" },
      {
        name: "description",
        content:
          "Realize contagens periódicas do estoque da Brasão, registre diferenças e atualize o estoque automaticamente.",
      },
      { property: "og:title", content: "Contagens de Estoque | Brasão" },
      {
        property: "og:description",
        content: "Nova contagem com cálculo automático de diferenças e histórico completo.",
      },
    ],
  }),
  component: ContagensPage,
});

const DRAFT_KEY = "brasao:contagem-draft-v2";
const VIEW_PREF_KEY = "brasao:contagem-viewmode";

function ContagensPage() {
  const { data: me } = useMe();
  const { isCounter } = useAuth();
  const { data: products } = useProducts();
  const { data: counts } = useCounts();
  const { data: rules } = useRules();
  const invalidate = useInvalidateAll();
  const [isPostOperation, setIsPostOperation] = usePostOperationMode();

  // Estados de Filtros e Busca
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendentes" | "contados">("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  // Rascunho pré-salvo no dispositivo: inicia lendo do localStorage para nunca perder o progresso
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.values === "object" && parsed.values !== null) {
          return parsed.values;
        }
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [notes, setNotes] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.notes === "string") {
          return parsed.notes;
        }
      }
    } catch {
      // ignore
    }
    return "";
  });

  const [draftRecoveredCount, setDraftRecoveredCount] = useState<number>(() => {
    return Object.values(values).filter((v) => v && v.trim() !== "").length;
  });

  const [saving, setSaving] = useState(false);

  // Modo de visualização: no celular (largura < 768px), o padrão intuitivo é 'cards' para deslizar facilmente
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    const saved = window.localStorage.getItem(VIEW_PREF_KEY);
    if (saved === "table" || saved === "cards") return saved;
    return window.innerWidth < 768 ? "cards" : "table";
  });

  const handleSetViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_PREF_KEY, mode);
    } catch {
      // ignore
    }
  };

  const { plan, setPlanned } = usePurchasePlan();

  // Estados para alteração/ajuste e expansão de detalhes
  const [adjustingCount, setAdjustingCount] = useState<StockCountRow | null>(null);
  const [expandedCountIds, setExpandedCountIds] = useState<Set<string>>(new Set());

  // Auto-salva qualquer valor digitado imediatamente no localStorage do dispositivo
  useEffect(() => {
    if (typeof window === "undefined") return;
    const filledEntries = Object.entries(values).filter(([, v]) => v && v.trim() !== "");
    try {
      if (filledEntries.length > 0 || notes.trim()) {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            values,
            notes,
            updatedAt: Date.now(),
          }),
        );
      } else {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // ignore quota
    }
  }, [values, notes]);

  const clearDraft = () => {
    setValues({});
    setNotes("");
    setDraftRecoveredCount(0);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    toast.info("Rascunho de contagem descartado.");
  };

  // Mapeia a contagem anterior de cada produto para mostrar um número discreto de referência
  const previousCountMap = useMemo(() => {
    const map = new Map<string, { counted: number; date: string }>();
    if (!counts) return map;
    for (const c of counts) {
      if (!c.stock_count_items) continue;
      for (const item of c.stock_count_items) {
        if (item.product_id && !map.has(item.product_id)) {
          map.set(item.product_id, {
            counted: Number(item.counted_quantity) || 0,
            date: c.counted_at,
          });
        }
      }
    }
    return map;
  }, [counts]);

  // Lista de categorias disponíveis
  const categoriesList = useMemo(() => {
    const set = new Map<string, string>();
    (products ?? []).forEach((p) => {
      if (p.categories?.name && p.category_id) {
        set.set(p.category_id, p.categories.name);
      }
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const toggleExpand = (id: string) => {
    setExpandedCountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filledCount = useMemo(() => {
    return Object.entries(values).filter(([, v]) => v && v.trim() !== "").length;
  }, [values]);

  const rows = useMemo(() => {
    let list = products ?? [];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.description.toLowerCase().includes(term) ||
          (p.categories?.name && p.categories.name.toLowerCase().includes(term)),
      );
    }

    if (categoryFilter !== "todas") {
      list = list.filter((p) => p.category_id === categoryFilter);
    }

    if (filterStatus === "pendentes") {
      list = list.filter((p) => {
        const val = values[p.id];
        return !val || val.trim() === "";
      });
    } else if (filterStatus === "contados") {
      list = list.filter((p) => {
        const val = values[p.id];
        return val && val.trim() !== "";
      });
    }

    return list;
  }, [products, search, categoryFilter, filterStatus, values]);

  const filled = Object.entries(values).filter(([, v]) => v.trim() !== "");

  // Manipuladores de ajuste rápido para o usuário no celular (+1, -1, copiar sistema)
  const adjustQuickValue = (productId: string, currentSysStock: number, delta: number) => {
    setValues((prev) => {
      const currentValStr = prev[productId] ?? "";
      let baseNum =
        currentValStr.trim() !== "" ? Number(currentValStr.replace(",", ".")) : currentSysStock;
      if (Number.isNaN(baseNum)) baseNum = 0;
      const nextNum = Math.max(0, Math.round((baseNum + delta) * 100) / 100);
      return { ...prev, [productId]: String(nextNum) };
    });
  };

  const setExactValue = (productId: string, num: number) => {
    const safe = Math.max(0, num);
    setValues((prev) => ({ ...prev, [productId]: String(safe) }));
  };

  async function confirm() {
    if (filled.length === 0) {
      toast.error("Informe ao menos uma quantidade encontrada.");
      return;
    }
    setSaving(true);
    try {
      const itemsToRecord: Array<{ productId: string; expected: number; counted: number }> = [];
      for (const [productId, raw] of filled) {
        const product = (products ?? []).find((p) => p.id === productId);
        if (!product) continue;
        const counted = Number(raw.replace(",", ".")) || 0;
        const expected = Number(product.current_stock);
        itemsToRecord.push({
          productId,
          expected,
          counted,
        });
      }

      await recordStockCount(notes.trim() || null, itemsToRecord, {
        name: me?.fullName,
        email: me?.email,
        userId: me?.userId,
      });

      // Limpa dados e rascunho com sucesso
      setValues({});
      setNotes("");
      setDraftRecoveredCount(0);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }

      invalidate();
      toast.success("Contagem registrada com sucesso e estoque atualizado!");
    } catch (e) {
      // SE DER ERRO OU QUEDA DE REDE: O RASCUNHO CONTINUA SALVO NO LOCALSTORAGE!
      toast.error(
        `Erro ao salvar contagem: ${(e as Error).message}. Seus dados digitados permanecem salvos no dispositivo!`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      <PageHeader
        title="Nova Contagem"
        description="Informe a quantidade encontrada. A contagem anterior é exibida como referência discreta."
        actions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <div
              className="flex items-center gap-2 rounded-md border bg-card px-2 sm:px-2.5 py-1 text-xs cursor-pointer shadow-xs hover:bg-muted/40 transition-colors"
              onClick={() => setIsPostOperation(!isPostOperation)}
              title="Pós-operação: o dia de hoje já encerrou e foi consumido. O estoque contado atenderá a partir de amanhã até a 2ª feira. Ex: Sábado à noite conta 2 dias de consumo (Dom e Seg) em vez de 3."
            >
              <Switch
                id="post-op-contagens"
                checked={isPostOperation}
                onCheckedChange={setIsPostOperation}
                onClick={(e) => e.stopPropagation()}
              />
              <Label
                htmlFor="post-op-contagens"
                className="cursor-pointer font-medium select-none text-[10px] sm:text-[11px] leading-tight text-foreground"
              >
                {isPostOperation
                  ? "Pós-operação (Hoje já usado)"
                  : "Pré-operação (Hoje ainda será usado)"}
              </Label>
            </div>
            <WhatsAppStockImportDialog
              onApplyToTable={(newValues) => {
                setValues((prev) => ({ ...prev, ...newValues }));
              }}
            />
            <Button
              onClick={confirm}
              disabled={saving || filled.length === 0}
              className="h-8 sm:h-9 text-xs sm:text-sm gap-1.5"
            >
              <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Confirmar contagem</span>
              <span className="sm:hidden">Salvar</span> ({filled.length})
            </Button>
          </div>
        }
      />

      {/* Banner de Rascunho Pré-Salvo / Proteção contra queda de net */}
      {draftRecoveredCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-primary/20 text-primary shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Rascunho ativo: {draftRecoveredCount} produto(s) pré-salvos no seu aparelho
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cada quantidade digitada é salva instantaneamente. Se a conexão cair ou houver erro,
                nada é perdido.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDraft}
              className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Descartar rascunho
            </Button>
          </div>
        </div>
      )}

      {/* Barra de Filtros, Busca e Alternância de Visualização */}
      <div className="space-y-2.5 rounded-lg border bg-card p-3 shadow-xs">
        <div className="grid gap-2 sm:gap-3 grid-cols-1 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm"
              placeholder="Pesquisar produto ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 sm:h-9 text-xs sm:text-sm flex-1"
              placeholder="Observação da contagem (opcional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {/* Alternador de Modo: Tabela vs Cartões */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSetViewMode("cards")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "cards"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Modo Cartões Otimizado para Celular"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cartões</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("table")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Modo Tabela Compacta"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chips de Filtro para Navegação Rápida no Celular */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              size="sm"
              variant={filterStatus === "todos" ? "default" : "outline"}
              onClick={() => setFilterStatus("todos")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              Todos ({products?.length ?? 0})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === "pendentes" ? "default" : "outline"}
              onClick={() => setFilterStatus("pendentes")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              Pendentes ({Math.max(0, (products?.length ?? 0) - filledCount)})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === "contados" ? "default" : "outline"}
              onClick={() => setFilterStatus("contados")}
              className="h-7 px-2.5 text-[11px] rounded-full"
            >
              <Check className="h-3 w-3 mr-1" />
              Contados ({filledCount})
            </Button>
          </div>

          {categoriesList.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Categoria:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden"
              >
                <option value="todas">Todas as categorias</option>
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Visualização em Cartões Móveis (Deslizar Fácil e Intuitivo no Celular) */}
      {viewMode === "cards" ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const raw = values[p.id] ?? "";
            const hasCount = raw.trim() !== "";
            const countedNum = hasCount
              ? Number(raw.replace(",", ".")) || 0
              : Number(p.current_stock);
            const diff = hasCount ? countedNum - Number(p.current_stock) : null;
            const prev = previousCountMap.get(p.id);
            const computedItem = computeProduct(
              { ...p, current_stock: countedNum },
              rules ?? DEFAULT_RULES,
              0,
              getDayOfWeekFromDate(),
              isPostOperation,
              hasCount,
            );

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border bg-card p-3.5 shadow-xs space-y-3 transition-all",
                  hasCount
                    ? "border-emerald-500/50 bg-emerald-500/[0.03] ring-1 ring-emerald-500/20"
                    : "hover:border-primary/40",
                )}
              >
                {/* Cabeçalho do Card com Nome e Tag de Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm text-foreground leading-snug">
                        {p.description}
                      </h3>
                      {hasCount && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shrink-0 font-medium"
                        >
                          <Check className="h-2.5 w-2.5 mr-0.5" /> Contado
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {p.unit}
                      </Badge>
                      {p.categories?.name && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                          {p.categories.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-muted/30 px-2 py-1 rounded-md border">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Sistema
                    </span>
                    <span className="num font-mono text-xs font-bold text-foreground">
                      {formatQty(p.current_stock, p.unit)}
                    </span>
                  </div>
                </div>

                {/* Linha Central: Referência Anterior e Campo de Digitação Grande */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  {/* Número discreto da contagem anterior */}
                  <div
                    className="flex flex-col text-[11px]"
                    title={
                      prev
                        ? `Última contagem em ${formatDateTime(prev.date)}: ${formatQty(prev.counted, p.unit)}`
                        : "Nenhuma contagem anterior registrada"
                    }
                  >
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/75 font-semibold">
                      Ant. contada:
                    </span>
                    <span className="font-mono font-medium text-foreground/90">
                      {prev ? formatQty(prev.counted, p.unit) : "—"}
                    </span>
                  </div>

                  {/* Input touch com botões rápidos de incremento para celular */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustQuickValue(p.id, Number(p.current_stock), -1)}
                      className="h-8 w-7 flex items-center justify-center rounded-md border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs font-bold shrink-0 transition-colors"
                      title="Diminuir 1"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <Input
                      className="num h-8 w-20 text-center text-sm font-bold bg-background shadow-xs"
                      inputMode="decimal"
                      placeholder="0"
                      value={raw}
                      onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuickValue(p.id, Number(p.current_stock), 1)}
                      className="h-8 w-7 flex items-center justify-center rounded-md border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs font-bold shrink-0 transition-colors"
                      title="Aumentar 1"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Ações rápidas de 1 toque no celular */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExactValue(p.id, Number(p.current_stock))}
                      className="text-[10px] text-muted-foreground hover:text-primary bg-muted/40 hover:bg-muted px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Repete a quantidade que já está no sistema"
                    >
                      Copiar Sist. ({p.current_stock})
                    </button>
                    {prev && (
                      <button
                        type="button"
                        onClick={() => setExactValue(p.id, prev.counted)}
                        className="text-[10px] text-muted-foreground hover:text-primary bg-muted/40 hover:bg-muted px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title="Repete a contagem anterior"
                      >
                        Repetir Ant. ({prev.counted})
                      </button>
                    )}
                  </div>

                  {/* Diferença em destaque */}
                  {diff !== null && (
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span className="text-[10px] text-muted-foreground font-sans">Dif:</span>
                      <span
                        className={`font-bold ${
                          diff < 0
                            ? "text-critical"
                            : diff > 0
                              ? "text-success"
                              : "text-muted-foreground"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatQty(diff, p.unit)}
                      </span>
                    </div>
                  )}
                </div>

                {!isCounter && (
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t text-xs">
                    <span className="text-[10px] text-muted-foreground">
                      Comprar (sug: {formatQty(Math.ceil(computedItem.suggestedPurchase), p.unit)}):
                    </span>
                    <PlanInput
                      className="num h-7 w-20 text-right text-xs"
                      roundUp={true}
                      value={
                        plan[p.id] !== undefined
                          ? plan[p.id] > 0
                            ? Math.ceil(plan[p.id])
                            : 0
                          : computedItem.suggestedPurchase > 0
                            ? Math.ceil(computedItem.suggestedPurchase)
                            : 0
                      }
                      onChange={(val) => setPlanned(p.id, val)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Tabela Compacta com Coluna Fixa */
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%] sm:w-auto sticky left-0 bg-card z-10 shadow-xs">
                    Produto
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    <span className="hidden sm:inline">Estoque registrado</span>
                    <span className="sm:hidden">Sistema</span>
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    <span className="hidden sm:inline">Quantidade encontrada</span>
                    <span className="sm:hidden">Contado</span>
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    <span className="hidden sm:inline">Diferença</span>
                    <span className="sm:hidden">Dif.</span>
                  </TableHead>
                  {!isCounter && (
                    <TableHead className="text-right whitespace-nowrap">
                      <span className="hidden sm:inline">Quero comprar</span>
                      <span className="sm:hidden">Comprar</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const raw = values[p.id] ?? "";
                  const hasCount = raw.trim() !== "";
                  const countedNum = hasCount
                    ? Number(raw.replace(",", ".")) || 0
                    : Number(p.current_stock);
                  const diff = hasCount ? countedNum - Number(p.current_stock) : null;
                  const prev = previousCountMap.get(p.id);
                  const computedItem = computeProduct(
                    { ...p, current_stock: countedNum },
                    rules ?? DEFAULT_RULES,
                    0,
                    getDayOfWeekFromDate(),
                    isPostOperation,
                    hasCount,
                  );
                  return (
                    <TableRow key={p.id} className={hasCount ? "bg-emerald-500/[0.03]" : undefined}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-none text-xs sm:text-sm font-semibold">
                            {p.description}
                          </span>
                          {hasCount && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground sm:hidden">
                          {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="num text-right text-xs sm:text-sm">
                        {formatQty(p.current_stock, p.unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <Input
                            className="num ml-auto h-7 sm:h-8 w-20 sm:w-28 text-right text-xs sm:text-sm font-semibold"
                            inputMode="decimal"
                            value={raw}
                            onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                          />
                          {/* Número discreto da contagem anterior logo abaixo da digitação */}
                          <div
                            className="inline-flex items-center justify-end gap-1 text-[10px] text-muted-foreground/80 font-normal select-none"
                            title={
                              prev
                                ? `Última contagem em ${formatDateTime(prev.date)}: ${formatQty(prev.counted, p.unit)}`
                                : "Nenhuma contagem anterior"
                            }
                          >
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                              Ant:
                            </span>
                            <span className="font-mono font-medium text-foreground/85">
                              {prev ? formatQty(prev.counted, p.unit) : "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`num text-right font-medium text-xs sm:text-sm ${
                          diff === null ? "" : diff < 0 ? "text-critical" : "text-success"
                        }`}
                      >
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff, p.unit)}`}
                      </TableCell>
                      {!isCounter && (
                        <TableCell className="text-right">
                          <PlanInput
                            className="num ml-auto h-7 sm:h-8 w-20 sm:w-24 text-right text-xs sm:text-sm"
                            roundUp={true}
                            value={
                              plan[p.id] !== undefined
                                ? plan[p.id] > 0
                                  ? Math.ceil(plan[p.id])
                                  : 0
                                : computedItem.suggestedPurchase > 0
                                  ? Math.ceil(computedItem.suggestedPurchase)
                                  : 0
                            }
                            onChange={(val) => setPlanned(p.id, val)}
                          />
                          <div
                            className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5"
                            title={`Saldo 2ª: ${formatQty(computedItem.projectedCycleEndStock, p.unit)} (${computedItem.remainingDaysLabel})`}
                          >
                            sug: {formatQty(Math.ceil(computedItem.suggestedPurchase), p.unit)}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Barra Flutuante de Ação no Rodapé para Celular (Fácil acesso ao polegar) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-2.5 sm:hidden bg-card/95 backdrop-blur-md border-t shadow-lg flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {filledCount} de {products?.length ?? 0} contados
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block truncate">Salvo localmente</span>
        </div>
        <Button
          onClick={confirm}
          disabled={saving || filled.length === 0}
          size="sm"
          className="gap-1.5 h-8 text-xs shrink-0 shadow-md"
        >
          <Save className="h-3.5 w-3.5" />
          Finalizar Contagem ({filled.length})
        </Button>
      </div>

      <div className="mt-6 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Contagens Anteriores &amp; Histórico Auditado</h2>
          <p className="text-xs text-muted-foreground">
            Visualize lançamentos passados, consulte a auditoria de alterações ou corrija
            quantidades digitadas erroneamente.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {counts?.map((c) => {
          const isExpanded = expandedCountIds.has(c.id);
          const hasAudits = Boolean(c.audit_logs && c.audit_logs.length > 0);

          return (
            <div
              key={c.id}
              className="rounded-lg border bg-card p-3 sm:p-4 shadow-card transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <p className="text-xs sm:text-sm font-bold text-foreground">
                      {formatDateTime(c.counted_at)}
                    </p>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      {c.stock_count_items?.length ?? 0} item(ns)
                    </Badge>
                    {hasAudits && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-[9px] sm:text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        <History className="h-3 w-3 mr-1" />
                        {c.audit_logs?.length} alteração(ões) auditada(s)
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      Responsável: <strong>{c.user_name}</strong>
                      {c.user_email ? ` (${c.user_email})` : ""}
                    </span>
                  </div>
                  {c.notes && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground italic">
                      Observação: {c.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 sm:h-8 gap-1 text-xs"
                    onClick={() => toggleExpand(c.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span>Ver Itens</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 sm:h-8 gap-1.5 text-xs font-medium border border-border"
                    onClick={() => setAdjustingCount(c)}
                    title="Corrigir quantidade digitada nesta contagem"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-primary" />
                    <span>Alterar Contagem</span>
                  </Button>
                </div>
              </div>

              {/* Seção expandida de itens e auditoria */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Produtos Lançados nesta Contagem
                    </h3>
                    <div className="rounded-md border max-h-60 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-right text-xs">Estoque Anterior</TableHead>
                            <TableHead className="text-right text-xs">Qtd Contada</TableHead>
                            <TableHead className="text-right text-xs">Diferença Gerada</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {c.stock_count_items.map((it) => {
                            const diff = it.difference;
                            return (
                              <TableRow key={it.id}>
                                <TableCell className="text-xs font-medium">
                                  {it.products?.description || "Produto"}
                                </TableCell>
                                <TableCell className="text-right text-xs num text-muted-foreground">
                                  {formatQty(it.expected_quantity, it.products?.unit || "UN")}
                                </TableCell>
                                <TableCell className="text-right text-xs num font-semibold">
                                  {formatQty(it.counted_quantity, it.products?.unit || "UN")}
                                </TableCell>
                                <TableCell
                                  className={`text-right text-xs font-semibold num ${
                                    diff < 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : diff > 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {diff > 0 ? "+" : ""}
                                  {formatQty(diff, it.products?.unit || "UN")}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Log de Auditoria de quem alterou */}
                  {hasAudits && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>Histórico de Alterações / Ajustes (Log de Auditoria)</span>
                      </div>
                      <div className="space-y-2">
                        {c.audit_logs?.map((audit, aIdx) => (
                          <div
                            key={aIdx}
                            className="rounded-md border bg-card p-2 text-xs shadow-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                              <span>
                                <strong>Data do Ajuste:</strong> {formatDateTime(audit.adjusted_at)}
                              </span>
                              <span>
                                <strong>Quem Alterou:</strong> {audit.user_name}
                                {audit.user_email ? ` (${audit.user_email})` : ""}
                              </span>
                            </div>
                            <div className="text-xs">
                              <span className="font-semibold text-foreground">Justificativa: </span>
                              <span className="text-muted-foreground italic">"{audit.reason}"</span>
                            </div>
                            {audit.items_changed && audit.items_changed.length > 0 && (
                              <div className="mt-1 pt-1 border-t text-[11px] space-y-0.5">
                                <span className="font-semibold text-foreground">
                                  Itens retificados:
                                </span>
                                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                                  {audit.items_changed.map((ic, iIdx) => (
                                    <li key={iIdx}>
                                      <strong>{ic.product_description}</strong>: alterado de{" "}
                                      <span className="line-through">
                                        {formatQty(ic.previous_counted, ic.unit)}
                                      </span>{" "}
                                      para{" "}
                                      <strong className="text-foreground">
                                        {formatQty(ic.new_counted, ic.unit)}
                                      </strong>{" "}
                                      (impacto no estoque:{" "}
                                      <span
                                        className={
                                          ic.difference_delta > 0
                                            ? "text-emerald-600 font-semibold"
                                            : "text-rose-600 font-semibold"
                                        }
                                      >
                                        {ic.difference_delta > 0 ? "+" : ""}
                                        {formatQty(ic.difference_delta, ic.unit)}
                                      </span>
                                      )
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(counts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma contagem registrada ainda.</p>
        )}
      </div>

      {/* Diálogo de alteração de contagem com auditoria */}
      <AdjustCountDialog
        count={adjustingCount}
        open={Boolean(adjustingCount)}
        onOpenChange={(isOpen) => !isOpen && setAdjustingCount(null)}
        onSuccess={() => {
          invalidate();
        }}
      />
    </div>
  );
}
