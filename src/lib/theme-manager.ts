import { useState, useEffect } from "react";
import { saveBrandingSettings, useBranding } from "@/lib/branding";

/* -------------------------------------------------------------------------- */
/*                            TEMAS DOS QUADRANTES                            */
/* -------------------------------------------------------------------------- */

export interface QuadranteThemeConfig {
  id: string;
  name: string;
  badge: string;
  previewBg: string;
  previewText: string;
  headerBgClass: string;
  headerStyle?: React.CSSProperties;
  headerTextClass: string;
  headerSubtextClass: string;
  headerBtnBg: string;
  borderHighlight: string;
  dragRing: string;
  pillActive: string;
  accentText: string;
}

export const QUADRANTE_THEMES: Record<string, QuadranteThemeConfig> = {
  azul: {
    id: "azul",
    name: "Azul Real",
    badge: "Padrão",
    previewBg: "#0047AB",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#0047AB] dark:bg-[#1E3A8A]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-blue-200",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-blue-300 dark:border-blue-700/60",
    dragRing: "ring-2 ring-blue-500 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20",
    pillActive: "bg-blue-600 text-white border-blue-600",
    accentText: "text-blue-600 dark:text-blue-400",
  },
  vinho: {
    id: "vinho",
    name: "Vinho Nobre",
    badge: "Elegante",
    previewBg: "#722F37",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#722F37] dark:bg-[#58111A]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-rose-200",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-rose-300 dark:border-rose-800",
    dragRing: "ring-2 ring-rose-500 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20",
    pillActive: "bg-[#722F37] text-white border-[#722F37]",
    accentText: "text-rose-600 dark:text-rose-400",
  },
  dourado: {
    id: "dourado",
    name: "Dourado Nobre",
    badge: "Ouro",
    previewBg: "#C59B27",
    previewText: "#0F172A",
    headerBgClass: "bg-[#C59B27] dark:bg-[#A67C1E]",
    headerTextClass: "text-slate-950 font-black",
    headerSubtextClass: "text-slate-900 font-bold",
    headerBtnBg: "bg-black/15 hover:bg-black/25 text-slate-950",
    borderHighlight: "border-amber-400 dark:border-amber-700",
    dragRing: "ring-2 ring-amber-500 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20",
    pillActive: "bg-[#C59B27] text-slate-950 font-bold border-[#8F6B12]",
    accentText: "text-amber-700 dark:text-amber-400",
  },
  esmeralda: {
    id: "esmeralda",
    name: "Verde Esmeralda",
    badge: "Finanças",
    previewBg: "#065F46",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#065F46] dark:bg-[#064E3B]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-emerald-200",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-emerald-300 dark:border-emerald-800",
    dragRing: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20",
    pillActive: "bg-[#065F46] text-white border-[#065F46]",
    accentText: "text-emerald-600 dark:text-emerald-400",
  },
  roxo: {
    id: "roxo",
    name: "Roxo Imperial",
    badge: "Moderno",
    previewBg: "#581C87",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#581C87] dark:bg-[#3B0764]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-purple-200",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-purple-300 dark:border-purple-800",
    dragRing: "ring-2 ring-purple-500 border-purple-500 bg-purple-50/40 dark:bg-purple-950/20",
    pillActive: "bg-[#581C87] text-white border-[#581C87]",
    accentText: "text-purple-600 dark:text-purple-400",
  },
  grafite: {
    id: "grafite",
    name: "Preto / Grafite",
    badge: "Executivo",
    previewBg: "#1E293B",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#1E293B] dark:bg-[#0F172A]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-slate-300",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-slate-400 dark:border-slate-700",
    dragRing: "ring-2 ring-slate-500 border-slate-500 bg-slate-100/50 dark:bg-slate-900/40",
    pillActive: "bg-[#1E293B] text-white border-[#1E293B]",
    accentText: "text-slate-600 dark:text-slate-400",
  },
  laranja: {
    id: "laranja",
    name: "Terracota / Laranja",
    badge: "Destaque",
    previewBg: "#C2410C",
    previewText: "#FFFFFF",
    headerBgClass: "bg-[#C2410C] dark:bg-[#9A3412]",
    headerTextClass: "text-white",
    headerSubtextClass: "text-orange-200",
    headerBtnBg: "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-orange-300 dark:border-orange-800",
    dragRing: "ring-2 ring-orange-500 border-orange-500 bg-orange-50/40 dark:bg-orange-950/20",
    pillActive: "bg-[#C2410C] text-white border-[#C2410C]",
    accentText: "text-orange-600 dark:text-orange-400",
  },
};

