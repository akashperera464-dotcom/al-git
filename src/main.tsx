import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // global i18next init (en/si/ta) — must run before App
import "./index.css";
import App from "./App";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .catch(error => console.warn("Offline support could not be registered:", error));
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
