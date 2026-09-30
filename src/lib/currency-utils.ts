/**
 * Utilitários para formatação e análise numérica e monetária brasileira (BRL).
 * Lida com mil, milhar, milhão, centavos com vírgula ou ponto, sem erros de conversão inteira.
 */

export function parseCurrencyInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : Math.round(value * 100) / 100;

  let raw = String(value).trim().toLowerCase();
  if (!raw) return 0;

  // Detecta multiplicadores textuais: bilhão, milhão, mil, milhar, k, m, bi, b
  let multiplier = 1;
  if (/(bilh(ao|ão|oes|ões)|bi)\b/i.test(raw) || /\d+\s*b$/i.test(raw)) {
    multiplier = 1_000_000_000;
    raw = raw.replace(/(bilh(ao|ão|oes|ões)|bi)\b/gi, "").replace(/b$/i, "");
  } else if (/(milh(ao|ão|oes|ões))\b/i.test(raw) || /\d+\s*m$/i.test(raw)) {
    multiplier = 1_000_000;
    raw = raw.replace(/(milh(ao|ão|oes|ões))\b/gi, "").replace(/m$/i, "");
  } else if (
    /(milhar(es)?|mil)\b/i.test(raw) ||
    /\d+\s*(k|mil)\b/i.test(raw) ||
    /\d+mil$/i.test(raw)
  ) {
    multiplier = 1_000;
    raw = raw
      .replace(/(milhar(es)?|mil)\b/gi, "")
      .replace(/k$/i, "")
      .replace(/mil$/i, "");
  }

  // Remove símbolos de moeda, letras e espaços
  let str = raw.replace(/[r$\s]/gi, "").trim();
  if (!str) return 0;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Padrão brasileiro: 1.234.567,89 ou 4.901,17
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Padrão internacional: 1,234,567.89 ou 4,901.17
      str = str.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Apenas vírgula: "4901,17" ou "4,901,17" ou "1,000,000"
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      const digitsAfterLast = str.length - 1 - lastComma;
      if (digitsAfterLast === 2 || digitsAfterLast === 1) {
        const beforeLast = str.slice(0, lastComma).replace(/,/g, "");
        str = beforeLast + "." + str.slice(lastComma + 1);
      } else {
        str = str.replace(/,/g, "");
      }
    } else {
      // Uma única vírgula: "4901,17" -> sempre separador decimal
      str = str.replace(",", ".");
    }
  } else if (lastDot > -1) {
    // Apenas ponto: "4901.17" ou "4.901" ou "4.901.17" ou "1.000.000"
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      const digitsAfterLast = str.length - 1 - lastDot;
      if (digitsAfterLast === 2 || digitsAfterLast === 1) {
        // Ex: "4.901.17" -> centavos digitados com teclado numérico padrão
        const beforeLast = str.slice(0, lastDot).replace(/\./g, "");
        str = beforeLast + "." + str.slice(lastDot + 1);
      } else {
        // Ex: "1.000.000" -> separador de milhar
        str = str.replace(/\./g, "");
      }
    } else {
      // Um único ponto: "4901.17" ou "4.901" ou "4.5"
      const digitsAfterDot = str.length - 1 - lastDot;
      if (digitsAfterDot === 3 && str.length >= 5 && multiplier === 1) {
        // Ex: "4.901" ou "10.000" -> milhar brasileiro
        str = str.replace(/\./g, "");
      } else {
        // "4901.17" ou "4.5" -> mantém como decimal
      }
    }
  }

  // Remove qualquer caractere restante que não seja dígito, ponto ou sinal de menos
  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  const result = num * multiplier;
  return Math.round(result * 100) / 100;
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  const num = typeof value === "number" && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatCurrencyInputValue(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