/**
 * Calcula se uma cor HEX é clara ou escura para garantir contraste perfeito
 */
export function isLightColor(hexColor: string): boolean {
  const cleanHex = hexColor.replace("#", "");
  if (cleanHex.length < 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  // Fórmula padrão de luminância perceptiva (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145;
}

/**
 * Gera tema de quadrante a partir de um HEX personalizado
 */
export function getCustomQuadranteTheme(hex: string): QuadranteThemeConfig {
  const light = isLightColor(hex);
  return {
    id: "custom",
    name: "Personalizado",
    badge: "Custom",
    previewBg: hex,
    previewText: light ? "#000000" : "#FFFFFF",
    headerBgClass: "",
    headerStyle: { backgroundColor: hex },
    headerTextClass: light ? "text-slate-950 font-black" : "text-white font-extrabold",
    headerSubtextClass: light ? "text-slate-900 font-semibold" : "text-white/80",
    headerBtnBg: light
      ? "bg-black/15 hover:bg-black/25 text-slate-950"
      : "bg-white/20 hover:bg-white/30 text-white",
    borderHighlight: "border-primary/60 shadow-md",
    dragRing: "ring-2 ring-primary border-primary bg-primary/10",
    pillActive: light ? "bg-black text-white" : "bg-white text-black",
    accentText: "text-primary",
  };
}

/**
 * Hook para obter o tema atual dos quadrantes
 */
export function useQuadrantesTheme() {
  const { branding } = useBranding();

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("financeiro_quadrantes_theme") || branding.quadrantesTheme || "azul"
      );
    } catch {
      return "azul";
    }
  });

  const [customHex, setCustomHex] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("financeiro_quadrantes_custom_hex") ||
        branding.customQuadrantColor ||
        "#0047AB"
      );
    } catch {
      return "#0047AB";
    }
  });

  // Atualiza se vier do Firebase
  useEffect(() => {
    if (branding.quadrantesTheme && branding.quadrantesTheme !== themeId) {
      setThemeId(branding.quadrantesTheme);
    }
    if (branding.customQuadrantColor && branding.customQuadrantColor !== customHex) {
      setCustomHex(branding.customQuadrantColor);
    }
  }, [branding.quadrantesTheme, branding.customQuadrantColor]);

  const saveTheme = async (newThemeId: string, newHex?: string) => {
    setThemeId(newThemeId);
    if (newHex) setCustomHex(newHex);

    try {
      localStorage.setItem("financeiro_quadrantes_theme", newThemeId);
      if (newHex) localStorage.setItem("financeiro_quadrantes_custom_hex", newHex);
    } catch {
      // ignore
    }

    // Persiste no Firebase
    try {
      await saveBrandingSettings({
        quadrantesTheme: newThemeId,
        customQuadrantColor: newHex || customHex,
      });
    } catch (err) {
      console.warn("Erro ao salvar tema no Firebase:", err);
    }
  };

  const currentConfig: QuadranteThemeConfig =
    themeId === "custom"
      ? getCustomQuadranteTheme(customHex)
      : QUADRANTE_THEMES[themeId] || QUADRANTE_THEMES["azul"];

  return {
    themeId,
    customHex,
    themeConfig: currentConfig,
    setTheme: saveTheme,
  };
}

/* -------------------------------------------------------------------------- */
/*                         TEMAS DA BARRA LATERAL (MENU)                      */
/* -------------------------------------------------------------------------- */

