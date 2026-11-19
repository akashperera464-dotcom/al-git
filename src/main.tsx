import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // global i18next init (en/si/ta) — must run before App
import "./index.css";
import App from "./App";

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  // Never leave the boot splash on a silent failure: show the reason and a
  // way out. The inline recovery script in index.html handles stale bundles.
  // eslint-disable-next-line no-console
  console.error("[boot] React failed to mount", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = "";
    const panel = document.createElement("div");
    panel.style.cssText = "min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#04231a;color:#e6fff5;font-family:'Noto Sans',system-ui,sans-serif;padding:24px;text-align:center";
    const title = document.createElement("p");
    title.style.cssText = "margin:0;font-size:16px;font-weight:700";
    title.textContent = "KDU Estate Management could not start";
    const detail = document.createElement("p");
    detail.style.cssText = "margin:0;font-size:12.5px;color:#9fe8cf;max-width:26rem;line-height:1.6";
    detail.textContent = error instanceof Error ? error.message : "An unexpected error occurred.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Reload the latest version";
    retry.style.cssText = "margin-top:6px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;font:600 13px 'Noto Sans',system-ui,sans-serif;padding:10px 18px;border-radius:12px;cursor:pointer";
    retry.addEventListener("click", () => window.location.reload());
    panel.append(title, detail, retry);
    root.append(panel);
  }
}

/**
 * Chunk-loss recovery.
 *
 * A deploy replaces Vite's content-hashed chunks. If a browser is still
 * running an older shell (a cached route, a cached tab), its lazily-imported
 * module no longer exists on the server and the app dies mid-session. Instead
 * of a white screen we hand control to the boot script in index.html, which
 * unregisters service workers, clears caches and reloads once per session.
 */
function armChunkLossRecovery(): void {
  const recover = (reason: string) => {
    const handler = (window as unknown as { kduRecover?: (reason: string) => void }).kduRecover;
    if (typeof handler === "function") handler(reason);
  };
  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
    if (/dynamically imported module|Loading (CSS )?chunk|Importing a module script failed/i.test(message)) {
      event.preventDefault();
      recover("missing module");
    }
  });
  window.addEventListener("vite:preloadError", () => recover("preload"));
  window.addEventListener("error", (event) => {
    const target = event.target as (HTMLElement & { tagName?: string }) | null;
    if (target?.tagName === "SCRIPT") recover("script");
  }, true);
}
armChunkLossRecovery();

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
