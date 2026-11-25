import { createOutput, type Output } from "./output";
import { normalizeParts, type Part, type ReasoningPart, type ToolPart } from "./parts/types";
import type { OutputOptions } from "./types";
import { createDiffView, type DiffView } from "./views/diff-view";
import { createReasoningView, type ReasoningView } from "./views/reasoning";
import { createToolCallView, type ToolCallView, type ToolCallViewOptions } from "./views/tool-call";

export interface TurnOptions extends OutputOptions {
  /** Options for tool-call rows: custom labels and summaries. */
  tools?: Pick<ToolCallViewOptions, "label" | "summarize">;
}

export interface Turn {
  readonly element: HTMLElement;
  /**
   * Renders the parts of one assistant turn. Call it again with the full
   * list whenever anything changes; only what changed is updated.
   * Accepts this library's parts or AI SDK UI message parts.
   */
  setParts(parts: readonly unknown[], options?: { streaming?: boolean }): void;
  update(options: TurnOptions): void;
  destroy(): void;
}

type Entry =
  | { kind: "text"; el: HTMLElement; view: Output }
  | { kind: "reasoning"; el: HTMLElement; view: ReasoningView }
  | { kind: "tool"; el: HTMLElement; view: ToolCallView }
  | { kind: "diff"; el: HTMLElement; view: DiffView };

/**
 * Renders a whole assistant turn: text, reasoning, tool calls, and diffs,
 * sharing one type system.
 *
 * ```ts
 * const turn = createTurn(el, { theme: "reader" });
 * turn.setParts(message.parts, { streaming: true });
 * ```
 */
export function createTurn(element: HTMLElement, options: TurnOptions = {}): Turn {
  let opts = { ...options };
  const entries = new Map<string, Entry>();
  let lastParts: readonly unknown[] = [];
  let lastStreaming = false;
  element.classList.add("ov-turn");
  if (opts.theme) element.dataset.ovTheme = opts.theme;

  const create = (key: string, part: Part): Entry => {
    switch (part.type) {
      case "text": {
        const el = document.createElement("div");
        return { kind: "text", el, view: createOutput(el, opts) };
      }
      case "reasoning": {
        const view = createReasoningView({ ...opts });
        return { kind: "reasoning", el: view.element, view };
      }
      case "tool": {
        const view = createToolCallView({ diff: opts.diff, highlight: opts.highlight, ...opts.tools });
        return { kind: "tool", el: view.element, view };
      }
      case "diff": {
        const view = createDiffView(opts.diff);
        view.element.classList.add("ov-turn-diff");
        return { kind: "diff", el: view.element, view };
      }
    }
  };

  const destroyEntry = (entry: Entry) => {
    entry.view.destroy();
    entry.el.remove();
  };

  return {
    element,
    setParts(rawParts, { streaming = false } = {}) {
      lastParts = rawParts;
      lastStreaming = streaming;
      const parts = normalizeParts(rawParts);
      const seen = new Set<string>();
      let previous: HTMLElement | null = null;
      parts.forEach((part, index) => {
        const key = `${part.type}:${part.id ?? index}`;
        seen.add(key);
        let entry = entries.get(key);
        if (entry && entry.kind !== part.type) {
          destroyEntry(entry);
          entry = undefined;
        }
        if (!entry) {
          entry = create(key, part);
          entries.set(key, entry);
        }
        // Keep DOM order in step with part order.
        const expectedNext: ChildNode | null = previous ? previous.nextSibling : element.firstChild;
        if (expectedNext !== entry.el) element.insertBefore(entry.el, expectedNext);
        previous = entry.el;

        const isLast = index === parts.length - 1;
        const live = (p: { state?: string }) => p.state === "streaming" || (p.state === undefined && streaming && isLast);
        switch (entry.kind) {
          case "text":
            entry.view.setText((part as { text: string }).text, { done: !live(part as { state?: string }) });
            break;
          case "reasoning":
            entry.view.update(part as ReasoningPart, live(part as { state?: string }));
            break;
          case "tool":
            entry.view.update(part as ToolPart);
            break;
          case "diff":
            entry.view.update((part as Extract<Part, { type: "diff" }>).diff, { settled: !(streaming && isLast) });
            break;
        }
      });
      for (const [key, entry] of entries) {
        if (!seen.has(key)) {
          destroyEntry(entry);
          entries.delete(key);
        }
      }
    },
    update(next) {
      const before = opts;
      opts = { ...opts, ...next };
      if (opts.theme) element.dataset.ovTheme = opts.theme;
      for (const entry of entries.values()) {
        if (entry.kind === "text") entry.view.update(next);
      }
      // Reasoning, tool and diff views take these options when they're
      // created, so rebuild them and replay the current parts.
      const rebuild =
        before.diff !== opts.diff ||
        before.highlight !== opts.highlight ||
        before.tools?.label !== opts.tools?.label ||
        before.tools?.summarize !== opts.tools?.summarize ||
        before.theme !== opts.theme;
      if (rebuild) {
        for (const [key, entry] of [...entries]) {
          if (entry.kind === "text") continue;
          destroyEntry(entry);
          entries.delete(key);
        }
        this.setParts(lastParts, { streaming: lastStreaming });
      }
    },
    destroy() {
      for (const entry of entries.values()) destroyEntry(entry);
      entries.clear();
      element.classList.remove("ov-turn");
    },
  };
}
