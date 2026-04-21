import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("caprina_token"));

// ─── Service Worker Registration ─────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        console.info("[PWA] Service worker registered", reg.scope);

        // No auto-reload on SW update — user will get update on next manual refresh

      })
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
