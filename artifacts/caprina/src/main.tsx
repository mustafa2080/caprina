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

        // لما يلاقي SW جديد — لا نعمل reload تلقائي، نخلي المستخدم يقرر
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // فيه نسخة جديدة — نعلم المستخدم بس مش نعمل reload إجباري
              console.info("[PWA] New version available — user can refresh manually");
              // اختياري: ممكن تضيف toast هنا لو حابب تعلم المستخدم
            }
          });
        });
      })
      .catch((err) => console.warn("[PWA] SW registration failed:", err));

    // إزالة الـ controllerchange auto-reload — كان بيسبب الـ reload التلقائي
    // لو حابب تفعله تاني: navigator.serviceWorker.addEventListener("controllerchange", ...)
  });
}

createRoot(document.getElementById("root")!).render(<App />);
