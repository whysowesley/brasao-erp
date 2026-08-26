import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { applyMovement, useInvalidateAll, useProducts } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar Planilha | Brasão" },
      {
        name: "description",
        content:
          "Atualize estoque e consumo semanal dos produtos da Brasão importando uma planilha Excel ou CSV.",
      },
      { property: "og:title", content: "Importar Planilha | Brasão" },
      {
        property: "og:description",
        content: "Importação de estoque e consumo a partir de Excel ou CSV.",
      },
    ],
  }),
  component: ImportarPage,
});

type Row = Record<string, unknown>;

function norm(v: unknown) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function num(v: unknown) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function ImportarPage() {
  const { data: products } = useProducts();
  const invalidate = useInvalidateAll();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function handleFile(file: File) {
    setBusy(true);
    setLog([]);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) throw new Error("Planilha vazia.");
      const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[firstSheet]!, { defval: "" });
      const messages: string[] = [];
      let updated = 0;

      for (const row of rows) {
        const keys = Object.keys(row);
        const descKey = keys.find((k) => /produto|descri/i.test(k));
        const stockKey = keys.find((k) => /estoque/i.test(k));
        const consKey = keys.find((k) => /consumo/i.test(k));
        if (!descKey) continue;
        const description = norm(row[descKey]);
        if (!description) continue;
        const product = (products ?? []).find((p) => norm(p.description) === description);
        if (!product) {
          messages.push(`Não encontrado: ${description}`);
          continue;
        }
        if (consKey) {
          await supabase
            .from("products")
            .update({ avg_weekly_consumption: num(row[consKey]) })
            .eq("id", product.id);
        }
        if (stockKey) {
          const newQty = num(row[stockKey]);
          if (newQty !== Number(product.current_stock)) {
            await applyMovement({
              productId: product.id,
              type: "ajuste",
              newQuantity: newQty,
              notes: "Importação de planilha",
            });
          }
        }
        updated += 1;
      }

      invalidate();
      setLog([`${updated} produto(s) atualizado(s).`, ...messages.slice(0, 30)]);
      toast.success(`${updated} produto(s) atualizado(s).`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Importar planilha"
        description="Atualize estoque atual e consumo semanal a partir de um arquivo Excel ou CSV."
      />

      <div className="rounded-lg border bg-card p-6 shadow-card">
        <p className="text-sm text-muted-foreground">
          A planilha deve conter uma coluna com o nome do produto (Produto/Descrição) e, opcionalmente,
          colunas de Estoque e Consumo. Os produtos são identificados pelo nome já cadastrado.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button disabled variant="outline">
            <Upload className="h-4 w-4" /> {busy ? "Importando..." : "Aguardando arquivo"}
          </Button>
        </div>

        {log.length > 0 && (
          <ul className="mt-5 space-y-1 border-t pt-4 text-xs text-muted-foreground">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
