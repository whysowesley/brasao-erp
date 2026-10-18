import { useEffect, useState } from "react";

const STORAGE_KEY = "brasao_is_post_operation";

/**
 * Hook para controlar a flag de momento da contagem/atualização:
 * - isPostOperation = true: Pós-operação / Fechamento (o dia de hoje já encerrou e foi consumido).
 *   O estoque contado abastecerá os dias restantes a partir de amanhã até a entrega da 2ª feira.
 *   Ex: Sábado à noite -> restam apenas Domingo e Segunda (2 dias de consumo).
 * - isPostOperation = false: Pré-operação / Início do dia (o dia de hoje ainda será consumido).
 *   Ex: Sábado de manhã -> restam Sábado, Domingo e Segunda (3 dias de consumo).
 */
export function getDefaultPostOperationMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hour = new Date().getHours();
    // A partir das 19h (noite / encerramento do expediente) padrão é pós-operação; antes disso é pré-operação
    return hour >= 19;
  } catch {
    return false;
  }
}

export function usePostOperationMode() {
  const [isPostOperation, setIsPostOperation] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch {
      // Ignora erro de acesso ao localStorage
    }
    return getDefaultPostOperationMode();
  });

  const setMode = (val: boolean) => {
    setIsPostOperation(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
      window.dispatchEvent(new Event("storage_post_operation"));
    } catch {
      // Ignora erro de gravação no localStorage
    }
  };

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) setIsPostOperation(stored === "true");
      } catch {
        // Ignora erro de acesso ao localStorage
      }
    };
    window.addEventListener("storage_post_operation", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("storage_post_operation", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  return [isPostOperation, setMode] as const;
}

export function getPostOperationMode(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Ignora erro
  }
  return getDefaultPostOperationMode();
}
