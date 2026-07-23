import { createContext, useContext, useEffect, useRef, useState } from "react";
import i18n from "@/i18n";
import { authFetch } from "@/lib/api-url";

const LS_KEY_NAME = "app_config_name";
const LS_KEY_LOGO = "app_config_logo";
const LS_KEY_LOGO_W = "app_config_logo_w";
const LS_KEY_LOGO_H = "app_config_logo_h";
const LS_KEY_LOGO_ROTATION = "app_config_logo_rotation";
const LS_KEY_LOGO_OFFSET_X = "app_config_logo_offset_x";
const LS_KEY_LOGO_OFFSET_Y = "app_config_logo_offset_y";
const LS_KEY_LOGO_BG_ENABLED = "app_config_logo_bg_enabled";
const LS_KEY_LOGO_BG_COLOR = "app_config_logo_bg_color";
const LS_KEY_LOGO_BG_OPACITY = "app_config_logo_bg_opacity";
const LS_KEY_LOGO_BG_RADIUS = "app_config_logo_bg_radius";

interface AppConfigContextValue {
  appName: string;
  appLogo: string;
  logoWidth: number;
  logoHeight: number;
  logoRotation: number;
  logoOffsetX: number;
  logoOffsetY: number;
  logoBgEnabled: boolean;
  logoBgColor: string;
  logoBgOpacity: number;
  logoBgRadius: number;
  /** true once the server config has been fetched (success or failure) */
  configLoaded: boolean;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string) => void;
  setLogoWidth: (w: number) => void;
  setLogoHeight: (h: number) => void;
  setLogoRotation: (r: number) => void;
  setLogoOffsetX: (x: number) => void;
  setLogoOffsetY: (y: number) => void;
  setLogoBgEnabled: (v: boolean) => void;
  setLogoBgColor: (c: string) => void;
  setLogoBgOpacity: (o: number) => void;
  setLogoBgRadius: (r: number) => void;
  resetLogoBg: () => void;
  flushLogoSettings: () => Promise<void>;
  refreshAppConfig: () => void;
}

const AppConfigContext = createContext<AppConfigContextValue>({
  appName: "Pulse",
  appLogo: "",
  logoWidth: 96,
  logoHeight: 96,
  logoRotation: 0,
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoBgEnabled: false,
  logoBgColor: "#3b82f6",
  logoBgOpacity: 10,
  logoBgRadius: 16,
  configLoaded: false,
  setAppName: () => {},
  setAppLogo: () => {},
  setLogoWidth: () => {},
  setLogoHeight: () => {},
  setLogoRotation: () => {},
  setLogoOffsetX: () => {},
  setLogoOffsetY: () => {},
  setLogoBgEnabled: () => {},
  setLogoBgColor: () => {},
  setLogoBgOpacity: () => {},
  setLogoBgRadius: () => {},
  resetLogoBg: () => {},
  flushLogoSettings: async () => {},
  refreshAppConfig: () => {},
});

