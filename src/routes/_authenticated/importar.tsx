import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
  Package,
  RefreshCw,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/integrations/firebase/config";
import { applyMovement, useInvalidateAll } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar Produtos e Fornecedores | Brasão" },
      {
        name: "description",
        content:
          "Importe produtos com Código, Embalagem e Fornecedor automaticamente a partir de uma planilha Excel ou CSV.",
      },
      { property: "og:title", content: "Importar Produtos e Fornecedores | Brasão" },
      {
        property: "og:description",
        content:
          "Importação de planilha com Código (A), Produto (B), Embalagem (C) e Fornecedor (D).",
      },
    ],
  }),
  component: ImportarPage,
});

type ImportStats = {
  totalRows: number;
  newSuppliers: number;
  newProducts: number;
  updatedProducts: number;
  skippedRows: number;
};

function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function cleanString(v: unknown): string {
  return String(v ?? "").trim();
}

function parseCode(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const str = String(v).trim();
  const n = Number(str.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const str = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(str);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function ImportarPage() {
  const invalidate = useInvalidateAll();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [logs, setLogs] = useState<
    Array<{ type: "success" | "info" | "warning" | "error"; text: string }>
  >([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Função para baixar a planilha modelo em Excel (.xlsx) com as colunas A: Código, B: Produto, C: Embalagem, D: Fornecedor
  function handleDownloadTemplate() {
    const templateData = [
      {
        Código: 101,
        Produto: "Queijo Mussarela Barra 4kg",
        Embalagem: "KG",
        Fornecedor: "Laticínios Central",
        "Estoque Atual": 24,
        "Consumo Semanal": 70,
      },
      {
        Código: 102,
        Produto: "Molho de Tomate Tradicional 2kg",
        Embalagem: "UN",
        Fornecedor: "Distribuidora Modelo Ltda",
        "Estoque Atual": 30,
        "Consumo Semanal": 50,
      },
      {
        Código: 103,
        Produto: "Farinha de Trigo Especial 25kg",
        Embalagem: "KG",
        Fornecedor: "Moinho São José",
        "Estoque Atual": 100,
        "Consumo Semanal": 160,
      },
      {
        Código: 104,
        Produto: "Bacon Fatiado Premium",
        Embalagem: "KG",
        Fornecedor: "Frigorífico Boi Gordo",
        "Estoque Atual": 15,
        "Consumo Semanal": 40,
      },
      {
        Código: 105,
        Produto: "Caixa de Embalagem para Pizza",
        Embalagem: "CX",
        Fornecedor: "Embalagens Express",
        "Estoque Atual": 500,
        "Consumo Semanal": 800,
      },
      {
        Código: 106,
        Produto: "Refrigerante Cola 2L",
        Embalagem: "FD",
        Fornecedor: "Bebidas & Cia",
        "Estoque Atual": 40,
        "Consumo Semanal": 90,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Ajusta a largura das colunas
    ws["!cols"] = [
      { wch: 12 }, // Coluna A: Código
      { wch: 38 }, // Coluna B: Produto
      { wch: 14 }, // Coluna C: Embalagem
      { wch: 32 }, // Coluna D: Fornecedor
      { wch: 16 }, // Coluna E: Estoque Atual (Opcional)
      { wch: 18 }, // Coluna F: Consumo Semanal (Opcional)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos e Fornecedores");
    XLSX.writeFile(wb, "modelo_produtos_fornecedores_brasao.xlsx");
    toast.success("Modelo baixado com sucesso!");
  }

  // Processamento do Arquivo Excel/CSV
  async function handleFile(file: File) {
    setBusy(true);
    setFileName(file.name);
    setLogs([]);
    setStats(null);

    const stepLogs: Array<{ type: "success" | "info" | "warning" | "error"; text: string }> = [];

    try {
      stepLogs.push({ type: "info", text: `Lendo arquivo: ${file.name}...` });

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) throw new Error("A planilha está vazia.");

      const sheet = wb.Sheets[firstSheetName];
      if (!sheet) throw new Error("Não foi possível carregar a aba da planilha.");

      // Carrega linhas como objetos preservando as colunas
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (rawRows.length === 0) {
        throw new Error("Nenhum dado encontrado na planilha.");
      }

      stepLogs.push({
        type: "info",
        text: `Total de ${rawRows.length} linha(s) encontrada(s). Consultando banco de dados Firestore...`,
      });

      // 1. Carrega dados existentes do Firestore
      const [suppliersSnap, productsSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, "suppliers")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "categories")),
      ]);

      // Mapeamento em memória para rápida busca e atualização
      const suppliersMap = new Map<string, { id: string; name: string }>();
      suppliersSnap.docs.forEach((d) => {
        const data = d.data();
        const name = cleanString(data["name"]);
        if (name) {
          suppliersMap.set(norm(name), { id: d.id, name });
        }
      });

      const categoriesMap = new Map<string, { id: string; name: string }>();
      categoriesSnap.docs.forEach((d) => {
        const data = d.data();
        const name = cleanString(data["name"]);
        if (name) {
          categoriesMap.set(norm(name), { id: d.id, name });
        }
      });

      // Mapas de produtos por Código e por Descrição
      const productsByDesc = new Map<
        string,
        {
          id: string;
          code: number | null;
          description: string;
          unit: string;
          current_stock: number;
          supplier_id?: string | null;
        }
      >();
      const productsByCode = new Map<
        string,
        {
          id: string;
          code: number | null;
          description: string;
          unit: string;
          current_stock: number;
          supplier_id?: string | null;
        }
      >();

      productsSnap.docs.forEach((d) => {
        const data = d.data();
        const desc = cleanString(data["description"]);
        const c = data["code"] !== undefined && data["code"] !== null ? Number(data["code"]) : null;
        const item = {
          id: d.id,
          code: Number.isFinite(c) ? c : null,
          description: desc,
          unit: cleanString(data["unit"]) || "UN",
          current_stock: Number(data["current_stock"]) || 0,
          supplier_id: data["supplier_id"] || null,
        };

        if (desc) {
          productsByDesc.set(norm(desc), item);
        }
        if (item.code !== null) {
          productsByCode.set(String(item.code), item);
        }
      });

      let newSuppliersCount = 0;
      let newProductsCount = 0;
      let updatedProductsCount = 0;
      let skippedCount = 0;

      // 2. Itera sobre cada linha da planilha seguindo:
      // Coluna A: Código | Coluna B: Produto | Coluna C: Embalagem | Coluna D: Fornecedor
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row) continue;

        const keys = Object.keys(row);
        if (keys.length === 0) {
          skippedCount++;
          continue;
        }

        // Mapeamento Inteligente: por nome de cabeçalho ou por posição (A, B, C, D)
        const codeKey =
          keys.find((k) => /c[oó]d|c[oó]digo|sku|refer[eê]ncia/i.test(k)) ||
          (keys.length >= 4 ? keys[0] : undefined);
        const prodKey =
          keys.find((k) => /produto|descri|nome|item/i.test(k)) ||
          (keys.length >= 4 ? keys[1] : keys[0]);
        const unitKey =
          keys.find((k) => /embalagem|embal|unidade|unid|\bun\b|medida|tipo/i.test(k)) ||
          (keys.length >= 4 ? keys[2] : keys.length > 2 ? keys[2] : undefined);
        const supKey =
          keys.find((k) => /fornec|fabricante|distribuidor|supplier/i.test(k)) ||
          (keys.length >= 4 ? keys[3] : keys.length > 1 ? keys[1] : undefined);

        const stockKey = keys.find((k) => /estoque|saldo|qtd|quantidade/i.test(k));
        const consKey = keys.find((k) => /consumo|semanal|medio|média/i.test(k));
        const catKey = keys.find((k) => /categoria|cat|grupo|setor/i.test(k));

        const rawCode = codeKey ? parseCode(row[codeKey]) : null;
        const rawProd = prodKey ? cleanString(row[prodKey]) : "";
        const rawUnit = unitKey ? cleanString(row[unitKey]).toUpperCase() : "UN";
        const rawSup = supKey ? cleanString(row[supKey]) : "";
        const rawStock = stockKey ? parseNum(row[stockKey]) : 0;
        const rawCons = consKey ? parseNum(row[consKey]) : 0;
        const rawCat = catKey ? cleanString(row[catKey]).toUpperCase() : "";

        // Se a linha não tiver nome de produto, ignora
        if (!rawProd) {
          skippedCount++;
          continue;
        }

        // --- A. Gestão do Fornecedor (Coluna D) ---
        let supplierId: string | null = null;
        let supplierName: string | null = null;

        if (rawSup) {
          const supNorm = norm(rawSup);
          const existingSup = suppliersMap.get(supNorm);

          if (existingSup) {
            supplierId = existingSup.id;
            supplierName = existingSup.name;
          } else {
            // Cria o fornecedor automaticamente no Firestore
            const supDoc = await addDoc(collection(db, "suppliers"), {
              name: rawSup,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            });
            supplierId = supDoc.id;
            supplierName = rawSup;
            suppliersMap.set(supNorm, { id: supplierId, name: supplierName });
            newSuppliersCount++;
            stepLogs.push({
              type: "success",
              text: `[Novo Fornecedor] Cadastrado fornecedor "${rawSup}" na base de Fornecedores`,
            });
          }
        }

        // --- B. Gestão da Categoria (se houver) ---
        let categoryId: string | null = null;
        let categoryName: string | null = null;

        if (rawCat) {
          const catNorm = norm(rawCat);
          const existingCat = categoriesMap.get(catNorm);
          if (existingCat) {
            categoryId = existingCat.id;
            categoryName = existingCat.name;
          } else {
            const catDoc = await addDoc(collection(db, "categories"), {
              name: rawCat,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            });
            categoryId = catDoc.id;
            categoryName = rawCat;
            categoriesMap.set(catNorm, { id: categoryId, name: categoryName });
          }
        }

        // --- C. Gestão do Produto (Coluna A: Código, Coluna B: Produto, Coluna C: Embalagem) ---
        const prodNorm = norm(rawProd);
        const existingProd =
          (rawCode !== null ? productsByCode.get(String(rawCode)) : undefined) ||
          productsByDesc.get(prodNorm);

        if (existingProd) {
          // Atualiza produto existente
          const updatePayload: Record<string, unknown> = {
            description: rawProd,
            unit: rawUnit || existingProd.unit || "UN",
            updated_at: serverTimestamp(),
          };

          if (rawCode !== null) {
            updatePayload["code"] = rawCode;
          }
          if (supplierId) {
            updatePayload["supplier_id"] = supplierId;
            updatePayload["supplier_name"] = supplierName;
          }
          if (categoryId) {
            updatePayload["category_id"] = categoryId;
            updatePayload["category_name"] = categoryName;
          }
          if (rawCons > 0) {
            updatePayload["avg_weekly_consumption"] = rawCons;
          }

          await updateDoc(doc(db, "products", existingProd.id), updatePayload);

          // Se a planilha trouxe estoque e é diferente do atual, registra ajuste
          if (stockKey && rawStock !== existingProd.current_stock) {
            await applyMovement({
              productId: existingProd.id,
              type: "ajuste",
              newQuantity: rawStock,
              notes: "Ajuste via importação de planilha",
            });
            existingProd.current_stock = rawStock;
          }

          // Atualiza cache local de busca
          if (rawCode !== null) {
            existingProd.code = rawCode;
            productsByCode.set(String(rawCode), existingProd);
          }
          existingProd.description = rawProd;
          existingProd.unit = rawUnit || existingProd.unit;
          existingProd.supplier_id = supplierId;
          productsByDesc.set(prodNorm, existingProd);

          updatedProductsCount++;
          stepLogs.push({
            type: "info",
            text: `[Produto Atualizado] Cód: ${rawCode ?? existingProd.code ?? "—"} | ${rawProd} | Emb: ${rawUnit} | Fornecedor: ${supplierName || "Sem Fornecedor"}`,
          });
        } else {
          // Cadastra novo produto no Firestore
          const newProdDoc = await addDoc(collection(db, "products"), {
            code: rawCode,
            description: rawProd,
            unit: rawUnit || "UN",
            current_stock: stockKey ? rawStock : 0,
            avg_weekly_consumption: rawCons,
            daily_consumption_mode: "constant",
            min_stock: 0,
            desired_stock: 0,
            safety_stock: 0,
            lead_time_days: 7,
            category_id: categoryId,
            category_name: categoryName,
            supplier_id: supplierId,
            supplier_name: supplierName,
            active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });

          // Se tiver estoque inicial, registra contagem de estoque
          if (stockKey && rawStock > 0) {
            await applyMovement({
              productId: newProdDoc.id,
              type: "contagem",
              newQuantity: rawStock,
              notes: "Estoque inicial via importação de planilha",
            });
          }

          const createdItem = {
            id: newProdDoc.id,
            code: rawCode,
            description: rawProd,
            unit: rawUnit || "UN",
            current_stock: rawStock,
            supplier_id: supplierId,
          };

          productsByDesc.set(prodNorm, createdItem);
          if (rawCode !== null) {
            productsByCode.set(String(rawCode), createdItem);
          }

          newProductsCount++;
          stepLogs.push({
            type: "success",
            text: `[Novo Produto] Cód: ${rawCode ?? "—"} | ${rawProd} | Emb: ${rawUnit} | Fornecedor: ${supplierName || "Sem Fornecedor"}`,
          });
        }
      }

      // 3. Atualiza cache e encerra
      invalidate();

      const finalStats: ImportStats = {
        totalRows: rawRows.length,
        newSuppliers: newSuppliersCount,
        newProducts: newProductsCount,
        updatedProducts: updatedProductsCount,
        skippedRows: skippedCount,
      };

      setStats(finalStats);
      setLogs(stepLogs);

      toast.success(
        `Importação concluída com sucesso! ${newProductsCount} produtos cadastrados, ${updatedProductsCount} atualizados e ${newSuppliersCount} fornecedores vinculados.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao importar planilha.";
      stepLogs.push({ type: "error", text: `Erro: ${msg}` });
      setLogs(stepLogs);
      toast.error(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Importar Produtos & Fornecedores"
        description="Envie uma planilha Excel (.xlsx, .xls) ou CSV contendo as colunas de Código, Produto, Embalagem e Fornecedor para salvar tudo automaticamente no banco de dados."
        actions={
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="gap-2 text-xs sm:text-sm"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Baixar Planilha Modelo (.xlsx)</span>
          </Button>
        }
      />

      {/* Card Informativo com Regras da Planilha */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0 mt-0.5">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <h3 className="font-semibold text-foreground">
                Estrutura de Colunas para Importação:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                <div className="rounded-md border bg-card/80 p-2.5 shadow-xs">
                  <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Coluna A
                  </div>
                  <div className="font-bold text-foreground">Código</div>
                  <div className="text-[11px] text-muted-foreground">Ex: 101, 102, 1050</div>
                </div>
                <div className="rounded-md border bg-card/80 p-2.5 shadow-xs">
                  <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Coluna B
                  </div>
                  <div className="font-bold text-foreground">Produto</div>
                  <div className="text-[11px] text-muted-foreground">Ex: Queijo Mussarela 4kg</div>
                </div>
                <div className="rounded-md border bg-card/80 p-2.5 shadow-xs">
                  <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Coluna C
                  </div>
                  <div className="font-bold text-foreground">Embalagem</div>
                  <div className="text-[11px] text-muted-foreground">Ex: KG, UN, CX, FD, PCT</div>
                </div>
                <div className="rounded-md border bg-card/80 p-2.5 shadow-xs">
                  <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Coluna D
                  </div>
                  <div className="font-bold text-foreground">Fornecedor</div>
                  <div className="text-[11px] text-muted-foreground">Ex: Laticínios Central</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                * <strong>Criação Automática:</strong> Se o fornecedor informado na Coluna D ainda
                não existir, o sistema cadastra o fornecedor no banco e vincula imediatamente ao
                produto. Você também pode incluir colunas extras para <em>Estoque Atual</em> e{" "}
                <em>Consumo Semanal</em>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Área de Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span>Selecionar Arquivo Excel / CSV</span>
          </CardTitle>
          <CardDescription>
            Formatos aceitos: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              busy
                ? "bg-muted/40 border-muted"
                : "border-border hover:border-primary/60 hover:bg-muted/20 cursor-pointer"
            }`}
            onClick={() => {
              if (!busy && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="rounded-full bg-muted p-3">
                <Upload
                  className={`h-6 w-6 ${busy ? "animate-bounce text-primary" : "text-muted-foreground"}`}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {busy
                    ? "Processando e gravando no banco de dados..."
                    : "Clique para selecionar ou arraste o arquivo aqui"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fileName
                    ? `Último arquivo: ${fileName}`
                    : "O banco criará os fornecedores e produtos automaticamente"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo dos Resultados */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card">
            <CardContent className="pt-4 pb-4 flex flex-col items-center text-center">
              <Building2 className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-2xl font-bold text-foreground">{stats.newSuppliers}</span>
              <span className="text-xs text-muted-foreground">Novos Fornecedores</span>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4 flex flex-col items-center text-center">
              <Package className="h-5 w-5 text-emerald-500 mb-1" />
              <span className="text-2xl font-bold text-foreground">{stats.newProducts}</span>
              <span className="text-xs text-muted-foreground">Novos Produtos</span>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4 flex flex-col items-center text-center">
              <RefreshCw className="h-5 w-5 text-blue-500 mb-1" />
              <span className="text-2xl font-bold text-foreground">{stats.updatedProducts}</span>
              <span className="text-xs text-muted-foreground">Produtos Atualizados</span>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4 flex flex-col items-center text-center">
              <CheckCircle2 className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-bold text-foreground">{stats.totalRows}</span>
              <span className="text-xs text-muted-foreground">Total Linhas Lidas</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ações de Navegação Pós-Importação */}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
          <div className="text-xs sm:text-sm text-foreground font-medium">
            Tudo salvo no banco! Você pode conferir os cadastros diretamente:
          </div>
          <div className="flex items-center gap-2">
            <Link to="/fornecedores">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                <span>Ver Fornecedores</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Link to="/estoque">
              <Button size="sm" className="gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />
                <span>Ver Produtos / Estoque</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Log Detalhado de Processamento */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Relatório de Importação ({logs.length} eventos)
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Auditoria em tempo real
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs font-mono rounded-md bg-muted/50 p-3 border">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    log.type === "success"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : log.type === "error"
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : log.type === "warning"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                  }`}
                >
                  <span className="shrink-0">
                    {log.type === "success" ? "✓" : log.type === "error" ? "✕" : "•"}
                  </span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
