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

  const setTtsEnabled       = (v: boolean) => { setTtsEnabledState(v); localStorage.setItem("setting_tts", String(v)); };
  const setWakeWord         = (v: string)  => { setWakeWordState(v); localStorage.setItem("setting_wake_word", v); };
  const setAssistantName    = (v: string)  => { setAssistantNameState(v); localStorage.setItem("setting_assistant_name", v); };
  const setAssistantPersonality = (v: AssistantPersonality) => { setAssistantPersonalityState(v); localStorage.setItem("setting_assistant_personality", v); };
  const setClockFormat      = (v: ClockFormat)  => { setClockFormatState(v); localStorage.setItem("setting_clock_format", v); };
  const setClockLocale      = (v: ClockLocale)  => { setClockLocaleState(v); localStorage.setItem("setting_clock_locale", v); };
  const setClockStyle       = (v: ClockStyle)   => { setClockStyleState(v); localStorage.setItem("setting_clock_style", v); };
  const setClockSize        = (v: ClockSize)    => { setClockSizeState(v); localStorage.setItem("setting_clock_size", v); };
  const setFloatingClockEnabled = (v: boolean)  => { setFloatingClockEnabledState(v); localStorage.setItem("setting_floating_clock", String(v)); };
  const setFloatingClockCheckIn = (v: boolean)  => { setFloatingClockCheckInState(v); localStorage.setItem("setting_floating_checkin", String(v)); };
  const setAiButtonIcon     = (v: AiButtonIcon) => { setAiButtonIconState(v); localStorage.setItem("setting_ai_icon", v); };
  const setAiButtonShape    = (v: AiButtonShape)=> { setAiButtonShapeState(v); localStorage.setItem("setting_ai_shape", v); };
  const setAiButtonColor    = (v: AiButtonColor)=> { setAiButtonColorState(v); localStorage.setItem("setting_ai_color", v); };
  const setAiEnabled        = (v: boolean)      => { setAiEnabledState(v); localStorage.setItem("setting_ai_enabled", String(v)); };
  const setAiAvatarStyle    = (v: AvatarStyle)  => { setAiAvatarStyleState(v); localStorage.setItem("setting_ai_avatar", v); };
  const setAiButtonSize     = (v: AiButtonSize) => { setAiButtonSizeState(v); localStorage.setItem("setting_ai_size", v); };
  const setAiButtonCustomColor = (v: string)    => { setAiButtonCustomColorState(v); localStorage.setItem("setting_ai_custom_color", v); };

  const setSidebarStyle = (v: SidebarStyle) => {
    setSidebarStyleState(v); localStorage.setItem("setting_sidebar_style", v);
    applyUiStyles(v, tableStyle, cardStyle);
  };
  const setTableStyle = (v: TableStyle) => {
    setTableStyleState(v); localStorage.setItem("setting_table_style", v);
    applyUiStyles(sidebarStyle, v, cardStyle);
  };
  const setCardStyle = (v: CardStyle) => {
    setCardStyleState(v); localStorage.setItem("setting_card_style", v);
    applyUiStyles(sidebarStyle, tableStyle, v);
  };
  const setCardColorMode = (v: CardColorMode) => {
    setCardColorModeState(v); localStorage.setItem("setting_card_color_mode", v);
    applyCardColor(v, cardColor);
  };
  const setCardColor = (v: string) => {
    setCardColorState(v); localStorage.setItem("setting_card_color", v);
    applyCardColor(cardColorMode, v);
  };
  const setFontColorMode = (v: FontColorMode) => {
    setFontColorModeState(v); localStorage.setItem("setting_font_color_mode", v);
    applyFontColor(v, fontColor);
  };
  const setFontColor = (v: string) => {
    setFontColorState(v); localStorage.setItem("setting_font_color", v);
    applyFontColor(fontColorMode, v);
  };
  const setGlassIntensity = (v: GlassIntensity) => {
    setGlassIntensityState(v); localStorage.setItem("setting_glass_intensity", v); applyGlass(v);
  };
  const setBackgroundMode = (v: BackgroundMode) => {
    setBackgroundModeState(v); localStorage.setItem("setting_bg_mode", v);
    applyBackground(v, backgroundImage, backgroundGradient);
  };
  const setBackgroundImage = (v: string) => {
    setBackgroundImageState(v); localStorage.setItem("setting_bg_image", v);
    applyBackground(backgroundMode, v, backgroundGradient);
  };
  const setBackgroundGradient = (v: string) => {
    setBackgroundGradientState(v); localStorage.setItem("setting_bg_gradient", v);
    applyBackground(backgroundMode, backgroundImage, v);
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
    setFontFamilyState(v); localStorage.setItem("setting_font_family", v); applyFontFamily(v);
  };
  const setFontWeight = (v: FontWeight) => {
    setFontWeightState(v); localStorage.setItem("setting_font_weight", v); applyFontWeight(v);
  };
  const setAccentColor = (v: string) => {
    setAccentColorState(v); localStorage.setItem("setting_accent_color", v); applyAccentHex(v);
  };

  /* ── New effects setters ─────────────────────────────────────── */
  const setAuroraBgEnabled       = (v: boolean) => { setAuroraBgEnabledState(v); localStorage.setItem("setting_aurora_bg", String(v)); };
  const setParticlesEnabled      = (v: boolean) => { setParticlesEnabledState(v); localStorage.setItem("setting_particles", String(v)); };
  const setMouseLightEnabled     = (v: boolean) => { setMouseLightEnabledState(v); localStorage.setItem("setting_mouse_light", String(v)); };
  const setAuroraPalette         = (v: AuroraPalette) => { setAuroraPaletteState(v); localStorage.setItem("setting_aurora_palette", v); };
  const setWelcomeBannerEnabled  = (v: boolean) => { setWelcomeBannerEnabledState(v); localStorage.setItem("setting_welcome_banner", String(v)); };
  const setWelcomeMessage        = (v: string)  => { setWelcomeMessageState(v); localStorage.setItem("setting_welcome_message", v); };
  const setWelcomeShape          = (v: WelcomeShape) => { setWelcomeShapeState(v); localStorage.setItem("setting_welcome_shape", v); };
  const setWelcomeImage          = (v: string)  => { setWelcomeImageState(v); localStorage.setItem("setting_welcome_image", v); };
  const setWelcomeTitle          = (v: string)  => { setWelcomeTitleState(v); localStorage.setItem("setting_welcome_title", v); };
  const setWelcomeStyle          = (v: WelcomeStyle) => { setWelcomeStyleState(v); localStorage.setItem("setting_welcome_style", v); };
  const setAiVoiceResponse       = (v: boolean) => { setAiVoiceResponseState(v); localStorage.setItem("setting_ai_voice_response", String(v)); };
  const setSoundEnabled          = (v: boolean) => { setSoundEnabledState(v); localStorage.setItem("setting_sound_enabled", String(v)); };
  const setSoundVolume           = (v: number)  => { setSoundVolumeState(v); localStorage.setItem("setting_sound_volume", String(v)); };
  const setLatenessAlertEnabled  = (v: boolean) => { setLatenessAlertEnabledState(v); localStorage.setItem("setting_lateness_alert", String(v)); };
  const setLatenessAlertDays     = (v: number)  => { setLatenessAlertDaysState(v); localStorage.setItem("setting_lateness_days", String(v)); };
  const setDashboardCardOrder    = (v: string)  => { setDashboardCardOrderState(v); localStorage.setItem("setting_dashboard_order", v); };
  const setDashboardCardsHidden  = (v: string)  => { setDashboardCardsHiddenState(v); localStorage.setItem("setting_dashboard_hidden", v); };
  const setCurrency              = (v: Currency) => { setCurrencyState(v); localStorage.setItem("setting_currency", v); };
  const setSplashBgGradient      = (v: SplashBgGradient) => { setSplashBgGradientState(v); localStorage.setItem("setting_splash_bg", v); };
  const setSplashTagline         = (v: string)  => { setSplashTaglineState(v); localStorage.setItem("setting_splash_tagline", v); };
  const setSplashDuration        = (v: number)  => { setSplashDurationState(Math.max(3, Math.min(15, v))); localStorage.setItem("setting_splash_duration", String(v)); };
  const setSplashShowStars       = (v: boolean) => { setSplashShowStarsState(v); localStorage.setItem("setting_splash_stars", String(v)); };
  const setSplashShowParticles   = (v: boolean) => { setSplashShowParticlesState(v); localStorage.setItem("setting_splash_particles", String(v)); };
  const setSplashLogoUrl         = (v: string)  => { setSplashLogoUrlState(v); localStorage.setItem("setting_splash_logo", v); };
  const setSplashLogoWidth       = (v: number)  => { setSplashLogoWidthState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_w", String(v)); };
  const setSplashLogoHeight      = (v: number)  => { setSplashLogoHeightState(Math.max(40, Math.min(300, v))); localStorage.setItem("setting_splash_logo_h", String(v)); };
  const setSplashLogoRadius      = (v: number)  => { setSplashLogoRadiusState(Math.max(0, Math.min(150, v))); localStorage.setItem("setting_splash_logo_r", String(v)); };
  const setSplashLogoOffsetX     = (v: number)  => { setSplashLogoOffsetXState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_ox", String(v)); };
  const setSplashLogoOffsetY     = (v: number)  => { setSplashLogoOffsetYState(Math.max(-200, Math.min(200, v))); localStorage.setItem("setting_splash_logo_oy", String(v)); };
  const setSplashLogoBgSize      = (v: number)  => { setSplashLogoBgSizeState(Math.max(0, Math.min(60, v))); localStorage.setItem("setting_splash_logo_bg", String(v)); };
  const setSplashAppName         = (v: string)  => { setSplashAppNameState(v); localStorage.setItem("setting_splash_app_name", v); };
  const setSplashStyle           = (v: SplashStyle) => { setSplashStyleState(v); localStorage.setItem("setting_splash_style", v); };
  /* ── Bootstrap on first mount ──────────────────────────────────── */
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
    applyFontFamily(fontFamily);
    applyFontWeight(fontWeight);
    applyCardColor(cardColorMode, cardColor);
    applyFontColor(fontColorMode, fontColor);
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
