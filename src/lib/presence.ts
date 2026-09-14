import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

export const PRESENCE_COLLECTION = "presence_logs";

export type PresenceStatus = "presente" | "ausente" | "meio_periodo" | "folga" | "remoto";

export interface PresenceLog {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  status: PresenceStatus;
  notes?: string;
  check_in?: string;
  check_out?: string;
  shift?: "integral" | "almoco" | "jantar" | "visita" | "outro";
  rating?: number; // 1 to 5 (ritmo / avaliação da operação)
  tags?: string[];
  user_id?: string;
  user_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PresenceStatusConfig {
  id: PresenceStatus;
  label: string;
  shortLabel: string;
  description: string;
  colorName: string;
  badgeClass: string;
  calendarBgClass: string;
  calendarBorderClass: string;
  dotClass: string;
  hex: string;
}

export const PRESENCE_STATUSES: Record<PresenceStatus, PresenceStatusConfig> = {
  presente: {
    id: "presente",
    label: "Fui à Galeteria (Presente)",
    shortLabel: "Presente",
    description: "Estive presente no restaurante acompanhando a operação",
    colorName: "emerald",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    calendarBgClass:
      "bg-emerald-50/90 hover:bg-emerald-100/90 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/50",
    calendarBorderClass: "border-emerald-500/50 dark:border-emerald-500/60",
    dotClass: "bg-emerald-500",
    hex: "#10b981",
  },
  ausente: {
    id: "ausente",
    label: "Ausência / Não Fui",
    shortLabel: "Ausente",
    description: "Não compareci à galeteria neste dia",
    colorName: "rose",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    calendarBgClass:
      "bg-rose-50/90 hover:bg-rose-100/90 dark:bg-rose-950/35 dark:hover:bg-rose-950/50",
    calendarBorderClass: "border-rose-500/50 dark:border-rose-500/60",
    dotClass: "bg-rose-500",
    hex: "#f43f5e",
  },
  meio_periodo: {
    id: "meio_periodo",
    label: "Meio Período / Visita Rápida",
    shortLabel: "Meio Período",
    description: "Fui apenas para conferência, almoço ou período curto",
    colorName: "amber",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    calendarBgClass:
      "bg-amber-50/90 hover:bg-amber-100/90 dark:bg-amber-950/35 dark:hover:bg-amber-950/50",
    calendarBorderClass: "border-amber-500/50 dark:border-amber-500/60",
    dotClass: "bg-amber-500",
    hex: "#f59e0b",
  },
  folga: {
    id: "folga",
    label: "Folga / Estabelecimento Fechado",
    shortLabel: "Folga",
    description: "Dia de folga programada ou restaurante fechado",
    colorName: "sky",
    badgeClass:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    calendarBgClass: "bg-sky-50/90 hover:bg-sky-100/90 dark:bg-sky-950/35 dark:hover:bg-sky-950/50",
    calendarBorderClass: "border-sky-500/50 dark:border-sky-500/60",
    dotClass: "bg-sky-500",
    hex: "#0284c7",
  },
  remoto: {
    id: "remoto",
    label: "Trabalho Externo / Compras / Feira",
    shortLabel: "Externo",
    description: "Fui a fornecedores, ceasa, compras ou trabalho administrativo",
    colorName: "purple",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    calendarBgClass:
      "bg-purple-50/90 hover:bg-purple-100/90 dark:bg-purple-950/35 dark:hover:bg-purple-950/50",
    calendarBorderClass: "border-purple-500/50 dark:border-purple-500/60",
    dotClass: "bg-purple-500",
    hex: "#8b5cf6",
  },
};

export const COMMON_TAGS = [
  "Fechamento de Caixa",
  "Contagem de Estoque",
  "Recebimento de Pedido",
  "Manutenção / Obras",
  "Treinamento de Equipe",
  "Compras / Fornecedor",
  "Reunião de Gerência",
  "Movimento Intenso",
  "Auditoria / Fiscal",
];

const LOCAL_STORAGE_KEY = "brasao_presence_logs_cache";

function getLocalPresenceCache(): Record<string, PresenceLog> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalPresenceCache(cache: Record<string, PresenceLog>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Busca todos os registros de presença cadastrados
 */
export async function fetchAllPresenceLogs(): Promise<PresenceLog[]> {
  try {
    const snap = await getDocs(collection(db, PRESENCE_COLLECTION));
    const items: PresenceLog[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: (data["date"] as string) || d.id,
        status: (data["status"] as PresenceStatus) || "presente",
        notes: (data["notes"] as string) || "",
        check_in: (data["check_in"] as string) || "",
        check_out: (data["check_out"] as string) || "",
        shift: data["shift"] as PresenceLog["shift"],
        rating: typeof data["rating"] === "number" ? data["rating"] : undefined,
        tags: Array.isArray(data["tags"]) ? data["tags"] : [],
        user_id: (data["user_id"] as string) || "",
        user_name: (data["user_name"] as string) || "",
        created_at: (data["created_at"] as { toDate?: () => Date })?.toDate
          ? (data["created_at"] as { toDate: () => Date }).toDate().toISOString()
          : undefined,
        updated_at: (data["updated_at"] as { toDate?: () => Date })?.toDate
          ? (data["updated_at"] as { toDate: () => Date }).toDate().toISOString()
          : undefined,
      };
    });

    // Atualiza cache local
    const cache: Record<string, PresenceLog> = {};
    items.forEach((it) => {
      cache[it.date] = it;
    });
    saveLocalPresenceCache(cache);

    return items;
  } catch (err) {
    console.warn("[Presence] Erro ao carregar do Firestore, recorrendo ao cache:", err);
    const local = getLocalPresenceCache();
    return Object.values(local);
  }
}

