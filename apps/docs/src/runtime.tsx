import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DiffRenderer, Highlighter } from "@output/react";

export type Scheme = "light" | "dark";

interface Runtime {
  scheme: Scheme;
  setScheme(scheme: Scheme): void;
  /** Shiki, once it has loaded. Text never waits for it. */
  highlight?: Highlighter;
  /** Pierre's diff renderer, once it has loaded. */
  diff?: DiffRenderer;
}

const RuntimeContext = createContext<Runtime>({ scheme: "light", setScheme() {} });

export const useRuntime = () => useContext(RuntimeContext);

function initialScheme(): Scheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.scheme === "dark" ? "dark" : "light";
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(initialScheme);
  const [highlight, setHighlight] = useState<Highlighter>();
  const [diff, setDiff] = useState<DiffRenderer>();

  const setScheme = (next: Scheme) => {
    setSchemeState(next);
    try {
      localStorage.setItem("docs-scheme", next);
    } catch {
      // Private windows can refuse storage; the toggle still works for this visit.
    }
  };

  useEffect(() => {
    // The site's own colors, and the library's for anything not given a scheme prop.
    document.documentElement.dataset.scheme = scheme;
    document.documentElement.dataset.ovScheme = scheme;
  }, [scheme]);

  // Both load after first paint, the way the library recommends.
  useEffect(() => {
    let cancelled = false;
    import("@output/core/shiki")
      .then(({ createShikiHighlighter }) =>
        createShikiHighlighter({ langs: ["tsx", "typescript", "bash", "css", "json", "diff"] }),
      )
      .then((h) => !cancelled && setHighlight(() => h));
    import("@output/core/diffs").then(({ createPierreDiffRenderer }) => !cancelled && setDiff(() => createPierreDiffRenderer()));
    return () => {
      cancelled = true;
    };
  }, []);

  return <RuntimeContext.Provider value={{ scheme, setScheme, highlight, diff }}>{children}</RuntimeContext.Provider>;
}