export interface SidebarThemeConfig {
  id: string;
  name: string;
  description: string;
  badge: string;
  previewBg: string;
  previewText: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export const SIDEBAR_THEMES: Record<string, SidebarThemeConfig> = {
  vinho: {
    id: "vinho",
    name: "Vinho Nobre",
    description: "Bordô / Marsala clássico do Brasão com detalhes dourados",
    badge: "Padrão",
    previewBg: "#3b0b12",
    previewText: "#fdf2f4",
    sidebar: "#3b0b12",
    sidebarForeground: "#fdf2f4",
    sidebarPrimary: "#d4af37",
    sidebarPrimaryForeground: "#200609",
    sidebarAccent: "#58151f",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#58151f",
    sidebarRing: "#d4af37",
  },
  dourado: {
    id: "dourado",
    name: "Dourado com Texto Preto",
    description: "Ouro nobre com texto e ícones pretos de altíssimo contraste e legibilidade",
    badge: "Elegante",
    previewBg: "#e5c158",
    previewText: "#111827",
    sidebar: "#e5c158",
    sidebarForeground: "#111827",
    sidebarPrimary: "#111827",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#caa234",
    sidebarAccentForeground: "#000000",
    sidebarBorder: "#caa234",
    sidebarRing: "#111827",
  },
  azul: {
    id: "azul",
    name: "Azul Marinho",
    description: "Navy executivo profundo com detalhes celestes e alto contraste",
    badge: "Corporativo",
    previewBg: "#0f172a",
    previewText: "#f8fafc",
    sidebar: "#0f172a",
    sidebarForeground: "#f8fafc",
    sidebarPrimary: "#38bdf8",
    sidebarPrimaryForeground: "#0f172a",
    sidebarAccent: "#1e293b",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#334155",
    sidebarRing: "#38bdf8",
  },
  grafite: {
    id: "grafite",
    name: "Preto / Grafite Dark",
    description: "Design moderno minimalista em preto fosco e cinza suave",
    badge: "Minimalista",
    previewBg: "#121214",
    previewText: "#fafafa",
    sidebar: "#121214",
    sidebarForeground: "#f4f4f5",
    sidebarPrimary: "#e4e4e7",
    sidebarPrimaryForeground: "#18181b",
    sidebarAccent: "#27272a",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#27272a",
    sidebarRing: "#a1a1aa",
  },
  esmeralda: {
    id: "esmeralda",
    name: "Verde Esmeralda",
    description: "Verde floresta profundo com toques menta e atmosfera natural",
    badge: "Natureza",
    previewBg: "#064e3b",
    previewText: "#ecfdf5",
    sidebar: "#064e3b",
    sidebarForeground: "#ecfdf5",
    sidebarPrimary: "#34d399",
    sidebarPrimaryForeground: "#064e3b",
    sidebarAccent: "#065f46",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#047857",
    sidebarRing: "#34d399",
  },
  roxo: {
    id: "roxo",
    name: "Roxo Imperial",
    description: "Púrpura real imponente com acentos em ametista e lilás",
    badge: "Imperial",
    previewBg: "#3b0764",
    previewText: "#faf5ff",
    sidebar: "#3b0764",
    sidebarForeground: "#faf5ff",
    sidebarPrimary: "#c084fc",
    sidebarPrimaryForeground: "#3b0764",
    sidebarAccent: "#4c1d95",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#581c87",
    sidebarRing: "#c084fc",
  },
};

/**
 * Cria configuração para barra lateral personalizada
 */
export function createCustomSidebarTheme(
  hexBg: string,
  forceText?: "black" | "white",
): SidebarThemeConfig {
  const isLight = forceText ? forceText === "black" : isLightColor(hexBg);
  const fg = isLight ? "#111827" : "#FFFFFF";
  const accent = isLight ? "#000000" : "#FFFFFF";
  return {
    id: "custom",
    name: "Personalizado",
    description: "Cor customizada com ajuste inteligente de contraste",
    badge: "Custom",
    previewBg: hexBg,
    previewText: fg,
    sidebar: hexBg,
    sidebarForeground: fg,
    sidebarPrimary: isLight ? "#111827" : "#FFFFFF",
    sidebarPrimaryForeground: isLight ? "#FFFFFF" : "#111827",
    sidebarAccent: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.12)",
    sidebarAccentForeground: accent,
    sidebarBorder: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
    sidebarRing: isLight ? "#111827" : "#FFFFFF",
  };
}