/**
 * Salva ou atualiza um registro de presença de um determinado dia
 */
export async function savePresenceLog(
  log: Omit<PresenceLog, "id"> & { id?: string },
): Promise<PresenceLog> {
  const docId = log.date; // Usa a data YYYY-MM-DD como ID estável e único
  const docRef = doc(db, PRESENCE_COLLECTION, docId);

  const payload = {
    date: log.date,
    status: log.status,
    notes: log.notes?.trim() || "",
    check_in: log.check_in?.trim() || "",
    check_out: log.check_out?.trim() || "",
    shift: log.shift || "integral",
    rating: log.rating || null,
    tags: log.tags || [],
    user_id: log.user_id || "",
    user_name: log.user_name || "",
    updated_at: serverTimestamp(),
    created_at: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });

  const saved: PresenceLog = {
    ...log,
    id: docId,
    notes: log.notes?.trim() || "",
    check_in: log.check_in?.trim() || "",
    check_out: log.check_out?.trim() || "",
    updated_at: new Date().toISOString(),
  };

  // Atualiza cache local
  const cache = getLocalPresenceCache();
  cache[saved.date] = saved;
  saveLocalPresenceCache(cache);

  return saved;
}

/**
 * Remove um registro de presença (ex: para limpar o dia)
 */
export async function deletePresenceLog(date: string): Promise<void> {
  const docRef = doc(db, PRESENCE_COLLECTION, date);
  await deleteDoc(docRef);

  const cache = getLocalPresenceCache();
  delete cache[date];
  saveLocalPresenceCache(cache);
}

/* -------------------------------------------------------------------------- */
/*                               REACT QUERY HOOKS                            */
/* -------------------------------------------------------------------------- */

export function usePresenceLogs() {
  return useQuery({
    queryKey: ["presence_logs"],
    queryFn: fetchAllPresenceLogs,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useSavePresenceLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: savePresenceLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presence_logs"] });
    },
  });
}

export function useDeletePresenceLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePresenceLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presence_logs"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                HELPER METRICS                              */
/* -------------------------------------------------------------------------- */

export interface MonthPresenceStats {
  totalDaysInMonth: number;
  elapsedDays: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  offCount: number;
  remoteCount: number;
  recordedDaysCount: number;
  presenceRate: number; // 0 to 100
  notesCount: number;
}

export function calculateMonthPresenceStats(
  logs: PresenceLog[],
  year: number,
  monthIndex: number, // 0-indexed (0 = Jan, 11 = Dec)
): MonthPresenceStats {
  const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const elapsedDays = isCurrentMonth
    ? Math.min(today.getDate(), totalDaysInMonth)
    : totalDaysInMonth;

  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthLogs = logs.filter((l) => l.date.startsWith(monthPrefix));

  let presentCount = 0;
  let absentCount = 0;
  let halfDayCount = 0;
  let offCount = 0;
  let remoteCount = 0;
  let notesCount = 0;

  monthLogs.forEach((l) => {
    if (l.status === "presente") presentCount++;
    else if (l.status === "ausente") absentCount++;
    else if (l.status === "meio_periodo") halfDayCount++;
    else if (l.status === "folga") offCount++;
    else if (l.status === "remoto") remoteCount++;

    if (l.notes && l.notes.trim().length > 0) {
      notesCount++;
    }
  });

  const effectivePresent = presentCount + halfDayCount * 0.5 + remoteCount * 0.8;
  const presenceRate =
    elapsedDays > 0 ? Math.min(100, Math.round((effectivePresent / elapsedDays) * 100)) : 0;

  return {
    totalDaysInMonth,
    elapsedDays,
    presentCount,
    absentCount,
    halfDayCount,
    offCount,
    remoteCount,
    recordedDaysCount: monthLogs.length,
    presenceRate,
    notesCount,
  };
}
