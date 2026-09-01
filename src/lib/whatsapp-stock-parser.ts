import type { ProductRow } from "@/lib/inventory";

export interface ParsedStockItem {
  id: string; // unique ID for UI key
  rawLine: string;
  rawName: string;
  rawQtyStr: string;
  parsedQty: number;
  detectedUnit: string | null;
  matchedProduct: ProductRow | null;
  matchScore: number;
  matchType: "exact" | "high" | "fuzzy" | "none";
  selectedProductId: string | null;
}

/**
 * Remove acentos e caracteres especiais para comparação flexível
 */
export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIT_ALIASES: Record<string, string> = {
  un: "UN",
  und: "UN",
  unid: "UN",
  unidade: "UN",
  unidades: "UN",
  kg: "KG",
  kgs: "KG",
  quilo: "KG",
  quilos: "KG",
  quilograma: "KG",
  quilogramas: "KG",
  g: "G",
  gr: "G",
  grs: "G",
  grama: "G",
  gramas: "G",
  cx: "CX",
  caixa: "CX",
  caixas: "CX",
  sc: "SC",
  saco: "SC",
  sacos: "SC",
  bdj: "BDJ",
  bandeja: "BDJ",
  bandejas: "BDJ",
  porcao: "PORCAO",
  porcoes: "PORCAO",
  l: "L",
  lt: "L",
  litro: "L",
  litros: "L",
  ml: "ML",
  mililitro: "ML",
  mililitros: "ML",
  pct: "PCT",
  pacote: "PCT",
  pacotes: "PCT",
};

/**
 * Normaliza abreviações de unidade sem converter quantidades.
 * Unidades diferentes (por exemplo, G e KG) permanecem diferentes para evitar
 * que uma contagem seja gravada em uma escala incorreta.
 */
export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit?.trim()) return null;

  const normalized = normalizeString(unit);
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter(Boolean);
  const aliases = tokens.map((token) => UNIT_ALIASES[token]);
  const [firstAlias] = aliases;

  if (firstAlias !== undefined && aliases.every((alias) => alias === firstAlias)) {
    return firstAlias;
  }

  return normalized.toUpperCase();
}

export function unitsAreCompatible(
  detectedUnit: string | null | undefined,
  productUnit: string | null | undefined,
): boolean {
  const detected = normalizeUnit(detectedUnit);
  if (detected === null) return true;

  const product = normalizeUnit(productUnit);
  return product !== null && detected === product;
}

/**
 * Limpa termos comuns que aparecem em nomes de produtos como unidades entre parênteses
 */
function cleanProductDescription(desc: string): string {
  return normalizeString(
    desc
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(
        /\b(kg|und|un|cx|caixa|saco|sc|bdj|bandeja|porcao|porção|g|gr|grama|litro|l|ml|pct|pacote)\b/gi,
        "",
      ),
  );
}

/**
 * Calcula similaridade entre duas strings usando Dice's Coefficient (0 a 1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.8 + (minLen / maxLen) * 0.2;
  }

  // Token overlap
  const tokens1 = new Set(s1.split(" ").filter(Boolean));
  const tokens2 = new Set(s2.split(" ").filter(Boolean));

  let overlap = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) overlap++;
  }

  const tokenScore = (2 * overlap) / (tokens1.size + tokens2.size);
  if (tokenScore > 0.7) return tokenScore;

  // Bigram similarity
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const b of b1) {
    if (b2.has(b)) intersection++;
  }

  return (2 * intersection) / (b1.size + b2.size || 1);
}

/**
 * Extrai nome do produto, quantidade e unidade de uma linha de texto do WhatsApp
 * Exemplo de linhas:
 * - "ABÓBORA: 2 PORÇÃO"
 * - "ALFACE: 1 UND"
 * - "ALHO: 13kg KG"
 * - "BATATA INGLESA: 0 SACO"
 * - "FARINHA DE ROSCA: 4.370KG"
 * - "ORÉGANO: 0.890 GRAMA"
 * - "PIMENTA DE CHEIRO: 13UND"
 * - "1. TOMATE: 0 CX"
 * - "*CEBOLA:* 2"
 * - "TEMPERO - 2,060 KG"
 */