/**
 * Aplica as variáveis CSS do tema da sidebar diretamente ao elemento raiz do DOM
 */
export function applySidebarThemeToDOM(theme: SidebarThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--sidebar-foreground", theme.sidebarForeground);
  root.style.setProperty("--sidebar-primary", theme.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", theme.sidebarPrimaryForeground);
  root.style.setProperty("--sidebar-accent", theme.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", theme.sidebarAccentForeground);
  root.style.setProperty("--sidebar-border", theme.sidebarBorder);
  root.style.setProperty("--sidebar-ring", theme.sidebarRing);
}

/**
 * Hook reativo para gerenciar o tema da Barra Lateral Esquerda
 */
export function useSidebarTheme() {
  const { branding } = useBranding();

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem("brasao_sidebar_theme") || branding.sidebarTheme || "vinho";
    } catch {
      return "vinho";
    }
  });

  const [customHex, setCustomHex] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("brasao_sidebar_custom_hex") ||
        branding.customSidebarColor ||
        "#E5C158"
      );
    } catch {
      return "#E5C158";
    }
  });

  const [customTextColor, setCustomTextColor] = useState<"black" | "white">(() => {
    try {
      return (
        (localStorage.getItem("brasao_sidebar_custom_text") as "black" | "white") ||
        branding.customSidebarTextColor ||
        "black"
      );
    } catch {
      return "black";
    }
  });

  // Atualiza se houver alteração externa / Firebase
  useEffect(() => {
    if (branding.sidebarTheme && branding.sidebarTheme !== themeId) {
      setThemeId(branding.sidebarTheme);
    }
    if (branding.customSidebarColor && branding.customSidebarColor !== customHex) {
      setCustomHex(branding.customSidebarColor);
    }
    if (branding.customSidebarTextColor && branding.customSidebarTextColor !== customTextColor) {
      setCustomTextColor(branding.customSidebarTextColor);
    }
  }, [branding.sidebarTheme, branding.customSidebarColor, branding.customSidebarTextColor]);

  const currentConfig =
    themeId === "custom"
      ? createCustomSidebarTheme(customHex, customTextColor)
      : SIDEBAR_THEMES[themeId] || SIDEBAR_THEMES["vinho"];

  // Aplica ao DOM imediatamente sempre que a configuração mudar
  useEffect(() => {
    applySidebarThemeToDOM(currentConfig);
  }, [currentConfig]);

  const saveTheme = async (
    newThemeId: string,
    newHex?: string,
    newTextColor?: "black" | "white",
  ) => {
    setThemeId(newThemeId);
    if (newHex) setCustomHex(newHex);
    if (newTextColor) setCustomTextColor(newTextColor);

    const cfg =
      newThemeId === "custom"
        ? createCustomSidebarTheme(newHex || customHex, newTextColor || customTextColor)
        : SIDEBAR_THEMES[newThemeId] || SIDEBAR_THEMES["vinho"];

    applySidebarThemeToDOM(cfg);

    try {
      localStorage.setItem("brasao_sidebar_theme", newThemeId);
      if (newHex) localStorage.setItem("brasao_sidebar_custom_hex", newHex);
      if (newTextColor) localStorage.setItem("brasao_sidebar_custom_text", newTextColor);
    } catch {
      // ignore
    }

    try {
      await saveBrandingSettings({
        sidebarTheme: newThemeId,
        customSidebarColor: newHex || customHex,
        customSidebarTextColor: newTextColor || customTextColor,
      });
    } catch (err) {
      console.warn("Erro ao salvar tema da barra lateral no Firebase:", err);
    }
  };

  return {
    themeId,
    customHex,
    customTextColor,
    themeConfig: currentConfig,
    setTheme: saveTheme,
  };
}
