import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import i18n, { applyDirection } from "@/i18n";

type Language = "en" | "ar" | "sv" | "fr" | "de" | "es" | "tr" | "ur";
export type Theme = "light" | "dark" | "system" | "ocean" | "forest" | "rose" | "sunset" | "purple" | "gold" | "ruby" | "slate" | "indigo" | "lime" | "coral" | "midnight" | "deepPurple" | "violet" | "navy" | "magenta" | "amber" | "copper" | "sakura" | "arctic";
export type Currency = "USD" | "EUR" | "SEK";
type FontSize = "small" | "medium" | "large";
export type FontFamily = "default" | "inter" | "nunito" | "poppins" | "cairo" | "tajawal" | "ibm";
export type FontWeight = "light" | "normal" | "semibold" | "bold" | "heavy";
export type ClockFormat = "12h" | "24h";
export type ClockLocale = "en" | "ar" | "sv";
export type ClockStyle = "digital" | "boxed" | "neon" | "retro" | "gradient" | "glass" | "flip" | "analog" | "minimal" | "neontube" | "aurora" | "matrix" | "neonring" | "wave" | "calendar" | "pixel" | "sunburst" | "holographic" | "glass3d" | "orbit3d" | "watch3d" | "desk3d" | "crystal3d" | "scifi" | "holo" | "techroom" | "cardash";
export type GlassIntensity = "off" | "light" | "medium" | "strong";
export type BackgroundMode = "default" | "gradient" | "image";
export type ClockSize = "small" | "medium" | "large";
export type AssistantPersonality = "professional" | "friendly" | "concise";
export type AiButtonIcon = "bot" | "sparkles" | "brain" | "zap" | "star" | "heart" | "message" | "cpu" | "wand" | "rocket" | "shield" | "globe" | "atom" | "compass" | "gem" | "ghost" | "crown" | "coffee" | "flame" | "target" | "robot3d" | "gem3d" | "brain3d" | "fire3d" | "star3d" | "orb3d" | "shield3d" | "crown3d" | "rocket3d" | "eye3d" | "neural3d" | "hologram3d" | "infinity3d" | "dna3d" | "chip3d";
export type AiButtonShape = "circle" | "rounded" | "square" | "gradient" | "neon" | "glass" | "ring" | "pill" | "hexagon" | "blob";
export type AvatarStyle = "human" | "robot" | "cat" | "alien" | "panda" | "fox";
export type AiButtonSize = "small" | "medium" | "large";
export type AiButtonColor = "primary" | "violet" | "rose" | "amber" | "emerald" | "sky" | "slate" | "black" | "white" | "custom";
export type SidebarStyle = "default" | "compact" | "icon-only" | "wide";
export type TableStyle = "comfortable" | "compact" | "cozy";
export type CardStyle = "rounded" | "sharp" | "glass";
export type CardColorMode = "auto" | "custom";
export type FontColorMode = "auto" | "custom";
export type AnimationSpeed = "off" | "slow" | "normal" | "fast";
export type ShadowDepth = "flat" | "soft" | "elevated" | "dramatic";
export type DensityMode = "compact" | "normal" | "spacious";
export type ScrollbarStyle = "default" | "thin" | "accent";
export type SidebarColorTheme = "dark" | "light" | "accent" | "transparent";
export type AuroraPalette = "indigo" | "ocean" | "emerald" | "rose" | "gold";
export type WelcomeShape = "none" | "sphere" | "cube" | "ring" | "diamond" | "pyramid";
export type WelcomeStyle = "gradient" | "glass" | "card" | "minimal";
export type SplashBgGradient = "cosmic" | "ocean" | "forest" | "midnight" | "rose" | "amber" | "dark";
export type SplashStyle = "style1" | "style2" | "style3" | "style4" | "style5" | "style6" | "style7" | "style8" | "style9";

