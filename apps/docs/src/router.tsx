import { useEffect, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("popstate", fn);
  };
};

export function navigate(to: string) {
  const url = new URL(to, location.href);
  if (url.pathname === location.pathname && url.hash) {
    history.pushState(null, "", url);
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  history.pushState(null, "", url);
  for (const fn of listeners) fn();
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname.replace(/\/+$/, "") || "/", () => "/");
}

/**
 * Keeps in-site links (including ones inside rendered markdown) on the client.
 */
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = (event.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      event.preventDefault();
      navigate(url.pathname + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
