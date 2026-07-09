import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import i18n, { applyDirection } from "@/i18n";

type Language = "en" | "ar" | "sv" | "fr" | "de" | "es" | "tr" | "ur";
export type Theme = "light" | "dark" | "system" | "ocean" | "forest" | "rose" | "sunset" | "purple" | "gold" | "ruby" | "slate";
type FontSize = "small" | "medium" | "large";
export type ClockFormat = "12h" | "24h";
export type ClockLocale = "en" | "ar" | "sv";
export type ClockStyle = "digital" | "boxed" | "neon" | "retro" | "gradient" | "glass" | "flip" | "analog" | "minimal" | "neontube" | "aurora" | "matrix" | "neonring" | "wave" | "calendar" | "pixel" | "sunburst" | "holographic" | "glass3d" | "orbit3d";
export type GlassIntensity = "off" | "light" | "medium" | "strong";
export type BackgroundMode = "default" | "gradient" | "image";
export type ClockSize = "small" | "medium" | "large";
export type AssistantPersonality = "professional" | "friendly" | "concise";
export type AiButtonIcon = "bot" | "sparkles" | "brain" | "zap" | "star" | "heart" | "message" | "cpu" | "wand" | "rocket";
export type AiButtonShape = "circle" | "rounded" | "square" | "gradient" | "neon" | "glass" | "ring";
export type AiButtonColor = "primary" | "violet" | "rose" | "amber" | "emerald" | "sky" | "slate" | "black" | "white" | "custom";
export type SidebarStyle = "default" | "compact" | "icon-only" | "wide";
export type TableStyle = "comfortable" | "compact" | "cozy";
export type CardStyle = "rounded" | "sharp" | "glass";

