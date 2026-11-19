import { lazy, type ComponentType } from "react";

/**
 * A deploy-safe replacement for React's `lazy`.
 *
 * Vite emits content-hashed chunks, so a browser that is still running a shell
 * from a previous release asks for a module that the server no longer has
 * ("Failed to fetch dynamically imported module: /assets/Dashboard-*.js") and
 * the screen would otherwise stay empty. Instead we trigger the boot recovery
 * defined in index.html, which unregisters service workers, clears caches and
 * reloads once per session, so the next load always serves a consistent set.
 */
export function lazyModule<T extends { default: ComponentType }>(loader: () => Promise<T>) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (/dynamically imported module|Importing a module script failed|Loading (CSS )?chunk/i.test(message)) {
        const recover = (window as unknown as { kduRecover?: (reason: string) => void }).kduRecover;
        if (typeof recover === "function") recover("module");
      }
      throw error;
    }
  });
}
