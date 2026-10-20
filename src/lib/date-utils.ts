import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Normaliza qualquer valor de data (string ISO, DD/MM/YYYY, Timestamp Firestore, Date)
 * para uma string segura no formato YYYY-MM-DD.
 */
export function normalizeDateString(val: unknown, fallback = ""): string {
  if (val === null || val === undefined || val === "") {
    return fallback;
  }

  // Se já for Date válida
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().slice(0, 10);
    }
    return fallback;
  }

  // Se for Timestamp do Firestore com toDate()
  if (typeof (val as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (val as { toDate: () => Date }).toDate();
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      return fallback;
    }
  }

  // Se for objeto Firestore { seconds, nanoseconds }
  if (typeof val === "object" && val !== null && "seconds" in val) {
    try {
      const d = new Date((val as { seconds: number }).seconds * 1000);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      return fallback;
    }
  }

  // Se for string
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return fallback;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // YYYY-MM-DDTHH:mm:ss...
    if (trimmed.includes("T")) {
      const part = trimmed.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
        return part;
      }
    }

    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split("/");
      return `${yyyy}-${mm}-${dd}`;
    }

    // Tenta Date nativo
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      // Ignora erro
    }

    return trimmed;
  }

  // Se for número (timestamp millis)
  if (typeof val === "number" && !isNaN(val)) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}

/**
 * Formata qualquer valor de data com total segurança.
 * Nunca lança RangeError nem TypeError.
 */
export function safeFormatDate(dateVal: unknown, fmt = "dd/MM/yyyy", fallback = "—"): string {
  if (!dateVal) return fallback;

  try {
    // Se for string YYYY-MM-DD, formata sem desvio de fuso horário
    if (typeof dateVal === "string") {
      const trimmed = dateVal.trim();
      if (!trimmed) return fallback;

      const datePart = trimmed.split("T")[0];
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const localDate = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(localDate.getTime())) {
          return format(localDate, fmt, { locale: ptBR });
        }
      }

      const parsed = parseISO(trimmed);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, fmt, { locale: ptBR });
      }

      const nativeParsed = new Date(trimmed);
      if (!isNaN(nativeParsed.getTime())) {
        return format(nativeParsed, fmt, { locale: ptBR });
      }

      return trimmed || fallback;
    }

    if (dateVal instanceof Date) {
      if (!isNaN(dateVal.getTime())) {
        return format(dateVal, fmt, { locale: ptBR });
      }
      return fallback;
    }

    // Firestore Timestamp ou objeto com seconds
    const normalized = normalizeDateString(dateVal);
    if (normalized) {
      return safeFormatDate(normalized, fmt, fallback);
    }
  } catch {
    // Retorna fallback limpo em caso de erro
  }

  return fallback;
}

/**
 * Converte para um objeto Date válido com segurança (para pickers/calendários).
 * Retorna undefined se inválido (nunca Invalid Date com NaN).
 */
export function safeParseDate(dateVal: unknown): Date | undefined {
  if (!dateVal) return undefined;

  try {
    if (dateVal instanceof Date) {
      return !isNaN(dateVal.getTime()) ? dateVal : undefined;
    }

    if (typeof dateVal === "string") {
      const trimmed = dateVal.trim();
      if (!trimmed) return undefined;

      const datePart = trimmed.split("T")[0];
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const d = new Date(year, month, day, 12, 0, 0);
        return !isNaN(d.getTime()) ? d : undefined;
      }

      const parsed = parseISO(trimmed);
      if (!isNaN(parsed.getTime())) return parsed;

      const nativeParsed = new Date(trimmed);
      if (!isNaN(nativeParsed.getTime())) return nativeParsed;
    }

    const normalized = normalizeDateString(dateVal);
    if (normalized) {
      return safeParseDate(normalized);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Compara duas datas em string de forma segura (para ordenação de tabelas).
 * Nunca lança exceção se um dos valores for null ou undefined.
 */
export function safeCompareDates(dateA: unknown, dateB: unknown): number {
  const strA = String(normalizeDateString(dateA) || "");
  const strB = String(normalizeDateString(dateB) || "");
  return strA.localeCompare(strB);
}

/**
 * Compara duas strings com segurança e ordenação alfabética em português.
 * Nunca lança exceção se for null ou undefined.
 */
export function safeCompareStrings(
  strA: unknown,
  strB: unknown,
  sensitivity: "base" | "accent" | "case" | "variant" = "base",
): number {
  const sA = strA !== null && strA !== undefined ? String(strA) : "";
  const sB = strB !== null && strB !== undefined ? String(strB) : "";
  return sA.localeCompare(sB, "pt-BR", { sensitivity });
}
