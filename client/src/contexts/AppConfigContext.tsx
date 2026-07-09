import { createContext, useContext, useEffect, useState } from "react";

const LS_KEY_NAME = "app_config_name";
const LS_KEY_LOGO = "app_config_logo";
const LS_KEY_LOGO_W = "app_config_logo_w";
const LS_KEY_LOGO_H = "app_config_logo_h";
const LS_KEY_LOGO_ROTATION = "app_config_logo_rotation";
const LS_KEY_LOGO_OFFSET_X = "app_config_logo_offset_x";
const LS_KEY_LOGO_OFFSET_Y = "app_config_logo_offset_y";

interface AppConfigContextValue {
  appName: string;
  appLogo: string;
  logoWidth: number;
  logoHeight: number;
  logoRotation: number;
  logoOffsetX: number;
  logoOffsetY: number;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string) => void;
  setLogoWidth: (w: number) => void;
  setLogoHeight: (h: number) => void;
  setLogoRotation: (r: number) => void;
  setLogoOffsetX: (x: number) => void;
  setLogoOffsetY: (y: number) => void;
  refreshAppConfig: () => void;
}

const AppConfigContext = createContext<AppConfigContextValue>({
  appName: "AttendX",
  appLogo: "",
  logoWidth: 96,
  logoHeight: 96,
  logoRotation: 0,
  logoOffsetX: 0,
  logoOffsetY: 0,
  setAppName: () => {},
  setAppLogo: () => {},
  setLogoWidth: () => {},
  setLogoHeight: () => {},
  setLogoRotation: () => {},
  setLogoOffsetX: () => {},
  setLogoOffsetY: () => {},
  refreshAppConfig: () => {},
});

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [appName, setAppNameState] = useState(() =>
    localStorage.getItem(LS_KEY_NAME) || "AttendX"
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

  const fetchConfig = () => {
    fetch("/api/settings/app", { cache: "no-cache" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.appName) {
          setAppNameState(data.appName);
          localStorage.setItem(LS_KEY_NAME, data.appName);
        }
        if (data.appLogo !== undefined) {
          setAppLogoState(data.appLogo || "");
          localStorage.setItem(LS_KEY_LOGO, data.appLogo || "");
        }
      })
      .catch(() => {});
  };

  useEffect(() => { fetchConfig(); }, []);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  const setAppName = (name: string) => {
    const n = name || "AttendX";
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
  };

  const setLogoHeight = (h: number) => {
    const v = Math.max(24, Math.min(300, h));
    setLogoHeightState(v);
    localStorage.setItem(LS_KEY_LOGO_H, String(v));
  };

  const setLogoRotation = (r: number) => {
    const v = Math.max(-180, Math.min(180, r));
    setLogoRotationState(v);
    localStorage.setItem(LS_KEY_LOGO_ROTATION, String(v));
  };

  const setLogoOffsetX = (x: number) => {
    const v = Math.max(-100, Math.min(100, x));
    setLogoOffsetXState(v);
    localStorage.setItem(LS_KEY_LOGO_OFFSET_X, String(v));
  };

  const setLogoOffsetY = (y: number) => {
    const v = Math.max(-100, Math.min(100, y));
    setLogoOffsetYState(v);
    localStorage.setItem(LS_KEY_LOGO_OFFSET_Y, String(v));
  };

  return (
    <AppConfigContext.Provider value={{
      appName, appLogo, logoWidth, logoHeight, logoRotation, logoOffsetX, logoOffsetY,
      setAppName, setAppLogo, setLogoWidth, setLogoHeight,
      setLogoRotation, setLogoOffsetX, setLogoOffsetY,
      refreshAppConfig: fetchConfig,
    }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
