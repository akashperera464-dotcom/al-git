import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // global i18next init (en/si/ta) — must run before App
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
      const activateWhenInstalled = (worker: ServiceWorker | null) => {
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage("SKIP_WAITING");
          }
        });
      };

      // A previously downloaded release may already be waiting for old tabs
      // to close. Activate it immediately and reload once on controllerchange.
      registration.waiting?.postMessage("SKIP_WAITING");
      activateWhenInstalled(registration.installing);
      registration.addEventListener("updatefound", () => {
        activateWhenInstalled(registration.installing);
      });
      // Check on every application start instead of waiting for the browser's
      // periodic service-worker update window.
      void registration.update().catch(() => {});
    }).catch(() => {});
  });
}
