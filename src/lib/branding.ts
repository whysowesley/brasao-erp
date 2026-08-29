import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/integrations/firebase/config";

export interface BrandingSettings {
  logoUrl: string | null;
  companyName: string;
  subtitle: string;
  themePrimaryColor?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: "/brasao-logo.jpeg",
  companyName: "Galeteria Brasão",
  subtitle: "Sistema de Gestão & ERP",
};

/**
 * Hook reativo em tempo real para sincronização com o Firestore (/settings/branding)
 */
export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    // Tenta carregar cache local inicial para evitar flash visual
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("brasao_branding_cache");
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_BRANDING, ...parsed };
        }
      } catch {
        // Ignora
      }
    }
    return DEFAULT_BRANDING;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "settings", "branding");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as BrandingSettings;
          const merged: BrandingSettings = {
            logoUrl: data.logoUrl || DEFAULT_BRANDING.logoUrl,
            companyName: data.companyName || DEFAULT_BRANDING.companyName,
            subtitle: data.subtitle || DEFAULT_BRANDING.subtitle,
            ...(data.themePrimaryColor !== undefined
              ? { themePrimaryColor: data.themePrimaryColor }
              : {}),
            ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}),
            ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
          };
          setBranding(merged);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("brasao_branding_cache", JSON.stringify(merged));
            } catch {
              // Ignora
            }
          }
        } else {
          setBranding(DEFAULT_BRANDING);
        }
        setLoading(false);
      },
      (error) => {
        console.warn("Aviso ao sincronizar branding do Firebase:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { branding, loading };
}

/**
 * Salva as configurações de marca no Firestore (/settings/branding)
 */
export async function saveBrandingSettings(
  settings: Partial<BrandingSettings>,
  userName: string = "Administrador",
): Promise<void> {
  const docRef = doc(db, "settings", "branding");
  await setDoc(
    docRef,
    {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: userName,
    },
    { merge: true },
  );

  if (typeof window !== "undefined") {
    try {
      const current = localStorage.getItem("brasao_branding_cache");
      const parsed = current ? JSON.parse(current) : DEFAULT_BRANDING;
      localStorage.setItem("brasao_branding_cache", JSON.stringify({ ...parsed, ...settings }));
    } catch {
      // Ignora
    }
  }
}

/**
 * Faz upload da nova logo para o Firebase Storage e atualiza no Firestore
 */
export async function uploadBrandingLogo(
  file: File,
  userName: string = "Administrador",
): Promise<string> {
  // Gera nome único com timestamp
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `logo_${Date.now()}.${extension}`;
  const storageRef = ref(storage, `assets/branding/${fileName}`);

  // Envia para o Firebase Storage
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || "image/png",
    customMetadata: {
      uploadedBy: userName,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Obtém a URL pública do Storage
  const downloadUrl = await getDownloadURL(snapshot.ref);

  // Salva no Firestore
  await saveBrandingSettings({ logoUrl: downloadUrl }, userName);

  return downloadUrl;
}

/**
 * Restaura a logo padrão institucional
 */
export async function resetBrandingToDefault(userName: string = "Administrador"): Promise<void> {
  await saveBrandingSettings(
    {
      logoUrl: DEFAULT_BRANDING.logoUrl,
      companyName: DEFAULT_BRANDING.companyName,
      subtitle: DEFAULT_BRANDING.subtitle,
    },
    userName,
  );
}