interface SettingsContextType {
  language: Language;
  theme: Theme;
  currency: Currency;
  setCurrency: (v: Currency) => void;
  fontSize: FontSize;
  fontFamily: FontFamily;
  setFontFamily: (v: FontFamily) => void;
  fontWeight: FontWeight;
  setFontWeight: (v: FontWeight) => void;
  ttsEnabled: boolean;
  wakeWord: string;
  assistantName: string;
  assistantPersonality: AssistantPersonality;
  aiButtonIcon: AiButtonIcon;
  aiButtonShape: AiButtonShape;
  aiButtonColor: AiButtonColor;
  aiEnabled: boolean;
  aiAvatarStyle: AvatarStyle;
  aiButtonSize: AiButtonSize;
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
  cardColorMode: CardColorMode;
  cardColor: string;
  fontColorMode: FontColorMode;
  fontColor: string;
  glassIntensity: GlassIntensity;
  backgroundMode: BackgroundMode;
  backgroundImage: string;
  backgroundGradient: string;
  /* ── New visual-effects settings ── */
  auroraBgEnabled: boolean;
  particlesEnabled: boolean;
  mouseLightEnabled: boolean;
  auroraPalette: AuroraPalette;
  welcomeBannerEnabled: boolean;
  welcomeMessage: string;
  welcomeShape: WelcomeShape;
  welcomeImage: string;
  welcomeTitle: string;
  welcomeStyle: WelcomeStyle;
  aiVoiceResponse: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  latenessAlertEnabled: boolean;
  latenessAlertDays: number;
  dashboardCardOrder: string;
  dashboardCardsHidden: string;
  /* ── Setters ── */
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
  setAiEnabled: (v: boolean) => void;
  setAiAvatarStyle: (v: AvatarStyle) => void;
  setAiButtonSize: (v: AiButtonSize) => void;
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
  setCardColorMode: (v: CardColorMode) => void;
  setCardColor: (v: string) => void;
  setFontColorMode: (v: FontColorMode) => void;
  setFontColor: (v: string) => void;
  setAccentColor: (v: string) => void;
  setAuroraBgEnabled: (v: boolean) => void;
  setParticlesEnabled: (v: boolean) => void;
  setMouseLightEnabled: (v: boolean) => void;
  setAuroraPalette: (v: AuroraPalette) => void;
  setWelcomeBannerEnabled: (v: boolean) => void;
  setWelcomeMessage: (v: string) => void;
  setWelcomeShape: (v: WelcomeShape) => void;
  setWelcomeImage: (v: string) => void;
  setWelcomeTitle: (v: string) => void;
  setWelcomeStyle: (v: WelcomeStyle) => void;
  setAiVoiceResponse: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setSoundVolume: (v: number) => void;
  setLatenessAlertEnabled: (v: boolean) => void;
  setLatenessAlertDays: (v: number) => void;
  setDashboardCardOrder: (v: string) => void;
  setDashboardCardsHidden: (v: string) => void;
  /* ── Splash screen ── */
  splashBgGradient: SplashBgGradient;
  splashTagline: string;
  splashDuration: number;
  splashShowStars: boolean;
  splashShowParticles: boolean;
  splashLogoUrl: string;
  splashLogoWidth: number;
  splashLogoHeight: number;
  splashLogoRadius: number;
  splashLogoOffsetX: number;
  splashLogoOffsetY: number;
  splashLogoBgSize: number;
  splashAppName: string;
  setSplashBgGradient: (v: SplashBgGradient) => void;
  setSplashTagline: (v: string) => void;
  setSplashDuration: (v: number) => void;
  setSplashShowStars: (v: boolean) => void;
  setSplashShowParticles: (v: boolean) => void;
  setSplashLogoUrl: (v: string) => void;
  setSplashLogoWidth: (v: number) => void;
  setSplashLogoHeight: (v: number) => void;
  setSplashLogoRadius: (v: number) => void;
  setSplashLogoOffsetX: (v: number) => void;
  setSplashLogoOffsetY: (v: number) => void;
  setSplashLogoBgSize: (v: number) => void;
  setSplashAppName: (v: string) => void;
  splashStyle: SplashStyle;
  setSplashStyle: (v: SplashStyle) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  /* ── Existing settings ─────────────────────────────────────────── */
  const [language, setLanguageState]           = useState<Language>(() => (localStorage.getItem("settings_lang") as Language) || "en");
  const [theme, setThemeState]                 = useState<Theme>(() => (localStorage.getItem("settings_theme") as Theme) || "system");
  const [fontSize, setFontSizeState]           = useState<FontSize>(() => (localStorage.getItem("settings_size") as FontSize) || "medium");
  const [ttsEnabled, setTtsEnabledState]       = useState<boolean>(() => localStorage.getItem("setting_tts") !== "false");
  const [wakeWord, setWakeWordState]           = useState<string>(() => localStorage.getItem("setting_wake_word") ?? "مساعد");
  const [assistantName, setAssistantNameState] = useState<string>(() => localStorage.getItem("setting_assistant_name") ?? "مساعدي");
  const [assistantPersonality, setAssistantPersonalityState] = useState<AssistantPersonality>(() => (localStorage.getItem("setting_assistant_personality") as AssistantPersonality) ?? "friendly");
  const [clockFormat, setClockFormatState]     = useState<ClockFormat>(() => (localStorage.getItem("setting_clock_format") as ClockFormat) || "24h");
  const [clockLocale, setClockLocaleState]     = useState<ClockLocale>(() => (localStorage.getItem("setting_clock_locale") as ClockLocale) || "en");
  const [clockStyle, setClockStyleState]       = useState<ClockStyle>(() => (localStorage.getItem("setting_clock_style") as ClockStyle) || "digital");
  const [clockSize, setClockSizeState]         = useState<ClockSize>(() => (localStorage.getItem("setting_clock_size") as ClockSize) || "medium");
  const [floatingClockEnabled, setFloatingClockEnabledState] = useState<boolean>(() => localStorage.getItem("setting_floating_clock") !== "false");
  const [floatingClockCheckIn, setFloatingClockCheckInState] = useState<boolean>(() => localStorage.getItem("setting_floating_checkin") !== "false");
  const [aiButtonIcon, setAiButtonIconState]   = useState<AiButtonIcon>(() => (localStorage.getItem("setting_ai_icon") as AiButtonIcon) || "bot");
  const [aiButtonShape, setAiButtonShapeState] = useState<AiButtonShape>(() => (localStorage.getItem("setting_ai_shape") as AiButtonShape) || "circle");
  const [aiEnabled, setAiEnabledState]         = useState<boolean>(() => localStorage.getItem("setting_ai_enabled") !== "false");
  const [aiAvatarStyle, setAiAvatarStyleState] = useState<AvatarStyle>(() => (localStorage.getItem("setting_ai_avatar") as AvatarStyle) || "human");
  const [aiButtonSize, setAiButtonSizeState]   = useState<AiButtonSize>(() => (localStorage.getItem("setting_ai_size") as AiButtonSize) || "medium");
  const [aiButtonColor, setAiButtonColorState] = useState<AiButtonColor>(() => (localStorage.getItem("setting_ai_color") as AiButtonColor) || "primary");
  const [aiButtonCustomColor, setAiButtonCustomColorState] = useState<string>(() => localStorage.getItem("setting_ai_custom_color") || "#6366f1");
  const [sidebarStyle, setSidebarStyleState]   = useState<SidebarStyle>(() => (localStorage.getItem("setting_sidebar_style") as SidebarStyle) || "default");
  const [tableStyle, setTableStyleState]       = useState<TableStyle>(() => (localStorage.getItem("setting_table_style") as TableStyle) || "comfortable");
  const [cardStyle, setCardStyleState]         = useState<CardStyle>(() => (localStorage.getItem("setting_card_style") as CardStyle) || "rounded");
  const [cardColorMode, setCardColorModeState] = useState<CardColorMode>(() => (localStorage.getItem("setting_card_color_mode") as CardColorMode) || "auto");
  const [cardColor, setCardColorState]         = useState<string>(() => localStorage.getItem("setting_card_color") || "#1e293b");
  const [fontColorMode, setFontColorModeState] = useState<FontColorMode>(() => (localStorage.getItem("setting_font_color_mode") as FontColorMode) || "auto");
  const [fontColor, setFontColorState]         = useState<string>(() => localStorage.getItem("setting_font_color") || "#1e293b");
  const [fontFamily, setFontFamilyState]       = useState<FontFamily>(() => (localStorage.getItem("setting_font_family") as FontFamily) || "default");
  const [fontWeight, setFontWeightState]       = useState<FontWeight>(() => (localStorage.getItem("setting_font_weight") as FontWeight) || "normal");
  const [accentColor, setAccentColorState]     = useState<string>(() => localStorage.getItem("setting_accent_color") || "");
  const [glassIntensity, setGlassIntensityState] = useState<GlassIntensity>(() => (localStorage.getItem("setting_glass_intensity") as GlassIntensity) || "off");
  const [backgroundMode, setBackgroundModeState] = useState<BackgroundMode>(() => (localStorage.getItem("setting_bg_mode") as BackgroundMode) || "default");
  const [backgroundImage, setBackgroundImageState] = useState<string>(() => localStorage.getItem("setting_bg_image") || "");
  const [backgroundGradient, setBackgroundGradientState] = useState<string>(() => localStorage.getItem("setting_bg_gradient") || "aurora");

