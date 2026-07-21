import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { setBaseUrl } from "@/lib/api-client/index";

const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBase) {
  setBaseUrl(apiBase.replace(/\/+$/, ""));
}

// On low-end devices (< 4 logical CPUs) pause all decorative animations
// to prevent jank. The CSS class `reduce-motion` disables them.
if (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 4) < 4) {
  document.documentElement.classList.add("reduce-motion");
}

createRoot(document.getElementById("root")!).render(<App />);
