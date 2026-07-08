import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { setBaseUrl } from "@/lib/api-client/index";

const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBase) {
  setBaseUrl(apiBase.replace(/\/+$/, ""));
}

createRoot(document.getElementById("root")!).render(<App />);
