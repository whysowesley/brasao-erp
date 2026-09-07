import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { type HoleriteData, type EmployeeData, SAMPLE_PRINT_HOLERITE } from "@/lib/holerites";

const LOCAL_STORAGE_HOLERITES = "brasao_holerites_cache";
const LOCAL_STORAGE_EMPLOYEES = "brasao_employees_cache";

function getLocalHolerites(): HoleriteData[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HOLERITES);
    if (!raw) {
      // Cria o exemplo inicial do print se não houver nada
      const initial: HoleriteData = {
        ...SAMPLE_PRINT_HOLERITE,
        id: "sample-isaulina-01",
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_HOLERITES, JSON.stringify([initial]));
      return [initial];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalHolerites(items: HoleriteData[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_HOLERITES, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function getLocalEmployees(): EmployeeData[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EMPLOYEES);
    if (!raw) {
      const initial: EmployeeData = {
        id: "emp-9016",
        code: "9016",
        name: "ISAULINA OLIVEIRA DA SILVA",
        cpf: "111.782.324-50",
        cbo: "GERENTE",
        base_salary: 2300,
        active: true,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_EMPLOYEES, JSON.stringify([initial]));
      return [initial];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalEmployees(items: EmployeeData[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function useHolerites() {
  return useQuery({
    queryKey: ["holerites"],
    queryFn: async (): Promise<HoleriteData[]> => {
      try {
        const q = query(collection(db, "holerites"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: HoleriteData[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<HoleriteData, "id">),
          }));
          setLocalHolerites(list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore holerites fetch fallback to local cache:", err);
      }
      return getLocalHolerites();
    },
    staleTime: 1000 * 30,
  });
}

export function useSaveHolerite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<HoleriteData, "id"> & { id?: string }) => {
      const id = data.id || `hol-${Date.now()}`;
      const payload: HoleriteData = {
        ...data,
        id,
        updated_at: new Date().toISOString(),
        created_at: data.created_at || new Date().toISOString(),
      };

      // 1. Atualiza cache local imediatamente
      const local = getLocalHolerites();
      const idx = local.findIndex((h) => h.id === id);
      if (idx >= 0) {
        local[idx] = payload;
      } else {
        local.unshift(payload);
      }
      setLocalHolerites(local);

      // 2. Tenta persistir no Firestore
      try {
        await setDoc(doc(db, "holerites", id), {
          ...payload,
          updated_at: serverTimestamp(),
        });
      } catch (err) {
        console.warn("Firestore holerite save error, saved locally:", err);
      }

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holerites"] });
    },
  });
}

export function useDeleteHolerite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const local = getLocalHolerites().filter((h) => h.id !== id);
      setLocalHolerites(local);

      try {
        await deleteDoc(doc(db, "holerites", id));
      } catch (err) {
        console.warn("Firestore holerite delete error:", err);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holerites"] });
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async (): Promise<EmployeeData[]> => {
      try {
        const q = query(collection(db, "employees"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: EmployeeData[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EmployeeData, "id">),
          }));
          setLocalEmployees(list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore employees fetch fallback to local cache:", err);
      }
      return getLocalEmployees();
    },
    staleTime: 1000 * 30,
  });
}

export function useSaveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<EmployeeData, "id"> & { id?: string }) => {
      const id = data.id || `emp-${Date.now()}`;
      const payload: EmployeeData = {
        ...data,
        id,
        created_at: data.created_at || new Date().toISOString(),
      };

      const local = getLocalEmployees();
      const idx = local.findIndex((e) => e.id === id);
      if (idx >= 0) {
        local[idx] = payload;
      } else {
        local.push(payload);
      }
      setLocalEmployees(local);

      try {
        await setDoc(doc(db, "employees", id), payload);
      } catch (err) {
        console.warn("Firestore employee save error, saved locally:", err);
      }

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const local = getLocalEmployees().filter((e) => e.id !== id);
      setLocalEmployees(local);

      try {
        await deleteDoc(doc(db, "employees", id));
      } catch (err) {
        console.warn("Firestore employee delete error:", err);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}