export function parseWhatsAppLine(line: string): {
  rawName: string;
  rawQtyStr: string;
  parsedQty: number;
  detectedUnit: string | null;
} | null {
  let cleaned = line.trim();
  if (!cleaned) return null;

  // Remover marcações do WhatsApp como horários [12:30, ...] ou nomes ~Wesley:
  cleaned = cleaned.replace(/^\[.*?\]\s*[^:]*:\s*/i, "");
  cleaned = cleaned.replace(/^~[^:]*:\s*/i, "");

  // Remover marcadores de listas como "1.", "1 -", "•", "*", "-" no início
  cleaned = cleaned.replace(/^[\d]+[.)-]\s*/, "");
  cleaned = cleaned.replace(/^[*•\->~]+\s*/, "");

  // Se a linha ficou vazia ou era apenas saudação/cabeçalho
  if (!cleaned || cleaned.length < 2) return null;

  let rawName = "";
  let rawRight = "";

  // Primeiro procurar delimitadores que também podem aparecer junto ao texto.
  // O hífen só é delimitador quando está cercado por espaços, preservando nomes
  // como "COCA-COLA: 5".
  const delimiterMatch =
    cleaned.match(/^([^:=—–]+)[:=—–]\s*(.*)$/) ?? cleaned.match(/^(.*?)\s+-\s+(.*)$/);

  if (delimiterMatch) {
    const [, matchedName, matchedRight] = delimiterMatch;
    if (matchedName === undefined || matchedRight === undefined) return null;

    rawName = matchedName.trim();
    rawRight = matchedRight.trim();
  } else {
    // Se não tiver delimitador explícito, procurar por número no final da linha
    const trailingNumMatch = cleaned.match(
      /^(.*?)(?:[\s]+)(\d+(?:[.,]\d+)?)\s*([a-zA-ZçÇãÃõÕéÉíÍóÓúÚ/]+)?$/,
    );
    if (trailingNumMatch) {
      const [, matchedName, matchedQty, matchedUnit = ""] = trailingNumMatch;
      if (matchedName === undefined || matchedQty === undefined) return null;

      rawName = matchedName.trim();
      rawRight = `${matchedQty} ${matchedUnit}`.trim();
    } else {
      // Linha sem número detectável
      return null;
    }
  }

  // Limpar asteriscos de formatação do WhatsApp
  rawName = rawName.replace(/[*_]/g, "").trim();
  if (!rawName) return null;

  // Extrair número e unidade da parte direita
  // Pode conter coisas como: "4.370KG", "13kg KG", "0.890 GRAMA", "2 PORÇÃO", "0 SACO", "13UND"
  const qtyMatch = rawRight.match(/(\d+(?:[.,]\d+)?)/);
  if (!qtyMatch) return null;

  const numStr = qtyMatch[1];
  if (numStr === undefined) return null;

  // Normalizar vírgula para ponto se houver
  const parsedQty = parseFloat(numStr.replace(",", "."));
  if (isNaN(parsedQty)) return null;

  // Extrair unidade se houver texto restante
  const unitMatch = rawRight.replace(numStr, "").replace(/[*_]/g, "").trim();

  const detectedUnit = unitMatch || null;

  return {
    rawName,
    rawQtyStr: numStr,
    parsedQty,
    detectedUnit,
  };
}

/**
 * Encontra o melhor produto compatível para um nome informado
 */
export function findBestProductMatch(
  rawName: string,
  products: ProductRow[],
): {
  matchedProduct: ProductRow | null;
  matchScore: number;
  matchType: "exact" | "high" | "fuzzy" | "none";
} {
  const normRaw = normalizeString(rawName);
  if (!normRaw || products.length === 0) {
    return { matchedProduct: null, matchScore: 0, matchType: "none" };
  }

  let bestProduct: ProductRow | null = null;
  let bestScore = 0;

  for (const p of products) {
    const normDesc = normalizeString(p.description);
    const cleanDesc = cleanProductDescription(p.description);

    // 1. Correspondência exata perfeita
    if (normDesc === normRaw || cleanDesc === normRaw) {
      return {
        matchedProduct: p,
        matchScore: 1.0,
        matchType: "exact",
      };
    }

    // 2. Correspondência exata por código se informado
    if (p.code !== null && String(p.code) === normRaw) {
      return {
        matchedProduct: p,
        matchScore: 1.0,
        matchType: "exact",
      };
    }

    // 3. Similaridade ponderada
    const score1 = calculateSimilarity(normRaw, normDesc);
    const score2 = calculateSimilarity(normRaw, cleanDesc);
    const score = Math.max(score1, score2);

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  if (bestScore >= 0.85) {
    return {
      matchedProduct: bestProduct,
      matchScore: bestScore,
      matchType: "high",
    };
  } else if (bestScore >= 0.55) {
    return {
      matchedProduct: bestProduct,
      matchScore: bestScore,
      matchType: "fuzzy",
    };
  }

  return {
    matchedProduct: null,
    matchScore: bestScore,
    matchType: "none",
  };
}

/**
 * Analisa um texto completo do WhatsApp e retorna a lista de itens mapeados
 */
export function parseWhatsAppStockMessage(text: string, products: ProductRow[]): ParsedStockItem[] {
  const lines = text.split(/\r?\n/);
  const results: ParsedStockItem[] = [];

  lines.forEach((line, index) => {
    const parsed = parseWhatsAppLine(line);
    if (!parsed) return;

    const { matchedProduct, matchScore, matchType } = findBestProductMatch(
      parsed.rawName,
      products,
    );

    results.push({
      id: `parsed-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawLine: line.trim(),
      rawName: parsed.rawName,
      rawQtyStr: parsed.rawQtyStr,
      parsedQty: parsed.parsedQty,
      detectedUnit: parsed.detectedUnit,
      matchedProduct,
      matchScore,
      matchType,
      // Alterações de estoque exigem confirmação manual para qualquer
      // correspondência que não seja exata.
      selectedProductId: matchType === "exact" ? (matchedProduct?.id ?? null) : null,
    });
  });

  return results;
}