  /* ── New visual-effects settings ──────────────────────────────── */
  const [auroraBgEnabled, setAuroraBgEnabledState]       = useState<boolean>(() => localStorage.getItem("setting_aurora_bg") !== "false");
  const [particlesEnabled, setParticlesEnabledState]     = useState<boolean>(() => localStorage.getItem("setting_particles") !== "false");
  const [mouseLightEnabled, setMouseLightEnabledState]   = useState<boolean>(() => localStorage.getItem("setting_mouse_light") !== "false");
  const [auroraPalette, setAuroraPaletteState]           = useState<AuroraPalette>(() => (localStorage.getItem("setting_aurora_palette") as AuroraPalette) || "indigo");
  const [welcomeBannerEnabled, setWelcomeBannerEnabledState] = useState<boolean>(() => localStorage.getItem("setting_welcome_banner") !== "false");
  const [welcomeMessage, setWelcomeMessageState] = useState<string>(() => localStorage.getItem("setting_welcome_message") || "");
  const [welcomeShape, setWelcomeShapeState] = useState<WelcomeShape>(() => (localStorage.getItem("setting_welcome_shape") as WelcomeShape) || "none");
  const [welcomeImage, setWelcomeImageState] = useState<string>(() => localStorage.getItem("setting_welcome_image") || "");
  const [welcomeTitle, setWelcomeTitleState] = useState<string>(() => localStorage.getItem("setting_welcome_title") || "");
  const [welcomeStyle, setWelcomeStyleState] = useState<WelcomeStyle>(() => (localStorage.getItem("setting_welcome_style") as WelcomeStyle) || "gradient");
  const [aiVoiceResponse, setAiVoiceResponseState] = useState<boolean>(() => localStorage.getItem("setting_ai_voice_response") === "true");
  const [soundEnabled, setSoundEnabledState]             = useState<boolean>(() => localStorage.getItem("setting_sound_enabled") !== "false");
  const [soundVolume, setSoundVolumeState]               = useState<number>(() => Number(localStorage.getItem("setting_sound_volume") || "60"));
  const [latenessAlertEnabled, setLatenessAlertEnabledState] = useState<boolean>(() => localStorage.getItem("setting_lateness_alert") !== "false");
  const [latenessAlertDays, setLatenessAlertDaysState]   = useState<number>(() => Number(localStorage.getItem("setting_lateness_days") || "3"));
  const [dashboardCardOrder, setDashboardCardOrderState] = useState<string>(() => localStorage.getItem("setting_dashboard_order") || "");
  const [dashboardCardsHidden, setDashboardCardsHiddenState] = useState<string>(() => localStorage.getItem("setting_dashboard_hidden") || "[]");
  const [currency, setCurrencyState] = useState<Currency>(() => (localStorage.getItem("setting_currency") as Currency) || "USD");
  /* ── Splash screen ─────────────────────────────────────────── */
  const [splashBgGradient, setSplashBgGradientState] = useState<SplashBgGradient>(() => (localStorage.getItem("setting_splash_bg") as SplashBgGradient) || "cosmic");
  const [splashTagline, setSplashTaglineState] = useState<string>(() => localStorage.getItem("setting_splash_tagline") || "");
  const [splashDuration, setSplashDurationState] = useState<number>(() => Number(localStorage.getItem("setting_splash_duration") || "6"));
  const [splashShowStars, setSplashShowStarsState] = useState<boolean>(() => localStorage.getItem("setting_splash_stars") !== "false");
  const [splashShowParticles, setSplashShowParticlesState] = useState<boolean>(() => localStorage.getItem("setting_splash_particles") !== "false");
  const [splashLogoUrl, setSplashLogoUrlState] = useState<string>(() => localStorage.getItem("setting_splash_logo") || "");
  const [splashLogoWidth, setSplashLogoWidthState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_w") || "100"));
  const [splashLogoHeight, setSplashLogoHeightState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_h") || "100"));
  const [splashLogoRadius, setSplashLogoRadiusState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_r") || "40"));
  const [splashLogoOffsetX, setSplashLogoOffsetXState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_ox") || "0"));
  const [splashLogoOffsetY, setSplashLogoOffsetYState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_oy") || "0"));
  const [splashLogoBgSize, setSplashLogoBgSizeState] = useState<number>(() => Number(localStorage.getItem("setting_splash_logo_bg") || "15"));
  const [splashAppName, setSplashAppNameState] = useState<string>(() => localStorage.getItem("setting_splash_app_name") || "");
  const [splashStyle, setSplashStyleState] = useState<SplashStyle>(() => (localStorage.getItem("setting_splash_style") as SplashStyle) || "style1");
  /* ── Theme helpers ─────────────────────────────────────────────── */
  /* Light-based color themes: force light mode + a colored accent. */
  const LIGHT_COLOR_THEMES: Theme[] = ["ocean", "forest", "rose", "sunset", "purple", "gold", "ruby", "slate", "indigo", "lime", "coral", "violet", "magenta", "amber", "copper", "sakura", "arctic"];
  /* Dark-based color themes: force dark mode + a colored accent. */
  const DARK_COLOR_THEMES: Theme[] = ["midnight", "deepPurple", "navy"];
  const COLOR_THEMES: Theme[] = [...LIGHT_COLOR_THEMES, ...DARK_COLOR_THEMES];

  const THEME_VARS: Record<string, { primary: string; foreground: string; ring: string; accent: string; accentFg: string }> = {
    ocean:      { primary: "186 72% 37%", foreground: "0 0% 100%", ring: "186 72% 37%", accent: "186 40% 92%", accentFg: "186 72% 20%" },
    forest:     { primary: "142 68% 32%", foreground: "0 0% 100%", ring: "142 68% 32%", accent: "142 40% 92%", accentFg: "142 68% 15%" },
    rose:       { primary: "347 77% 52%", foreground: "0 0% 100%", ring: "347 77% 52%", accent: "347 60% 94%", accentFg: "347 77% 25%" },
    sunset:     { primary: "24 92% 48%",  foreground: "0 0% 100%", ring: "24 92% 48%",  accent: "24 80% 93%",  accentFg: "24 92% 22%"  },
    purple:     { primary: "267 72% 52%", foreground: "0 0% 100%", ring: "267 72% 52%", accent: "267 60% 94%", accentFg: "267 72% 24%" },
    gold:       { primary: "43 96% 44%",  foreground: "0 0% 100%", ring: "43 96% 44%",  accent: "43 90% 93%",  accentFg: "43 96% 18%"  },
    ruby:       { primary: "0 84% 50%",   foreground: "0 0% 100%", ring: "0 84% 50%",   accent: "0 70% 94%",   accentFg: "0 84% 22%"   },
    slate:      { primary: "215 25% 35%", foreground: "0 0% 100%", ring: "215 25% 35%", accent: "215 20% 92%", accentFg: "215 25% 15%" },
    indigo:     { primary: "243 75% 59%", foreground: "0 0% 100%", ring: "243 75% 59%", accent: "243 60% 94%", accentFg: "243 75% 28%" },
    lime:       { primary: "90 55% 32%",  foreground: "0 0% 100%", ring: "90 55% 32%",  accent: "90 45% 92%",  accentFg: "90 55% 16%"  },
    coral:      { primary: "12 85% 55%",  foreground: "0 0% 100%", ring: "12 85% 55%",  accent: "12 80% 93%",  accentFg: "12 85% 25%"  },
    midnight:   { primary: "243 75% 65%", foreground: "0 0% 100%", ring: "243 75% 65%", accent: "243 40% 22%", accentFg: "0 0% 100%"  },
    /* ── New themes ── */
    deepPurple: { primary: "272 85% 48%", foreground: "0 0% 100%", ring: "272 85% 48%", accent: "272 55% 20%", accentFg: "0 0% 100%"  },
    violet:     { primary: "258 90% 62%", foreground: "0 0% 100%", ring: "258 90% 62%", accent: "258 65% 93%", accentFg: "258 90% 27%" },
    navy:       { primary: "210 100% 60%",foreground: "0 0% 100%", ring: "210 100% 60%",accent: "210 65% 20%", accentFg: "0 0% 100%"  },
    magenta:    { primary: "295 70% 50%", foreground: "0 0% 100%", ring: "295 70% 50%", accent: "295 55% 93%", accentFg: "295 70% 22%" },
    amber:      { primary: "35 92% 50%",  foreground: "0 0% 100%", ring: "35 92% 50%",  accent: "35 80% 93%",  accentFg: "35 92% 22%"  },
    copper:     { primary: "20 75% 46%",  foreground: "0 0% 100%", ring: "20 75% 46%",  accent: "20 60% 92%",  accentFg: "20 75% 20%"  },
    sakura:     { primary: "340 65% 58%", foreground: "0 0% 100%", ring: "340 65% 58%", accent: "340 55% 94%", accentFg: "340 65% 26%" },
    arctic:     { primary: "197 85% 42%", foreground: "0 0% 100%", ring: "197 85% 42%", accent: "197 55% 92%", accentFg: "197 85% 18%" },
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
      root.classList.add(DARK_COLOR_THEMES.includes(t) ? "dark" : "light");
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
    aurora:      "radial-gradient(circle at 15% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 85% 80%, rgba(6,182,212,0.30), transparent 55%), linear-gradient(160deg, #0b1020, #1a1f3a)",
    sunset:      "radial-gradient(circle at 20% 20%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.30), transparent 55%), linear-gradient(160deg, #1a0f1f, #2a1230)",
    ocean:       "radial-gradient(circle at 20% 10%, rgba(34,211,238,0.30), transparent 55%), radial-gradient(circle at 80% 90%, rgba(59,130,246,0.30), transparent 55%), linear-gradient(160deg, #061627, #0a2540)",
    emerald:     "radial-gradient(circle at 15% 25%, rgba(16,185,129,0.30), transparent 55%), radial-gradient(circle at 85% 75%, rgba(20,184,166,0.28), transparent 55%), linear-gradient(160deg, #06201a, #0a2e24)",
    /* ── New gradients ── */
    deepPurple:  "radial-gradient(circle at 20% 20%, rgba(139,92,246,0.45), transparent 55%), radial-gradient(circle at 80% 80%, rgba(109,40,217,0.40), transparent 55%), linear-gradient(160deg, #0f0a1e, #1e1040)",
    violet:      "radial-gradient(circle at 15% 25%, rgba(167,139,250,0.45), transparent 55%), radial-gradient(circle at 85% 75%, rgba(91,33,182,0.38), transparent 55%), linear-gradient(160deg, #100d24, #1e1550)",
    roseDark:    "radial-gradient(circle at 20% 30%, rgba(244,63,94,0.38), transparent 55%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.32), transparent 55%), linear-gradient(160deg, #1a0a12, #2d0f1e)",
    darkSlate:   "radial-gradient(circle at 20% 20%, rgba(51,65,85,0.50), transparent 55%), radial-gradient(circle at 80% 80%, rgba(15,23,42,0.60), transparent 55%), linear-gradient(160deg, #050810, #0f172a)",
    copper:      "radial-gradient(circle at 20% 20%, rgba(194,120,60,0.38), transparent 55%), radial-gradient(circle at 80% 80%, rgba(161,72,20,0.32), transparent 55%), linear-gradient(160deg, #1a0e08, #2d1a0a)",
    sakura:      "radial-gradient(circle at 20% 20%, rgba(244,114,182,0.38), transparent 55%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.30), transparent 55%), linear-gradient(160deg, #1a0a14, #2d1020)",
    arctic:      "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 90%, rgba(14,165,233,0.30), transparent 55%), linear-gradient(160deg, #060f18, #0c1f35)",
    /* ── Light & medium-brightness backgrounds ── */
    /* These are bright (see BRIGHT_GRADIENTS below), so unlike the dark
       gradients above, the default light-theme text colors already read
       fine on top of them — no dark-text CSS override is applied. */
    ivory:            "radial-gradient(circle at 15% 20%, rgba(255,220,180,0.35), transparent 55%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.55), transparent 55%), linear-gradient(160deg, #fdf9f2, #f2ead9)",
    skyLight:         "radial-gradient(circle at 20% 15%, rgba(186,230,253,0.55), transparent 55%), radial-gradient(circle at 80% 85%, rgba(224,242,254,0.6), transparent 55%), linear-gradient(160deg, #f0f9ff, #dbeeff)",
    blossom:          "radial-gradient(circle at 20% 20%, rgba(253,224,241,0.55), transparent 55%), radial-gradient(circle at 80% 80%, rgba(233,213,255,0.5), transparent 55%), linear-gradient(160deg, #fdf2f8, #f3e8ff)",
    coral:            "radial-gradient(circle at 20% 20%, rgba(251,146,113,0.45), transparent 55%), radial-gradient(circle at 80% 80%, rgba(253,186,140,0.4), transparent 55%), linear-gradient(160deg, #ffedd5, #fed7aa)",
    sageMedium:       "radial-gradient(circle at 15% 25%, rgba(134,197,144,0.45), transparent 55%), radial-gradient(circle at 85% 75%, rgba(167,214,164,0.4), transparent 55%), linear-gradient(160deg, #dcfce7, #bbf7d0)",
    periwinkleMedium: "radial-gradient(circle at 20% 20%, rgba(147,163,255,0.45), transparent 55%), radial-gradient(circle at 80% 80%, rgba(186,171,255,0.4), transparent 55%), linear-gradient(160deg, #e0e7ff, #c7d2fe)",
  };

  /* Gradients bright enough that default light-theme text (dark foreground,
     light card/popover surfaces) already reads correctly on top of them —
     unlike the dark gradients above, these must NOT get the dark-background
     text-color override (see body.app-bg-custom / .app-bg-bright in index.css). */
  const BRIGHT_GRADIENTS = new Set([
    "ivory", "skyLight", "blossom", "coral", "sageMedium", "periwinkleMedium",
  ]);

  const FONT_MAP: Record<FontFamily, string> = {
    default: "'Plus Jakarta Sans', sans-serif",
    inter:   "'Inter', 'Plus Jakarta Sans', sans-serif",
    nunito:  "'Nunito', 'Plus Jakarta Sans', sans-serif",
    poppins: "'Poppins', 'Plus Jakarta Sans', sans-serif",
    cairo:   "'Cairo', 'Plus Jakarta Sans', sans-serif",
    tajawal: "'Tajawal', 'Plus Jakarta Sans', sans-serif",
    ibm:     "'IBM Plex Arabic', 'Plus Jakarta Sans', sans-serif",
  };

  const applyFontFamily = (f: FontFamily) => {
    const val = FONT_MAP[f] ?? FONT_MAP.default;
    document.documentElement.style.setProperty("--font-family-override", val);
    document.body.style.fontFamily = val;
  };

  const WEIGHT_MAP: Record<FontWeight, string> = {
    light:    "300",
    normal:   "400",
    semibold: "600",
    bold:     "700",
    heavy:    "800",
  };
  const applyFontWeight = (w: FontWeight) => {
    const val = WEIGHT_MAP[w] ?? "400";
    document.documentElement.style.setProperty("--font-weight-override", val);
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
    body.classList.toggle("app-bg-bright", mode === "gradient" && BRIGHT_GRADIENTS.has(gradient));
  };

  const applyGlass = (v: GlassIntensity) => {
    document.documentElement.setAttribute("data-glass", v);
  };

  const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  /* --card-foreground is contested: a custom card color wants it set for
     contrast against that specific card background, while a custom font
     color wants it set to the user's chosen text color everywhere
     (including on cards). Both applyCardColor and applyFontColor used to
     set this same var independently, so whichever ran last silently threw
     away the other's value on Save (e.g. card text reverting to the
     default theme color, sometimes unreadable against a dark custom
     card). Route --card-foreground through this single function so
     precedence is explicit: font color wins when custom (it is the more
     specific "text color" intent), otherwise fall back to the card's own
     contrast calculation, otherwise clear it and let the theme decide. */
  const applyCardForeground = (
    cardMode: CardColorMode, cardHex: string,
    fontMode: FontColorMode, fontHex: string,
  ) => {
    const body = document.body;
    if (fontMode === "custom" && fontHex) {
      const { h, s, l } = hexToHsl(fontHex);
      body.style.setProperty("--card-foreground", `${h} ${s}% ${l}%`);
    } else if (cardMode === "custom" && cardHex) {
      const { l } = hexToHsl(cardHex);
      body.style.setProperty("--card-foreground", l > 55 ? "222 47% 11%" : "210 30% 96%");
    } else {
      body.style.removeProperty("--card-foreground");
    }
  };

  /* Sets an inline style directly on <body>. Inline styles win over the
     class-based body.app-bg-custom rules in index.css (which set --card
     without !important) regardless of source order, so a user-picked
     custom card color always takes priority over the automatic
     background-aware defaults, without needing to touch that CSS. */
  const applyCardColor = (mode: CardColorMode, hex: string) => {
    const body = document.body;
    if (mode !== "custom" || !hex) {
      body.style.removeProperty("--card");
      body.style.removeProperty("--card-border");
    } else {
      const { h, s, l } = hexToHsl(hex);
      body.style.setProperty("--card", `${h} ${s}% ${l}%`);
      // Border: same hue, pushed further from the background/body extremes
      // so it stays visible whether the chosen card color is light or dark.
      const borderL = l > 50 ? Math.max(0, l - 22) : Math.min(100, l + 24);
      body.style.setProperty("--card-border", `${h} ${Math.max(10, s - 10)}% ${borderL}%`);
    }
    applyCardForeground(mode, hex, fontColorMode, fontColor);
  };

  /* Sets an inline style on <body> for the app-wide text color, same
     override pattern as applyCardColor above (inline styles win over
     the class-based body.app-bg-custom rules in index.css regardless of
     source order, without needing !important). Overrides the main
     --foreground var plus --muted-foreground/--popover-foreground
     (derived) so secondary text and popovers/menus stay legible too. */
  const applyFontColor = (mode: FontColorMode, hex: string) => {
    const body = document.body;
    if (mode !== "custom" || !hex) {
      body.style.removeProperty("--foreground");
      body.style.removeProperty("--muted-foreground");
      body.style.removeProperty("--popover-foreground");
    } else {
      const { h, s, l } = hexToHsl(hex);
      const hsl = `${h} ${s}% ${l}%`;
      body.style.setProperty("--foreground", hsl);
      body.style.setProperty("--popover-foreground", hsl);
      // Muted foreground: same hue, pulled toward mid-gray so secondary text
      // stays visibly softer than primary text but keeps the chosen tint.
      const mutedL = l > 50 ? Math.max(35, l - 20) : Math.min(70, l + 25);
      body.style.setProperty("--muted-foreground", `${h} ${Math.max(5, s - 20)}% ${mutedL}%`);
    }
    applyCardForeground(cardColorMode, cardColor, mode, hex);
  };

  /* ── Setters ───────────────────────────────────────────────────── */
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("settings_lang", lang);
    i18n.changeLanguage(lang);
    applyDirection(lang);
    saveToServer({ language: lang });
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("settings_theme", t);
    applyTheme(t);
    saveToServer({ theme: t });
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem("settings_size", size);
    document.documentElement.classList.remove("text-font-small", "text-font-medium", "text-font-large");
    document.documentElement.classList.add(`text-font-${size}`);
    saveToServer({ fontSize: size });
  };

  const setTtsEnabled       = (v: boolean) => { setTtsEnabledState(v); localStorage.setItem("setting_tts", String(v)); saveToServer({ ttsEnabled: v }); };
  const setWakeWord         = (v: string)  => { setWakeWordState(v); localStorage.setItem("setting_wake_word", v); saveToServer({ wakeWord: v }); };
  const setAssistantName    = (v: string)  => { setAssistantNameState(v); localStorage.setItem("setting_assistant_name", v); saveToServer({ assistantName: v }); };
  const setAssistantPersonality = (v: AssistantPersonality) => { setAssistantPersonalityState(v); localStorage.setItem("setting_assistant_personality", v); saveToServer({ assistantPersonality: v }); };
  const setClockFormat      = (v: ClockFormat)  => { setClockFormatState(v); localStorage.setItem("setting_clock_format", v); saveToServer({ clockFormat: v }); };
  const setClockLocale      = (v: ClockLocale)  => { setClockLocaleState(v); localStorage.setItem("setting_clock_locale", v); saveToServer({ clockLocale: v }); };
  const setClockStyle       = (v: ClockStyle)   => { setClockStyleState(v); localStorage.setItem("setting_clock_style", v); saveToServer({ clockStyle: v }); };
  const setClockSize        = (v: ClockSize)    => { setClockSizeState(v); localStorage.setItem("setting_clock_size", v); saveToServer({ clockSize: v }); };
  const setFloatingClockEnabled = (v: boolean)  => { setFloatingClockEnabledState(v); localStorage.setItem("setting_floating_clock", String(v)); saveToServer({ floatingClockEnabled: v }); };
  const setFloatingClockCheckIn = (v: boolean)  => { setFloatingClockCheckInState(v); localStorage.setItem("setting_floating_checkin", String(v)); saveToServer({ floatingClockCheckIn: v }); };
  const setAiButtonIcon     = (v: AiButtonIcon) => { setAiButtonIconState(v); localStorage.setItem("setting_ai_icon", v); saveToServer({ aiButtonIcon: v }); };
  const setAiButtonShape    = (v: AiButtonShape)=> { setAiButtonShapeState(v); localStorage.setItem("setting_ai_shape", v); saveToServer({ aiButtonShape: v }); };
  const setAiButtonColor    = (v: AiButtonColor)=> { setAiButtonColorState(v); localStorage.setItem("setting_ai_color", v); saveToServer({ aiButtonColor: v }); };
  const setAiEnabled        = (v: boolean)      => { setAiEnabledState(v); localStorage.setItem("setting_ai_enabled", String(v)); saveToServer({ aiEnabled: v }); };
  const setAiAvatarStyle    = (v: AvatarStyle)  => { setAiAvatarStyleState(v); localStorage.setItem("setting_ai_avatar", v); saveToServer({ aiAvatarStyle: v }); };
  const setAiButtonSize     = (v: AiButtonSize) => { setAiButtonSizeState(v); localStorage.setItem("setting_ai_size", v); saveToServer({ aiButtonSize: v }); };
  const setAiButtonCustomColor = (v: string)    => { setAiButtonCustomColorState(v); localStorage.setItem("setting_ai_custom_color", v); saveToServer({ aiButtonCustomColor: v }); };

  const setSidebarStyle = (v: SidebarStyle) => {
    setSidebarStyleState(v); localStorage.setItem("setting_sidebar_style", v);
    applyUiStyles(v, tableStyle, cardStyle);
    saveToServer({ sidebarStyle: v });
  };
  const setTableStyle = (v: TableStyle) => {
    setTableStyleState(v); localStorage.setItem("setting_table_style", v);
    applyUiStyles(sidebarStyle, v, cardStyle);
    saveToServer({ tableStyle: v });
  };
  const setCardStyle = (v: CardStyle) => {
    setCardStyleState(v); localStorage.setItem("setting_card_style", v);
    applyUiStyles(sidebarStyle, tableStyle, v);
    saveToServer({ cardStyle: v });
  };
  const setCardColorMode = (v: CardColorMode) => {
    setCardColorModeState(v); localStorage.setItem("setting_card_color_mode", v);
    applyCardColor(v, cardColor);
    saveToServer({ cardColorMode: v });
  };
  const setCardColor = (v: string) => {
    setCardColorState(v); localStorage.setItem("setting_card_color", v);
    applyCardColor(cardColorMode, v);
    saveToServer({ cardColor: v });
  };
  const setFontColorMode = (v: FontColorMode) => {
    setFontColorModeState(v); localStorage.setItem("setting_font_color_mode", v);
    applyFontColor(v, fontColor);
    saveToServer({ fontColorMode: v });
  };
  const setFontColor = (v: string) => {
    setFontColorState(v); localStorage.setItem("setting_font_color", v);
    applyFontColor(fontColorMode, v);
    saveToServer({ fontColor: v });
  };
  const setGlassIntensity = (v: GlassIntensity) => {
    setGlassIntensityState(v); localStorage.setItem("setting_glass_intensity", v); applyGlass(v);
    saveToServer({ glassIntensity: v });
  };
  const setBackgroundMode = (v: BackgroundMode) => {
    setBackgroundModeState(v); localStorage.setItem("setting_bg_mode", v);
    applyBackground(v, backgroundImage, backgroundGradient);
    saveToServer({ backgroundMode: v });
  };
  const setBackgroundImage = (v: string) => {
    setBackgroundImageState(v); localStorage.setItem("setting_bg_image", v);
    applyBackground(backgroundMode, v, backgroundGradient);
    saveToServer({ backgroundImage: v });
  };
  const setBackgroundGradient = (v: string) => {
    setBackgroundGradientState(v); localStorage.setItem("setting_bg_gradient", v);
    applyBackground(backgroundMode, backgroundImage, v);
    saveToServer({ backgroundGradient: v });
  };

  const resetAppearance = () => {
    setGlassIntensityState("off"); localStorage.setItem("setting_glass_intensity", "off"); applyGlass("off");
    setBackgroundModeState("default"); localStorage.setItem("setting_bg_mode", "default");
    setBackgroundImageState(""); localStorage.setItem("setting_bg_image", "");
    setBackgroundGradientState("aurora"); localStorage.setItem("setting_bg_gradient", "aurora");
    applyBackground("default", "", "aurora");
    setCardStyle("rounded");
    setCardColorModeState("auto"); localStorage.setItem("setting_card_color_mode", "auto");
    applyCardColor("auto", cardColor);
    setFontColorModeState("auto"); localStorage.setItem("setting_font_color_mode", "auto");
    applyFontColor("auto", fontColor);
    saveToServer({ glassIntensity: "off", backgroundMode: "default", backgroundImage: "", backgroundGradient: "aurora", cardColorMode: "auto", fontColorMode: "auto", cardStyle: "rounded" });
  };

  const applyAccentHex = (hex: string) => {
    const root = document.documentElement;
    if (!hex) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      return;
    }
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

  const setFontFamily = (v: FontFamily) => {
    setFontFamilyState(v); localStorage.setItem("setting_font_family", v); applyFontFamily(v); saveToServer({ fontFamily: v });
  };
  const setFontWeight = (v: FontWeight) => {
    setFontWeightState(v); localStorage.setItem("setting_font_weight", v); applyFontWeight(v); saveToServer({ fontWeight: v });
  };
  const setAccentColor = (v: string) => {
    setAccentColorState(v); localStorage.setItem("setting_accent_color", v); applyAccentHex(v); saveToServer({ accentColor: v });
  };

  /* ── New effects setters ─────────────────────────────────────── */
  const setAuroraBgEnabled       = (v: boolean) => { setAuroraBgEnabledState(v); localStorage.setItem("setting_aurora_bg", String(v)); saveToServer({ auroraBgEnabled: v }); };
  const setParticlesEnabled      = (v: boolean) => { setParticlesEnabledState(v); localStorage.setItem("setting_particles", String(v)); saveToServer({ particlesEnabled: v }); };
  const setMouseLightEnabled     = (v: boolean) => { setMouseLightEnabledState(v); localStorage.setItem("setting_mouse_light", String(v)); saveToServer({ mouseLightEnabled: v }); };
  const setAuroraPalette         = (v: AuroraPalette) => { setAuroraPaletteState(v); localStorage.setItem("setting_aurora_palette", v); saveToServer({ auroraPalette: v }); };
  const setWelcomeBannerEnabled  = (v: boolean) => { setWelcomeBannerEnabledState(v); localStorage.setItem("setting_welcome_banner", String(v)); saveToServer({ welcomeBannerEnabled: v }); };
  const setWelcomeMessage        = (v: string)  => { setWelcomeMessageState(v); localStorage.setItem("setting_welcome_message", v); saveToServer({ welcomeMessage: v }); };
  const setWelcomeShape          = (v: WelcomeShape) => { setWelcomeShapeState(v); localStorage.setItem("setting_welcome_shape", v); saveToServer({ welcomeShape: v }); };
  const setWelcomeImage          = (v: string)  => { setWelcomeImageState(v); localStorage.setItem("setting_welcome_image", v); saveToServer({ welcomeImage: v }); };
  const setWelcomeTitle          = (v: string)  => { setWelcomeTitleState(v); localStorage.setItem("setting_welcome_title", v); saveToServer({ welcomeTitle: v }); };
  const setWelcomeStyle          = (v: WelcomeStyle) => { setWelcomeStyleState(v); localStorage.setItem("setting_welcome_style", v); saveToServer({ welcomeStyle: v }); };
  const setAiVoiceResponse       = (v: boolean) => { setAiVoiceResponseState(v); localStorage.setItem("setting_ai_voice_response", String(v)); saveToServer({ aiVoiceResponse: v }); };
  const setSoundEnabled          = (v: boolean) => { setSoundEnabledState(v); localStorage.setItem("setting_sound_enabled", String(v)); saveToServer({ soundEnabled: v }); };
  const setSoundVolume           = (v: number)  => { setSoundVolumeState(v); localStorage.setItem("setting_sound_volume", String(v)); saveToServer({ soundVolume: v }); };
  const setLatenessAlertEnabled  = (v: boolean) => { setLatenessAlertEnabledState(v); localStorage.setItem("setting_lateness_alert", String(v)); saveToServer({ latenessAlertEnabled: v }); };
  const setLatenessAlertDays     = (v: number)  => { setLatenessAlertDaysState(v); localStorage.setItem("setting_lateness_days", String(v)); saveToServer({ latenessAlertDays: v }); };
  const setDashboardCardOrder    = (v: string)  => { setDashboardCardOrderState(v); localStorage.setItem("setting_dashboard_order", v); saveToServer({ dashboardCardOrder: v }); };
  const setDashboardCardsHidden  = (v: string)  => { setDashboardCardsHiddenState(v); localStorage.setItem("setting_dashboard_hidden", v); saveToServer({ dashboardCardsHidden: v }); };
  const setCurrency              = (v: Currency) => { setCurrencyState(v); localStorage.setItem("setting_currency", v); saveToServer({ currency: v }); };
  const setSplashBgGradient      = (v: SplashBgGradient) => { setSplashBgGradientState(v); localStorage.setItem("setting_splash_bg", v); saveToServer({ splashBgGradient: v }); };
  const setSplashTagline         = (v: string)  => { setSplashTaglineState(v); localStorage.setItem("setting_splash_tagline", v); saveToServer({ splashTagline: v }); };
  const setSplashDuration        = (v: number)  => { setSplashDurationState(Math.max(3, Math.min(15, v))); localStorage.setItem("setting_splash_duration", String(v)); saveToServer({ splashDuration: v }); };
  const setSplashShowStars       = (v: boolean) => { setSplashShowStarsState(v); localStorage.setItem("setting_splash_stars", String(v)); saveToServer({ splashShowStars: v }); };
  const setSplashShowParticles   = (v: boolean) => { setSplashShowParticlesState(v); localStorage.setItem("setting_splash_particles", String(v)); saveToServer({ splashShowParticles: v }); };
  const setSplashLogoUrl         = (v: string)  => { setSplashLogoUrlState(v); localStorage.setItem("setting_splash_logo", v); saveToServer({ splashLogoUrl: v }); };
  const setSplashLogoWidth       = (v: number)  => { setSplashLogoWidthState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_w", String(v)); saveToServer({ splashLogoWidth: v }); };
  const setSplashLogoHeight      = (v: number)  => { setSplashLogoHeightState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_h", String(v)); saveToServer({ splashLogoHeight: v }); };
  const setSplashLogoRadius      = (v: number)  => { setSplashLogoRadiusState(Math.max(0, Math.min(150, v))); localStorage.setItem("setting_splash_logo_r", String(v)); saveToServer({ splashLogoRadius: v }); };
  const setSplashLogoOffsetX     = (v: number)  => { setSplashLogoOffsetXState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_ox", String(v)); saveToServer({ splashLogoOffsetX: v }); };
  const setSplashLogoOffsetY     = (v: number)  => { setSplashLogoOffsetYState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_oy", String(v)); saveToServer({ splashLogoOffsetY: v }); };
  const setSplashLogoBgSize      = (v: number)  => { setSplashLogoBgSizeState(Math.max(0, Math.min(60, v))); localStorage.setItem("setting_splash_logo_bg", String(v)); saveToServer({ splashLogoBgSize: v }); };
  const setSplashAppName         = (v: string)  => { setSplashAppNameState(v); localStorage.setItem("setting_splash_app_name", v); saveToServer({ splashAppName: v }); };
  const setSplashStyle           = (v: SplashStyle) => { setSplashStyleState(v); localStorage.setItem("setting_splash_style", v); saveToServer({ splashStyle: v }); };

  /* ── Server sync helpers ───────────────────────────────────────── */

  /** Fire-and-forget: persist a partial UI settings patch to the server so
   *  any other device/browser gets the same config when it next loads.    */
  function saveToServer(patch: Record<string, unknown>) {
    fetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ uiSettings: patch }),
    }).catch(() => { /* ignore network errors — localStorage is always fresh */ });
  }

  /** Apply a uiSettings blob that arrived from the server.
   *  Uses internal *State setters so we never trigger another server save. */
  function applyServerUiSettings(s: Record<string, unknown>) {
    if (s.language)             { const v = s.language as Language;             setLanguageState(v);              localStorage.setItem("settings_lang", v);                    i18n.changeLanguage(v); applyDirection(v); }
    if (s.theme)                { const v = s.theme as Theme;                   setThemeState(v);                 localStorage.setItem("settings_theme", v);                   applyTheme(v); }
    if (s.fontSize)             { const v = s.fontSize as FontSize;             setFontSizeState(v);              localStorage.setItem("settings_size", v);                    document.documentElement.classList.remove("text-font-small","text-font-medium","text-font-large"); document.documentElement.classList.add(`text-font-${v}`); }
    if (s.fontFamily)           { const v = s.fontFamily as FontFamily;         setFontFamilyState(v);            localStorage.setItem("setting_font_family", v);              applyFontFamily(v); }
    if (s.fontWeight)           { const v = s.fontWeight as FontWeight;         setFontWeightState(v);            localStorage.setItem("setting_font_weight", v);              applyFontWeight(v); }
    if (s.ttsEnabled !== undefined)       { const v = Boolean(s.ttsEnabled);    setTtsEnabledState(v);            localStorage.setItem("setting_tts", String(v)); }
    if (s.wakeWord !== undefined)         { const v = String(s.wakeWord);       setWakeWordState(v);              localStorage.setItem("setting_wake_word", v); }
    if (s.assistantName !== undefined)    { const v = String(s.assistantName);  setAssistantNameState(v);         localStorage.setItem("setting_assistant_name", v); }
    if (s.assistantPersonality)           { const v = s.assistantPersonality as AssistantPersonality; setAssistantPersonalityState(v); localStorage.setItem("setting_assistant_personality", v); }
    if (s.clockFormat)          { const v = s.clockFormat as ClockFormat;       setClockFormatState(v);           localStorage.setItem("setting_clock_format", v); }
    if (s.clockLocale)          { const v = s.clockLocale as ClockLocale;       setClockLocaleState(v);           localStorage.setItem("setting_clock_locale", v); }
    if (s.clockStyle)           { const v = s.clockStyle as ClockStyle;         setClockStyleState(v);            localStorage.setItem("setting_clock_style", v); }
    if (s.clockSize)            { const v = s.clockSize as ClockSize;           setClockSizeState(v);             localStorage.setItem("setting_clock_size", v); }
    if (s.floatingClockEnabled !== undefined) { const v = Boolean(s.floatingClockEnabled); setFloatingClockEnabledState(v); localStorage.setItem("setting_floating_clock", String(v)); }
    if (s.floatingClockCheckIn !== undefined) { const v = Boolean(s.floatingClockCheckIn); setFloatingClockCheckInState(v); localStorage.setItem("setting_floating_checkin", String(v)); }
    if (s.aiButtonIcon)         { const v = s.aiButtonIcon as AiButtonIcon;     setAiButtonIconState(v);          localStorage.setItem("setting_ai_icon", v); }
    if (s.aiButtonShape)        { const v = s.aiButtonShape as AiButtonShape;   setAiButtonShapeState(v);         localStorage.setItem("setting_ai_shape", v); }
    if (s.aiButtonColor)        { const v = s.aiButtonColor as AiButtonColor;   setAiButtonColorState(v);         localStorage.setItem("setting_ai_color", v); }
    if (s.aiButtonCustomColor !== undefined) { const v = String(s.aiButtonCustomColor); setAiButtonCustomColorState(v); localStorage.setItem("setting_ai_custom_color", v); }
    if (s.aiEnabled !== undefined)           { const v = Boolean(s.aiEnabled);  setAiEnabledState(v);             localStorage.setItem("setting_ai_enabled", String(v)); }
    if (s.aiAvatarStyle)        { const v = s.aiAvatarStyle as AvatarStyle;     setAiAvatarStyleState(v);         localStorage.setItem("setting_ai_avatar", v); }
    if (s.aiButtonSize)         { const v = s.aiButtonSize as AiButtonSize;     setAiButtonSizeState(v);          localStorage.setItem("setting_ai_size", v); }
    if (s.sidebarStyle)         { const v = s.sidebarStyle as SidebarStyle;     setSidebarStyleState(v);          localStorage.setItem("setting_sidebar_style", v); }
    if (s.tableStyle)           { const v = s.tableStyle as TableStyle;         setTableStyleState(v);            localStorage.setItem("setting_table_style", v); }
    if (s.cardStyle)            { const v = s.cardStyle as CardStyle;           setCardStyleState(v);             localStorage.setItem("setting_card_style", v); }
    if (s.cardColorMode)        { const v = s.cardColorMode as CardColorMode;   setCardColorModeState(v);         localStorage.setItem("setting_card_color_mode", v); }
    if (s.cardColor !== undefined)          { const v = String(s.cardColor);    setCardColorState(v);             localStorage.setItem("setting_card_color", v); }
    if (s.fontColorMode)        { const v = s.fontColorMode as FontColorMode;   setFontColorModeState(v);         localStorage.setItem("setting_font_color_mode", v); }
    if (s.fontColor !== undefined)          { const v = String(s.fontColor);    setFontColorState(v);             localStorage.setItem("setting_font_color", v); }
    if (s.accentColor !== undefined)        { const v = String(s.accentColor);  setAccentColorState(v);           localStorage.setItem("setting_accent_color", v); if (v) applyAccentHex(v); }
    if (s.glassIntensity)       { const v = s.glassIntensity as GlassIntensity; setGlassIntensityState(v);        localStorage.setItem("setting_glass_intensity", v);          applyGlass(v); }
    if (s.backgroundMode)       { const v = s.backgroundMode as BackgroundMode; setBackgroundModeState(v);        localStorage.setItem("setting_bg_mode", v); }
    if (s.backgroundImage !== undefined)    { const v = String(s.backgroundImage); setBackgroundImageState(v);    localStorage.setItem("setting_bg_image", v); }
    if (s.backgroundGradient !== undefined) { const v = String(s.backgroundGradient); setBackgroundGradientState(v); localStorage.setItem("setting_bg_gradient", v); }
    if (s.auroraBgEnabled !== undefined)    { const v = Boolean(s.auroraBgEnabled); setAuroraBgEnabledState(v);   localStorage.setItem("setting_aurora_bg", String(v)); }
    if (s.particlesEnabled !== undefined)   { const v = Boolean(s.particlesEnabled); setParticlesEnabledState(v); localStorage.setItem("setting_particles", String(v)); }
    if (s.mouseLightEnabled !== undefined)  { const v = Boolean(s.mouseLightEnabled); setMouseLightEnabledState(v); localStorage.setItem("setting_mouse_light", String(v)); }
    if (s.auroraPalette)        { const v = s.auroraPalette as AuroraPalette;   setAuroraPaletteState(v);         localStorage.setItem("setting_aurora_palette", v); }
    if (s.welcomeBannerEnabled !== undefined) { const v = Boolean(s.welcomeBannerEnabled); setWelcomeBannerEnabledState(v); localStorage.setItem("setting_welcome_banner", String(v)); }
    if (s.welcomeMessage !== undefined)     { const v = String(s.welcomeMessage); setWelcomeMessageState(v);       localStorage.setItem("setting_welcome_message", v); }
    if (s.welcomeShape)         { const v = s.welcomeShape as WelcomeShape;     setWelcomeShapeState(v);          localStorage.setItem("setting_welcome_shape", v); }
    if (s.welcomeImage !== undefined)       { const v = String(s.welcomeImage); setWelcomeImageState(v);          localStorage.setItem("setting_welcome_image", v); }
    if (s.welcomeTitle !== undefined)       { const v = String(s.welcomeTitle); setWelcomeTitleState(v);          localStorage.setItem("setting_welcome_title", v); }
    if (s.welcomeStyle)         { const v = s.welcomeStyle as WelcomeStyle;     setWelcomeStyleState(v);          localStorage.setItem("setting_welcome_style", v); }
    if (s.aiVoiceResponse !== undefined)    { const v = Boolean(s.aiVoiceResponse); setAiVoiceResponseState(v);   localStorage.setItem("setting_ai_voice_response", String(v)); }
    if (s.soundEnabled !== undefined)       { const v = Boolean(s.soundEnabled); setSoundEnabledState(v);         localStorage.setItem("setting_sound_enabled", String(v)); }
    if (s.soundVolume !== undefined)        { const v = Number(s.soundVolume);   setSoundVolumeState(v);          localStorage.setItem("setting_sound_volume", String(v)); }
    if (s.latenessAlertEnabled !== undefined) { const v = Boolean(s.latenessAlertEnabled); setLatenessAlertEnabledState(v); localStorage.setItem("setting_lateness_alert", String(v)); }
    if (s.latenessAlertDays !== undefined)  { const v = Number(s.latenessAlertDays); setLatenessAlertDaysState(v); localStorage.setItem("setting_lateness_days", String(v)); }
    if (s.dashboardCardOrder !== undefined) { const v = String(s.dashboardCardOrder); setDashboardCardOrderState(v); localStorage.setItem("setting_dashboard_order", v); }
    if (s.dashboardCardsHidden !== undefined) { const v = String(s.dashboardCardsHidden); setDashboardCardsHiddenState(v); localStorage.setItem("setting_dashboard_hidden", v); }
    if (s.currency)             { const v = s.currency as Currency;             setCurrencyState(v);              localStorage.setItem("setting_currency", v); }
    if (s.splashStyle)          { const v = s.splashStyle as SplashStyle;       setSplashStyleState(v);           localStorage.setItem("setting_splash_style", v); }
    if (s.splashBgGradient)     { const v = s.splashBgGradient as SplashBgGradient; setSplashBgGradientState(v); localStorage.setItem("setting_splash_bg", v); }
    if (s.splashTagline !== undefined)      { const v = String(s.splashTagline); setSplashTaglineState(v);         localStorage.setItem("setting_splash_tagline", v); }
    if (s.splashDuration !== undefined)     { const v = Number(s.splashDuration); setSplashDurationState(Math.max(3, Math.min(15, v))); localStorage.setItem("setting_splash_duration", String(v)); }
    if (s.splashShowStars !== undefined)    { const v = Boolean(s.splashShowStars); setSplashShowStarsState(v);   localStorage.setItem("setting_splash_stars", String(v)); }
    if (s.splashShowParticles !== undefined){ const v = Boolean(s.splashShowParticles); setSplashShowParticlesState(v); localStorage.setItem("setting_splash_particles", String(v)); }
    if (s.splashLogoUrl !== undefined)      { const v = String(s.splashLogoUrl); setSplashLogoUrlState(v);        localStorage.setItem("setting_splash_logo", v); }
    if (s.splashLogoWidth !== undefined)    { const v = Number(s.splashLogoWidth); setSplashLogoWidthState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_w", String(v)); }
    if (s.splashLogoHeight !== undefined)   { const v = Number(s.splashLogoHeight); setSplashLogoHeightState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_h", String(v)); }
    if (s.splashLogoRadius !== undefined)   { const v = Number(s.splashLogoRadius); setSplashLogoRadiusState(Math.max(0, Math.min(150, v))); localStorage.setItem("setting_splash_logo_r", String(v)); }
    if (s.splashLogoOffsetX !== undefined)  { const v = Number(s.splashLogoOffsetX); setSplashLogoOffsetXState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_ox", String(v)); }
    if (s.splashLogoOffsetY !== undefined)  { const v = Number(s.splashLogoOffsetY); setSplashLogoOffsetYState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_oy", String(v)); }
    if (s.splashLogoBgSize !== undefined)   { const v = Number(s.splashLogoBgSize); setSplashLogoBgSizeState(Math.max(0, Math.min(60, v))); localStorage.setItem("setting_splash_logo_bg", String(v)); }
    if (s.splashAppName !== undefined)      { const v = String(s.splashAppName); setSplashAppNameState(v);         localStorage.setItem("setting_splash_app_name", v); }

    // Re-apply composite visual effects after all values are updated
    const bgMode = (s.backgroundMode as BackgroundMode) ?? undefined;
    const bgImg  = s.backgroundImage  !== undefined ? String(s.backgroundImage)  : undefined;
    const bgGrad = s.backgroundGradient !== undefined ? String(s.backgroundGradient) : undefined;
    if (bgMode || bgImg !== undefined || bgGrad !== undefined) {
      applyBackground(
        bgMode  ?? (localStorage.getItem("setting_bg_mode") as BackgroundMode)    ?? "default",
        bgImg   ?? localStorage.getItem("setting_bg_image")                        ?? "",
        bgGrad  ?? localStorage.getItem("setting_bg_gradient")                     ?? "aurora",
      );
    }
    const cm = (s.cardColorMode as CardColorMode) ?? undefined;
    const cc = s.cardColor !== undefined ? String(s.cardColor) : undefined;
    const fm = (s.fontColorMode as FontColorMode) ?? undefined;
    const fc = s.fontColor !== undefined ? String(s.fontColor) : undefined;
    if (cm || cc !== undefined || fm || fc !== undefined) {
      applyCardColor(
        cm ?? (localStorage.getItem("setting_card_color_mode") as CardColorMode) ?? "auto",
        cc ?? localStorage.getItem("setting_card_color") ?? "#1e293b",
      );
      applyFontColor(
        fm ?? (localStorage.getItem("setting_font_color_mode") as FontColorMode) ?? "auto",
        fc ?? localStorage.getItem("setting_font_color") ?? "#1e293b",
      );
    }
    const ss = (s.sidebarStyle as SidebarStyle) ?? undefined;
    const ts = (s.tableStyle as TableStyle)     ?? undefined;
    const cs = (s.cardStyle as CardStyle)       ?? undefined;
    if (ss || ts || cs) {
      applyUiStyles(
        ss ?? (localStorage.getItem("setting_sidebar_style") as SidebarStyle) ?? "default",
        ts ?? (localStorage.getItem("setting_table_style")   as TableStyle)   ?? "comfortable",
        cs ?? (localStorage.getItem("setting_card_style")    as CardStyle)    ?? "rounded",
      );
    }
  }

  /* ── Bootstrap on first mount ──────────────────────────────────── */
  useEffect(() => {
    // 1. Apply localStorage values immediately (fast, synchronous)
    applyTheme(theme);
    applyDirection(language);
    i18n.changeLanguage(language);
    document.documentElement.classList.remove("text-font-small", "text-font-medium", "text-font-large");
    document.documentElement.classList.add(`text-font-${fontSize}`);
    applyUiStyles(sidebarStyle, tableStyle, cardStyle);
    if (accentColor) applyAccentHex(accentColor);
    applyGlass(glassIntensity);
    applyBackground(backgroundMode, backgroundImage, backgroundGradient);
    applyFontFamily(fontFamily);
    applyFontWeight(fontWeight);
    applyCardColor(cardColorMode, cardColor);
    applyFontColor(fontColorMode, fontColor);

    // 2. Fetch server settings and override — ensures fresh devices/browsers
    //    always get the admin's latest config, not just the localStorage defaults.
    fetch("/api/settings/app", { cache: "no-cache" })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.uiSettings && typeof data.uiSettings === "object") {
          applyServerUiSettings(data.uiSettings);
        }
      })
      .catch(() => { /* network error — localhost values remain in effect */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsContext.Provider value={{
      language, theme, fontSize, fontFamily, fontWeight, ttsEnabled, wakeWord, assistantName, assistantPersonality,
      aiButtonIcon, aiButtonShape, aiButtonColor, aiButtonCustomColor, aiEnabled, aiAvatarStyle, aiButtonSize,
      clockFormat, clockLocale, clockStyle, clockSize, floatingClockEnabled, floatingClockCheckIn,
      sidebarStyle, tableStyle, cardStyle, cardColorMode, cardColor, fontColorMode, fontColor, accentColor,
      glassIntensity, backgroundMode, backgroundImage, backgroundGradient,
      auroraBgEnabled, particlesEnabled, mouseLightEnabled, auroraPalette,
      welcomeBannerEnabled, welcomeMessage, welcomeShape, welcomeImage, welcomeTitle, welcomeStyle,
      aiVoiceResponse, soundEnabled, soundVolume,
      latenessAlertEnabled, latenessAlertDays,
      dashboardCardOrder, dashboardCardsHidden,
      splashBgGradient, splashTagline, splashDuration, splashShowStars, splashShowParticles,
      splashLogoUrl, splashLogoWidth, splashLogoHeight, splashLogoRadius, splashLogoOffsetX, splashLogoOffsetY, splashLogoBgSize,
      splashAppName, splashStyle,
      setLanguage, setTheme, setFontSize, setFontFamily, setFontWeight, setTtsEnabled, setWakeWord, setAssistantName, setAssistantPersonality,
      setAiButtonIcon, setAiButtonShape, setAiButtonColor, setAiButtonCustomColor,
      setAiEnabled, setAiAvatarStyle, setAiButtonSize,
      setClockFormat, setClockLocale, setClockStyle, setClockSize, setFloatingClockEnabled, setFloatingClockCheckIn,
      setSidebarStyle, setTableStyle, setCardStyle, setCardColorMode, setCardColor, setFontColorMode, setFontColor, setAccentColor,
      setGlassIntensity, setBackgroundMode, setBackgroundImage, setBackgroundGradient, resetAppearance,
      setAuroraBgEnabled, setParticlesEnabled, setMouseLightEnabled, setAuroraPalette,
      setWelcomeBannerEnabled, setWelcomeMessage, setWelcomeShape, setWelcomeImage, setWelcomeTitle, setWelcomeStyle,
      setAiVoiceResponse, setSoundEnabled, setSoundVolume,
      setLatenessAlertEnabled, setLatenessAlertDays,
      setDashboardCardOrder, setDashboardCardsHidden,
      currency, setCurrency,
      setSplashBgGradient, setSplashTagline, setSplashDuration, setSplashShowStars, setSplashShowParticles,
      setSplashLogoUrl, setSplashLogoWidth, setSplashLogoHeight, setSplashLogoRadius, setSplashLogoOffsetX, setSplashLogoOffsetY, setSplashLogoBgSize,
      setSplashAppName, setSplashStyle,
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