interface SettingsContextType {
  language: Language;
  theme: Theme;
  fontSize: FontSize;
  ttsEnabled: boolean;
  wakeWord: string;
  assistantName: string;
  assistantPersonality: AssistantPersonality;
  aiButtonIcon: AiButtonIcon;
  aiButtonShape: AiButtonShape;
  aiButtonColor: AiButtonColor;
  aiButtonCustomColor: string;
  accentColor: string;
  clockFormat: ClockFormat;
  clockLocale: ClockLocale;
  clockStyle: ClockStyle;
  clockSize: ClockSize;
  floatingClockEnabled: boolean;
  floatingClockCheckIn: boolean;
  sidebarStyle: SidebarStyle;
  tableStyle: TableStyle;
  cardStyle: CardStyle;
  glassIntensity: GlassIntensity;
  backgroundMode: BackgroundMode;
  backgroundImage: string;
  backgroundGradient: string;
  setGlassIntensity: (v: GlassIntensity) => void;
  setBackgroundMode: (v: BackgroundMode) => void;
  setBackgroundImage: (v: string) => void;
  setBackgroundGradient: (v: string) => void;
  resetAppearance: () => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setTtsEnabled: (v: boolean) => void;
  setWakeWord: (v: string) => void;
  setAssistantName: (v: string) => void;
  setAssistantPersonality: (v: AssistantPersonality) => void;
  setAiButtonIcon: (v: AiButtonIcon) => void;
  setAiButtonShape: (v: AiButtonShape) => void;
  setAiButtonColor: (v: AiButtonColor) => void;
  setAiButtonCustomColor: (v: string) => void;
  setClockFormat: (v: ClockFormat) => void;
  setClockLocale: (v: ClockLocale) => void;
  setClockStyle: (v: ClockStyle) => void;
  setClockSize: (v: ClockSize) => void;
  setFloatingClockEnabled: (v: boolean) => void;
  setFloatingClockCheckIn: (v: boolean) => void;
  setSidebarStyle: (v: SidebarStyle) => void;
  setTableStyle: (v: TableStyle) => void;
  setCardStyle: (v: CardStyle) => void;
  setAccentColor: (v: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem("settings_lang") as Language) || "en");
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("settings_theme") as Theme) || "system");
  const [fontSize, setFontSizeState] = useState<FontSize>(() => (localStorage.getItem("settings_size") as FontSize) || "medium");
  const [ttsEnabled, setTtsEnabledState] = useState<boolean>(() => localStorage.getItem("setting_tts") !== "false");
  const [wakeWord, setWakeWordState] = useState<string>(() => localStorage.getItem("setting_wake_word") ?? "مساعد");
  const [assistantName, setAssistantNameState] = useState<string>(() => localStorage.getItem("setting_assistant_name") ?? "مساعدي");
  const [assistantPersonality, setAssistantPersonalityState] = useState<AssistantPersonality>(() => (localStorage.getItem("setting_assistant_personality") as AssistantPersonality) ?? "friendly");
  const [clockFormat, setClockFormatState] = useState<ClockFormat>(() => (localStorage.getItem("setting_clock_format") as ClockFormat) || "24h");
  const [clockLocale, setClockLocaleState] = useState<ClockLocale>(() => (localStorage.getItem("setting_clock_locale") as ClockLocale) || "en");
  const [clockStyle, setClockStyleState] = useState<ClockStyle>(() => (localStorage.getItem("setting_clock_style") as ClockStyle) || "digital");
  const [clockSize, setClockSizeState] = useState<ClockSize>(() => (localStorage.getItem("setting_clock_size") as ClockSize) || "medium");
  const [floatingClockEnabled, setFloatingClockEnabledState] = useState<boolean>(() => localStorage.getItem("setting_floating_clock") !== "false");
  const [floatingClockCheckIn, setFloatingClockCheckInState] = useState<boolean>(() => localStorage.getItem("setting_floating_checkin") !== "false");
  const [aiButtonIcon, setAiButtonIconState] = useState<AiButtonIcon>(() => (localStorage.getItem("setting_ai_icon") as AiButtonIcon) || "bot");
  const [aiButtonShape, setAiButtonShapeState] = useState<AiButtonShape>(() => (localStorage.getItem("setting_ai_shape") as AiButtonShape) || "circle");
  const [aiButtonColor, setAiButtonColorState] = useState<AiButtonColor>(() => (localStorage.getItem("setting_ai_color") as AiButtonColor) || "primary");
  const [aiButtonCustomColor, setAiButtonCustomColorState] = useState<string>(() => localStorage.getItem("setting_ai_custom_color") || "#6366f1");
  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => (localStorage.getItem("setting_sidebar_style") as SidebarStyle) || "default");
  const [tableStyle, setTableStyleState] = useState<TableStyle>(() => (localStorage.getItem("setting_table_style") as TableStyle) || "comfortable");
  const [cardStyle, setCardStyleState] = useState<CardStyle>(() => (localStorage.getItem("setting_card_style") as CardStyle) || "rounded");
  const [accentColor, setAccentColorState] = useState<string>(() => localStorage.getItem("setting_accent_color") || "");
  const [glassIntensity, setGlassIntensityState] = useState<GlassIntensity>(() => (localStorage.getItem("setting_glass_intensity") as GlassIntensity) || "off");
  const [backgroundMode, setBackgroundModeState] = useState<BackgroundMode>(() => (localStorage.getItem("setting_bg_mode") as BackgroundMode) || "default");
  const [backgroundImage, setBackgroundImageState] = useState<string>(() => localStorage.getItem("setting_bg_image") || "");
  const [backgroundGradient, setBackgroundGradientState] = useState<string>(() => localStorage.getItem("setting_bg_gradient") || "aurora");

  const COLOR_THEMES: Theme[] = ["ocean", "forest", "rose", "sunset", "purple", "gold", "ruby", "slate"];

  const THEME_VARS: Record<string, { primary: string; foreground: string; ring: string; accent: string; accentFg: string }> = {
    ocean:  { primary: "186 72% 37%", foreground: "0 0% 100%", ring: "186 72% 37%", accent: "186 40% 92%", accentFg: "186 72% 20%" },
    forest: { primary: "142 68% 32%", foreground: "0 0% 100%", ring: "142 68% 32%", accent: "142 40% 92%", accentFg: "142 68% 15%" },
    rose:   { primary: "347 77% 52%", foreground: "0 0% 100%", ring: "347 77% 52%", accent: "347 60% 94%", accentFg: "347 77% 25%" },
    sunset: { primary: "24 92% 48%",  foreground: "0 0% 100%", ring: "24 92% 48%",  accent: "24 80% 93%",  accentFg: "24 92% 22%"  },
    purple: { primary: "267 72% 52%", foreground: "0 0% 100%", ring: "267 72% 52%", accent: "267 60% 94%", accentFg: "267 72% 24%" },
    gold:   { primary: "43 96% 44%",  foreground: "0 0% 100%", ring: "43 96% 44%",  accent: "43 90% 93%",  accentFg: "43 96% 18%"  },
    ruby:   { primary: "0 84% 50%",   foreground: "0 0% 100%", ring: "0 84% 50%",   accent: "0 70% 94%",   accentFg: "0 84% 22%"   },
    slate:  { primary: "215 25% 35%", foreground: "0 0% 100%", ring: "215 25% 35%", accent: "215 20% 92%",  accentFg: "215 25% 15%" },
  };

  const clearThemeVars = (root: HTMLElement) => {
    ["--primary","--primary-foreground","--ring","--sidebar-primary","--sidebar-ring","--chart-1","--accent","--accent-foreground"].forEach(v => root.style.removeProperty(v));
  };

  const applyTheme = (t: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", ...COLOR_THEMES.map(c => `theme-${c}`));
    clearThemeVars(root);
    if (t === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else if (COLOR_THEMES.includes(t)) {
      root.classList.add("light");
      const vars = THEME_VARS[t];
      if (vars) {
        root.style.setProperty("--primary", vars.primary);
        root.style.setProperty("--primary-foreground", vars.foreground);
        root.style.setProperty("--ring", vars.ring);
        root.style.setProperty("--sidebar-primary", vars.primary);
        root.style.setProperty("--sidebar-ring", vars.ring);
        root.style.setProperty("--chart-1", vars.primary);
        root.style.setProperty("--accent", vars.accent);
        root.style.setProperty("--accent-foreground", vars.accentFg);
      }
    } else {
      root.classList.add(t);
    }
  };

  const applyUiStyles = (sidebar: SidebarStyle, table: TableStyle, card: CardStyle) => {
    const root = document.documentElement;
    root.setAttribute("data-sidebar", sidebar);
    root.setAttribute("data-table", table);
    root.setAttribute("data-card", card);
  };

  const GRADIENTS: Record<string, string> = {
    aurora:  "radial-gradient(circle at 15% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 85% 80%, rgba(6,182,212,0.30), transparent 55%), linear-gradient(160deg, #0b1020, #1a1f3a)",
    sunset:  "radial-gradient(circle at 20% 20%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.30), transparent 55%), linear-gradient(160deg, #1a0f1f, #2a1230)",
    ocean:   "radial-gradient(circle at 20% 10%, rgba(34,211,238,0.30), transparent 55%), radial-gradient(circle at 80% 90%, rgba(59,130,246,0.30), transparent 55%), linear-gradient(160deg, #061627, #0a2540)",
    emerald: "radial-gradient(circle at 15% 25%, rgba(16,185,129,0.30), transparent 55%), radial-gradient(circle at 85% 75%, rgba(20,184,166,0.28), transparent 55%), linear-gradient(160deg, #06201a, #0a2e24)",
  };

  const applyBackground = (mode: BackgroundMode, image: string, gradient: string) => {
    const body = document.body;
    body.classList.remove("app-bg-custom");
    body.style.backgroundImage = "";
    body.style.backgroundSize = "";
    body.style.backgroundPosition = "";
    body.style.backgroundAttachment = "";
    body.style.backgroundRepeat = "";
    if (mode === "image" && image) {
      body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url(${image})`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundAttachment = "fixed";
      body.style.backgroundRepeat = "no-repeat";
      body.classList.add("app-bg-custom");
    } else if (mode === "gradient") {
      body.style.backgroundImage = GRADIENTS[gradient] || GRADIENTS.aurora;
      body.style.backgroundAttachment = "fixed";
      body.classList.add("app-bg-custom");
    }
  };

  const applyGlass = (v: GlassIntensity) => {
    document.documentElement.setAttribute("data-glass", v);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("settings_lang", lang);
    i18n.changeLanguage(lang);
    applyDirection(lang);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("settings_theme", t);
    applyTheme(t);
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem("settings_size", size);
    document.documentElement.classList.remove("text-font-small", "text-font-medium", "text-font-large");
    document.documentElement.classList.add(`text-font-${size}`);
  };

  const setTtsEnabled = (v: boolean) => { setTtsEnabledState(v); localStorage.setItem("setting_tts", String(v)); };
  const setWakeWord = (v: string) => { setWakeWordState(v); localStorage.setItem("setting_wake_word", v); };
  const setAssistantName = (v: string) => { setAssistantNameState(v); localStorage.setItem("setting_assistant_name", v); };
  const setAssistantPersonality = (v: AssistantPersonality) => { setAssistantPersonalityState(v); localStorage.setItem("setting_assistant_personality", v); };
  const setClockFormat = (v: ClockFormat) => { setClockFormatState(v); localStorage.setItem("setting_clock_format", v); };
  const setClockLocale = (v: ClockLocale) => { setClockLocaleState(v); localStorage.setItem("setting_clock_locale", v); };
  const setClockStyle = (v: ClockStyle) => { setClockStyleState(v); localStorage.setItem("setting_clock_style", v); };
  const setClockSize = (v: ClockSize) => { setClockSizeState(v); localStorage.setItem("setting_clock_size", v); };
  const setFloatingClockEnabled = (v: boolean) => { setFloatingClockEnabledState(v); localStorage.setItem("setting_floating_clock", String(v)); };
  const setFloatingClockCheckIn = (v: boolean) => { setFloatingClockCheckInState(v); localStorage.setItem("setting_floating_checkin", String(v)); };
  const setAiButtonIcon = (v: AiButtonIcon) => { setAiButtonIconState(v); localStorage.setItem("setting_ai_icon", v); };
  const setAiButtonShape = (v: AiButtonShape) => { setAiButtonShapeState(v); localStorage.setItem("setting_ai_shape", v); };
  const setAiButtonColor = (v: AiButtonColor) => { setAiButtonColorState(v); localStorage.setItem("setting_ai_color", v); };
  const setAiButtonCustomColor = (v: string) => { setAiButtonCustomColorState(v); localStorage.setItem("setting_ai_custom_color", v); };

  const setSidebarStyle = (v: SidebarStyle) => {
    setSidebarStyleState(v);
    localStorage.setItem("setting_sidebar_style", v);
    applyUiStyles(v, tableStyle, cardStyle);
  };

  const setTableStyle = (v: TableStyle) => {
    setTableStyleState(v);
    localStorage.setItem("setting_table_style", v);
    applyUiStyles(sidebarStyle, v, cardStyle);
  };

  const setCardStyle = (v: CardStyle) => {
    setCardStyleState(v);
    localStorage.setItem("setting_card_style", v);
    applyUiStyles(sidebarStyle, tableStyle, v);
  };

  const setGlassIntensity = (v: GlassIntensity) => {
    setGlassIntensityState(v);
    localStorage.setItem("setting_glass_intensity", v);
    applyGlass(v);
  };

  const setBackgroundMode = (v: BackgroundMode) => {
    setBackgroundModeState(v);
    localStorage.setItem("setting_bg_mode", v);
    applyBackground(v, backgroundImage, backgroundGradient);
  };

  const setBackgroundImage = (v: string) => {
    setBackgroundImageState(v);
    localStorage.setItem("setting_bg_image", v);
    applyBackground(backgroundMode, v, backgroundGradient);
  };

  const setBackgroundGradient = (v: string) => {
    setBackgroundGradientState(v);
    localStorage.setItem("setting_bg_gradient", v);
    applyBackground(backgroundMode, backgroundImage, v);
  };

  const resetAppearance = () => {
    setGlassIntensityState("off");
    localStorage.setItem("setting_glass_intensity", "off");
    applyGlass("off");

    setBackgroundModeState("default");
    localStorage.setItem("setting_bg_mode", "default");
    setBackgroundImageState("");
    localStorage.setItem("setting_bg_image", "");
    setBackgroundGradientState("aurora");
    localStorage.setItem("setting_bg_gradient", "aurora");
    applyBackground("default", "", "aurora");

    setCardStyle("rounded");
  };

  const applyAccentHex = (hex: string) => {
    if (!hex) return;
    const root = document.documentElement;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const maxN = max * 255;
      if (maxN === r) h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6;
      else if (maxN === g) h = ((b - r) / 255 / d + 2) / 6;
      else h = ((r - g) / 255 / d + 4) / 6;
    }
    const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
  };

  const setAccentColor = (v: string) => {
    setAccentColorState(v);
    localStorage.setItem("setting_accent_color", v);
    applyAccentHex(v);
  };

  useEffect(() => {
    applyTheme(theme);
    applyDirection(language);
    i18n.changeLanguage(language);
    document.documentElement.classList.remove("text-font-small", "text-font-medium", "text-font-large");
    document.documentElement.classList.add(`text-font-${fontSize}`);
    applyUiStyles(sidebarStyle, tableStyle, cardStyle);
    if (accentColor) applyAccentHex(accentColor);
    applyGlass(glassIntensity);
    applyBackground(backgroundMode, backgroundImage, backgroundGradient);
  }, []);

  return (
    <SettingsContext.Provider value={{
      language, theme, fontSize, ttsEnabled, wakeWord, assistantName, assistantPersonality,
      aiButtonIcon, aiButtonShape, aiButtonColor, aiButtonCustomColor,
      clockFormat, clockLocale, clockStyle, clockSize, floatingClockEnabled, floatingClockCheckIn,
      sidebarStyle, tableStyle, cardStyle, accentColor,
      glassIntensity, backgroundMode, backgroundImage, backgroundGradient,
      setLanguage, setTheme, setFontSize, setTtsEnabled, setWakeWord, setAssistantName, setAssistantPersonality,
      setAiButtonIcon, setAiButtonShape, setAiButtonColor, setAiButtonCustomColor,
      setClockFormat, setClockLocale, setClockStyle, setClockSize, setFloatingClockEnabled, setFloatingClockCheckIn,
      setSidebarStyle, setTableStyle, setCardStyle, setAccentColor,
      setGlassIntensity, setBackgroundMode, setBackgroundImage, setBackgroundGradient, resetAppearance,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
}