function hexToRgba(hex: string, opacityPct: number) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(100, opacityPct)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [configLoaded, setConfigLoaded] = useState(false);
  const [appName, setAppNameState] = useState(() =>
    localStorage.getItem(LS_KEY_NAME) || "Pulse"
  );
  const [appLogo, setAppLogoState] = useState(() =>
    localStorage.getItem(LS_KEY_LOGO) || ""
  );
  const [logoWidth, setLogoWidthState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_W) || "96");
    return isNaN(v) ? 96 : v;
  });
  const [logoHeight, setLogoHeightState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_H) || "96");
    return isNaN(v) ? 96 : v;
  });
  const [logoRotation, setLogoRotationState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_ROTATION) || "0");
    return isNaN(v) ? 0 : v;
  });
  const [logoOffsetX, setLogoOffsetXState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_OFFSET_X) || "0");
    return isNaN(v) ? 0 : v;
  });
  const [logoOffsetY, setLogoOffsetYState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_OFFSET_Y) || "0");
    return isNaN(v) ? 0 : v;
  });
  const [logoBgEnabled, setLogoBgEnabledState] = useState(() => {
    const v = localStorage.getItem(LS_KEY_LOGO_BG_ENABLED);
    return v === null ? false : v === "true";
  });
  const [logoBgColor, setLogoBgColorState] = useState(() =>
    localStorage.getItem(LS_KEY_LOGO_BG_COLOR) || "#3b82f6"
  );
  const [logoBgOpacity, setLogoBgOpacityState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_BG_OPACITY) || "10");
    return isNaN(v) ? 10 : v;
  });
  const [logoBgRadius, setLogoBgRadiusState] = useState(() => {
    const v = parseInt(localStorage.getItem(LS_KEY_LOGO_BG_RADIUS) || "16");
    return isNaN(v) ? 16 : v;
  });

  const pendingLogoFields = useRef<Record<string, unknown>>({});
  const logoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSaveInFlight = useRef<Promise<void> | null>(null);

  // Queue logo display fields so changing several controls only creates one PATCH.
  const saveLogoFieldsToServer = (fields: Record<string, unknown>) => {
    pendingLogoFields.current = { ...pendingLogoFields.current, ...fields };
    if (logoSaveTimer.current) clearTimeout(logoSaveTimer.current);
    logoSaveTimer.current = setTimeout(() => {
      logoSaveTimer.current = null;
      const queued = pendingLogoFields.current;
      pendingLogoFields.current = {};
      const request = authFetch("/api/settings/app", {
        method: "PATCH",
        body: JSON.stringify(queued),
      }).then(async response => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || `Logo settings save failed (${response.status})`);
        }
      });
      logoSaveInFlight.current = request.finally(() => {
          logoSaveInFlight.current = null;
        });
      // This is a debounced background save. Keep its error available to an
      // explicit flush, but prevent an unhandled rejection before then.
      logoSaveInFlight.current.catch(() => {});
    }, 250);
  };

  const flushLogoSettings = async () => {
    if (logoSaveTimer.current) {
      clearTimeout(logoSaveTimer.current);
      logoSaveTimer.current = null;
    }
    while (Object.keys(pendingLogoFields.current).length > 0 || logoSaveInFlight.current) {
      if (Object.keys(pendingLogoFields.current).length > 0 && !logoSaveInFlight.current) {
        const queued = pendingLogoFields.current;
        pendingLogoFields.current = {};
        const request = authFetch("/api/settings/app", {
          method: "PATCH",
          body: JSON.stringify(queued),
        }).then(async response => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || `Logo settings save failed (${response.status})`);
          }
        });
        logoSaveInFlight.current = request.finally(() => {
            logoSaveInFlight.current = null;
          });
        logoSaveInFlight.current.catch(() => {});
      }
      if (logoSaveInFlight.current) await logoSaveInFlight.current;
    }
  };

  const fetchConfig = () => {
    fetch("/api/settings/app", { cache: "no-cache" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          if (data.appName) {
            setAppNameState(data.appName);
            localStorage.setItem(LS_KEY_NAME, data.appName);
          }
          if (data.appLogo !== undefined) {
            setAppLogoState(data.appLogo || "");
            localStorage.setItem(LS_KEY_LOGO, data.appLogo || "");
          }
          // Logo display settings — server is source of truth; sync to localStorage as cache
          if (data.logoWidth   != null) { setLogoWidthState(data.logoWidth);   localStorage.setItem(LS_KEY_LOGO_W,          String(data.logoWidth)); }
          if (data.logoHeight  != null) { setLogoHeightState(data.logoHeight);  localStorage.setItem(LS_KEY_LOGO_H,          String(data.logoHeight)); }
          if (data.logoRotation != null) { setLogoRotationState(data.logoRotation); localStorage.setItem(LS_KEY_LOGO_ROTATION,  String(data.logoRotation)); }
          if (data.logoOffsetX != null) { setLogoOffsetXState(data.logoOffsetX); localStorage.setItem(LS_KEY_LOGO_OFFSET_X,  String(data.logoOffsetX)); }
          if (data.logoOffsetY != null) { setLogoOffsetYState(data.logoOffsetY); localStorage.setItem(LS_KEY_LOGO_OFFSET_Y,  String(data.logoOffsetY)); }
          if (data.logoBgEnabled != null) { setLogoBgEnabledState(Boolean(data.logoBgEnabled)); localStorage.setItem(LS_KEY_LOGO_BG_ENABLED, String(data.logoBgEnabled)); }
          if (data.logoBgColor != null)   { setLogoBgColorState(data.logoBgColor);     localStorage.setItem(LS_KEY_LOGO_BG_COLOR,   data.logoBgColor); }
          if (data.logoBgOpacity != null) { setLogoBgOpacityState(data.logoBgOpacity); localStorage.setItem(LS_KEY_LOGO_BG_OPACITY, String(data.logoBgOpacity)); }
          if (data.logoBgRadius != null)  { setLogoBgRadiusState(data.logoBgRadius);   localStorage.setItem(LS_KEY_LOGO_BG_RADIUS,  String(data.logoBgRadius)); }
        }
        setConfigLoaded(true);
      })
      .catch(() => { setConfigLoaded(true); });
  };

  useEffect(() => { fetchConfig(); }, []);

  useEffect(() => () => {
    if (logoSaveTimer.current) clearTimeout(logoSaveTimer.current);
  }, []);

  useEffect(() => {
    const updateTitle = () => {
      const subtitle = i18n.t("attendance_system");
      document.title = `${appName} – ${subtitle}`;
    };
    updateTitle();
    i18n.on("languageChanged", updateTitle);
    return () => { i18n.off("languageChanged", updateTitle); };
  }, [appName]);

  const setAppName = (name: string) => {
    const n = name || "Pulse";
    setAppNameState(n);
    localStorage.setItem(LS_KEY_NAME, n);
  };

  const setAppLogo = (logo: string) => {
    setAppLogoState(logo);
    localStorage.setItem(LS_KEY_LOGO, logo);
  };

  const setLogoWidth = (w: number) => {
    const v = Math.max(24, Math.min(300, w));
    setLogoWidthState(v);
    localStorage.setItem(LS_KEY_LOGO_W, String(v));
    saveLogoFieldsToServer({ logoWidth: v });
  };

  const setLogoHeight = (h: number) => {
    const v = Math.max(24, Math.min(300, h));
    setLogoHeightState(v);
    localStorage.setItem(LS_KEY_LOGO_H, String(v));
    saveLogoFieldsToServer({ logoHeight: v });
  };

  const setLogoRotation = (r: number) => {
    const v = Math.max(-180, Math.min(180, r));
    setLogoRotationState(v);
    localStorage.setItem(LS_KEY_LOGO_ROTATION, String(v));
    saveLogoFieldsToServer({ logoRotation: v });
  };

  const setLogoOffsetX = (x: number) => {
    const v = Math.max(-100, Math.min(100, x));
    setLogoOffsetXState(v);
    localStorage.setItem(LS_KEY_LOGO_OFFSET_X, String(v));
    saveLogoFieldsToServer({ logoOffsetX: v });
  };

  const setLogoOffsetY = (y: number) => {
    const v = Math.max(-100, Math.min(100, y));
    setLogoOffsetYState(v);
    localStorage.setItem(LS_KEY_LOGO_OFFSET_Y, String(v));
    saveLogoFieldsToServer({ logoOffsetY: v });
  };

  const setLogoBgEnabled = (v: boolean) => {
    setLogoBgEnabledState(v);
    localStorage.setItem(LS_KEY_LOGO_BG_ENABLED, String(v));
    saveLogoFieldsToServer({ logoBgEnabled: v });
  };

  const setLogoBgColor = (c: string) => {
    setLogoBgColorState(c);
    localStorage.setItem(LS_KEY_LOGO_BG_COLOR, c);
    saveLogoFieldsToServer({ logoBgColor: c });
  };

  const setLogoBgOpacity = (o: number) => {
    const v = Math.max(0, Math.min(100, o));
    setLogoBgOpacityState(v);
    localStorage.setItem(LS_KEY_LOGO_BG_OPACITY, String(v));
    saveLogoFieldsToServer({ logoBgOpacity: v });
  };

  const setLogoBgRadius = (r: number) => {
    const v = Math.max(0, Math.min(100, r));
    setLogoBgRadiusState(v);
    localStorage.setItem(LS_KEY_LOGO_BG_RADIUS, String(v));
    saveLogoFieldsToServer({ logoBgRadius: v });
  };

  const resetLogoBg = () => {
    setLogoBgEnabled(false);
    setLogoBgColor("#3b82f6");
    setLogoBgOpacity(10);
    setLogoBgRadius(16);
    // resetLogoBg calls the individual setters above which each save to server
  };

  return (
    <AppConfigContext.Provider value={{
      appName, appLogo, logoWidth, logoHeight, logoRotation, logoOffsetX, logoOffsetY,
      logoBgEnabled, logoBgColor, logoBgOpacity, logoBgRadius,
      configLoaded,
      setAppName, setAppLogo, setLogoWidth, setLogoHeight,
       setLogoRotation, setLogoOffsetX, setLogoOffsetY,
       setLogoBgEnabled, setLogoBgColor, setLogoBgOpacity, setLogoBgRadius, resetLogoBg,
       flushLogoSettings,
      refreshAppConfig: fetchConfig,
    }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export { hexToRgba };

export function useAppConfig() {
  return useContext(AppConfigContext);
}
