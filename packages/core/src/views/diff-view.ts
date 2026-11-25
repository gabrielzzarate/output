import { diffStats } from "../diff/patch";
import { renderPlainDiff } from "../diff/plain";
import type { DiffInput, DiffRenderer } from "../diff/types";
import { escapeHtml } from "../render/markdown";

/** One shared observer tells every diff view when a color scheme changes. */
const schemeListeners = new Set<() => void>();
let schemeObserver: MutationObserver | null = null;
function onSchemeChange(listener: () => void): () => void {
  if (!schemeObserver && typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    schemeObserver = new MutationObserver(() => {
      for (const l of [...schemeListeners]) l();
    });
    schemeObserver.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-ov-scheme"] });
  }
  schemeListeners.add(listener);
  return () => {
    schemeListeners.delete(listener);
    if (!schemeListeners.size && schemeObserver) {
      schemeObserver.disconnect();
      schemeObserver = null;
    }
  };
}

export interface DiffView {
  readonly element: HTMLElement;
  /** Shows the diff. `settled` diffs go to the renderer; live ones use the plain view. */
  update(input: DiffInput, options?: { settled?: boolean }): void;
  destroy(): void;
}

/**
 * A diff with a file header and change counts. While the diff is still
 * streaming it shows a light plain view; once settled it hands off to the
 * configured renderer (for example Pierre's), so highlighting runs once.
 */
export function createDiffView(renderer?: DiffRenderer): DiffView {
  const figure = document.createElement("figure");
  figure.className = "ov-diff";
  figure.innerHTML = `<figcaption class="ov-diff-bar"><span class="ov-diff-name"></span><span class="ov-diff-stat"></span></figcaption><div class="ov-diff-body"></div>`;
  const name = figure.querySelector<HTMLElement>(".ov-diff-name")!;
  const stat = figure.querySelector<HTMLElement>(".ov-diff-stat")!;
  const body = figure.querySelector<HTMLElement>(".ov-diff-body")!;
  let cleanup: (() => void) | null = null;
  let lastKey = "";
  let lastInput: DiffInput | null = null;
  let lastSettled = false;

  const schemeOf = (): "light" | "dark" | "system" => {
    const scheme = figure.closest<HTMLElement>("[data-ov-scheme]")?.dataset.ovScheme;
    return scheme === "light" || scheme === "dark" ? scheme : "system";
  };

  // Re-render a settled diff when its light/dark scheme changes, so the
  // renderer's token colors match the background.
  const stopListening = renderer
    ? onSchemeChange(() => {
        if (lastInput && lastSettled && figure.isConnected) view.update(lastInput, { settled: true });
      })
    : () => {};

  const view: DiffView = {
    element: figure,
    update(input, { settled = true } = {}) {
      lastInput = input;
      lastSettled = settled;
      const key = (settled ? `s:${renderer ? schemeOf() : ""}:` : "l:") + JSON.stringify(input);
      if (key === lastKey) return;
      lastKey = key;
      const stats = diffStats(input);
      name.textContent = stats.name || "Changes";
      stat.innerHTML = `<span class="ov-diff-add-n">+${stats.additions}</span><span class="ov-diff-del-n">−${stats.deletions}</span>`;
      stat.setAttribute("aria-label", `${stats.additions} added, ${stats.deletions} removed`);
      cleanup?.();
      cleanup = null;
      figure.dataset.ovState = settled ? "settled" : "live";
      if (settled && renderer) {
        body.innerHTML = "";
        try {
          cleanup = renderer.render(body, input, { scheme: schemeOf() });
          figure.dataset.ovRenderer = "custom";
          return;
        } catch (error) {
          console.error("[output] diff renderer failed, showing plain diff", error);
        }
      }
      delete figure.dataset.ovRenderer;
      body.innerHTML = renderPlainDiff(input);
    },
    destroy() {
      stopListening();
      cleanup?.();
      cleanup = null;
      figure.remove();
    },
  };
  return view;
}

