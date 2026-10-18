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
import type { HoleriteData, EmployeeData } from "@/lib/holerites";

// Limpeza de segurança: remove chaves legadas com CPFs e salários do localStorage
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("brasao_holerites_cache");
    localStorage.removeItem("brasao_employees_cache");
  } catch {
    // ignora
  }
}

export function useHolerites() {
  return useQuery({
    queryKey: ["holerites"],
    queryFn: async (): Promise<HoleriteData[]> => {
      const q = query(collection(db, "holerites"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<HoleriteData, "id">),
      }));
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

      // Persiste no Firestore e aguarda confirmação remota
      await setDoc(doc(db, "holerites", id), {
        ...payload,
        updated_at_server: serverTimestamp(),
      });

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
      await deleteDoc(doc(db, "holerites", id));
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
      const q = query(collection(db, "employees"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmployeeData, "id">),
      }));
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

      // Persiste no Firestore e aguarda confirmação
      await setDoc(doc(db, "employees", id), {
        ...payload,
        updated_at_server: serverTimestamp(),
      });

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
      await deleteDoc(doc(db, "employees", id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}
