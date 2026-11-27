import { BlockStream, type Block } from "./stream/blocks";
import { repairTail } from "./stream/repair";
import { markdown, renderTokens } from "./render/markdown";
import { JustifyScheduler } from "./linebreak/scheduler";
import { englishHyphenator } from "./linebreak/hyphenate";
import type { OutputOptions } from "./types";
import { isPatch } from "./diff/patch";
import { createDiffView, type DiffView } from "./views/diff-view";

export interface Output {
  /** The root element the output renders into. */
  readonly element: HTMLElement;
  /** All markdown received so far. */
  readonly text: string;
  /** True once `end()` has been called. */
  readonly ended: boolean;
  /** Adds streamed text. */
  append(chunk: string): void;
  /** Marks the stream as finished, which settles the last block. */
  end(): void;
  /**
   * Sets the full text so far. If it extends the current text, only the new
   * part is appended; otherwise the output starts over. This suits UI
   * frameworks that hand over the whole message on every render.
   */
  setText(text: string, options?: { done?: boolean }): void;
  /** Clears everything and starts a new stream. */
  reset(): void;
  /** Applies new options. Theme and justification changes re-render in place. */
  update(options: OutputOptions): void;
  /** Resolves once pending renders, highlighting, and justification are done. */
  flush(): Promise<void>;
  destroy(): void;
}

const defaults = {
  theme: "reader",
  justify: "auto" as "auto" | boolean,
  lang: "en",
  minJustifyWidth: 22,
  letterSpacing: 0.012,
};

/**
 * Fills in defaults for options that are missing or explicitly undefined,
 * as they are when a React prop isn't set.
 */
function withDefaults(options: OutputOptions): OutputOptions & typeof defaults {
  const out: Record<string, unknown> = { ...options };
  for (const [key, value] of Object.entries(defaults)) if (out[key] === undefined) out[key] = value;
  return out as unknown as OutputOptions & typeof defaults;
}

/**
 * Renders a stream of model output into `element`.
 *
 * ```ts
 * const out = createOutput(el, { theme: "reader" });
 * for await (const chunk of stream) out.append(chunk);
 * out.end();
 * ```
 */
export function createOutput(element: HTMLElement, options: OutputOptions = {}): Output {
  let opts = withDefaults({ ...options });
  let stream = new BlockStream();
  let ended = false;
  let live: { wrapper: HTMLElement; id: number } | null = null;
  const blocks: HTMLElement[] = [];
  let frame: number | null = null;
  let pendingChunks = "";
  let pendingEnd = false;
  const pendingWork = new Set<Promise<unknown>>();
  /** Diff views per block, in the order their fences appear in it. */
  const diffViews = new Map<HTMLElement, DiffView[]>();
  const rawOf = new WeakMap<HTMLElement, string>();
  const liveHtml = new WeakMap<HTMLElement, string>();

  const scheduler = new JustifyScheduler(element, {
    hyphenate: opts.hyphenate === false ? false : (opts.hyphenate ?? englishHyphenator),
    minWidthEm: opts.minJustifyWidth,
    letterSpacing: opts.letterSpacing,
  });

  element.classList.add("ov-output");
  applyRootAttributes();
  element.addEventListener("click", onClick);

  function applyRootAttributes() {
    element.dataset.ovTheme = opts.theme;
    element.dataset.ovJustify = String(opts.justify);
    if (!element.getAttribute("lang")) element.setAttribute("lang", opts.lang);
    scheduler.options.minWidthEm = opts.justify === true ? 0 : opts.minJustifyWidth;
    scheduler.options.letterSpacing = opts.letterSpacing;
    scheduler.options.hyphenate = opts.hyphenate === false ? false : (opts.hyphenate ?? englishHyphenator);
  }

  function onClick(event: MouseEvent) {
    const button = (event.target as Element | null)?.closest?.("[data-ov-copy]");
    if (!button || !element.contains(button)) return;
    const code = button.closest(".ov-code")?.querySelector("code")?.textContent ?? "";
    const done = (label: string) => {
      button.textContent = label;
      setTimeout(() => (button.textContent = "Copy"), 1600);
    };
    navigator.clipboard?.writeText(code).then(
      () => done("Copied"),
      () => done("Select and copy"),
    );
  }

  function scheduleFrame() {
    if (frame !== null) return;
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number;
    frame = raf(() => {
      frame = null;
      commit();
    });
  }

  function commit() {
    let update = pendingChunks ? stream.append(pendingChunks) : null;
    pendingChunks = "";
    if (pendingEnd && !stream.ended) {
      const last = stream.end();
      update = update ? { settled: [...update.settled, ...last.settled], live: last.live } : last;
    }
    pendingEnd = false;
    if (!update) return;

    for (const block of update.settled) settle(block);
    if (update.live) {
      const wrapper = live?.id === update.live.id ? live.wrapper : createWrapper(update.live);
      wrapper.dataset.ovType = update.live.type;
      const html = renderLive(update.live);
      if (liveHtml.get(wrapper) !== html) {
        liveHtml.set(wrapper, html);
        wrapper.innerHTML = html;
        upgradeDiffs(wrapper, false);
      }
      live = { wrapper, id: update.live.id };
    } else if (live) {
      for (const view of diffViews.get(live.wrapper) ?? []) view.destroy();
      diffViews.delete(live.wrapper);
      live.wrapper.remove();
      live = null;
    }
  }

  function createWrapper(block: Block): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "ov-block";
    wrapper.dataset.ovType = block.type;
    wrapper.dataset.ovLive = "";
    element.appendChild(wrapper);
    return wrapper;
  }

  function renderLive(block: Block): string {
    if (block.type === "code") return renderTokens([block.token]);
    const repaired = repairTail(block.raw);
    return repaired.trim() ? markdown.parse(repaired, { async: false }) as string : "";
  }

  function settle(block: Block) {
    let wrapper: HTMLElement;
    if (live && live.id === block.id) {
      wrapper = live.wrapper;
      live = null;
    } else {
      wrapper = createWrapper(block);
    }
    delete wrapper.dataset.ovLive;
    liveHtml.delete(wrapper);
    wrapper.dataset.ovType = block.type;
    wrapper.dataset.ovSettled = "";
    wrapper.innerHTML = renderTokens([block.token]);
    rawOf.set(wrapper, block.raw);
    blocks.push(wrapper);
    enhance(wrapper);
  }

  function enhance(wrapper: HTMLElement) {
    upgradeDiffs(wrapper, true);
    if (opts.highlight) {
      for (const figure of wrapper.querySelectorAll<HTMLElement>(".ov-code")) highlight(figure);
    }
    if (opts.justify !== false) {
      for (const p of wrapper.querySelectorAll<HTMLElement>("p")) scheduler.add(p);
    }
  }

  /**
   * Shows every ```diff fence in a block that holds a real patch as a diff
   * view, reusing the block's existing views so a streaming diff isn't
   * rebuilt on every frame. Everything else in the block is left as it is.
   */
  function upgradeDiffs(wrapper: HTMLElement, settled: boolean) {
    const figures = [...wrapper.querySelectorAll<HTMLElement>(".ov-code")].filter((figure) => {
      const lang = figure.dataset.ovLang;
      return (lang === "diff" || lang === "patch") && isPatch(figure.querySelector("code")?.textContent ?? "");
    });
    const views = diffViews.get(wrapper) ?? [];
    figures.forEach((figure, i) => {
      const patch = figure.querySelector("code")?.textContent ?? "";
      const view = (views[i] ??= createDiffView(opts.diff));
      figure.replaceWith(view.element);
      view.update({ patch: patch.endsWith("\n") ? patch : patch + "\n" }, { settled });
    });
    for (const extra of views.splice(figures.length)) extra.destroy();
    if (views.length) diffViews.set(wrapper, views);
    else diffViews.delete(wrapper);
    // Tag the block as a diff only when the diff is all it holds.
    if (figures.length === 1 && wrapper.childElementCount === 1) wrapper.dataset.ovType = "diff";
  }

  function highlight(figure: HTMLElement) {
    const code = figure.querySelector("code");
    if (!code || !opts.highlight) return;
    const lang = figure.dataset.ovLang ?? "text";
    const source = code.textContent ?? "";
    const apply = (html: string) => {
      if (element.contains(code)) {
        code.innerHTML = html;
        figure.dataset.ovHighlighted = "";
      }
    };
    try {
      const result = opts.highlight(source, lang);
      if (typeof result === "string") apply(result);
      else {
        const work = result.then(apply, () => {}).finally(() => pendingWork.delete(work));
        pendingWork.add(work);
      }
    } catch {
      // A failed highlight leaves readable plain code.
    }
  }

  function rerenderSettled() {
    scheduler.clear();
    for (const wrapper of blocks) enhance(wrapper);
  }

  return {
    element,
    get text() {
      return stream.source + pendingChunks;
    },
    get ended() {
      return ended;
    },
    append(chunk) {
      if (ended) throw new Error("Cannot append after end(). Call reset() to start a new stream.");
      if (!chunk) return;
      pendingChunks += chunk;
      scheduleFrame();
    },
    end() {
      if (ended) return;
      ended = true;
      pendingEnd = true;
      scheduleFrame();
    },
    setText(text, { done = false } = {}) {
      const current = this.text;
      if (text.startsWith(current) && !(ended && text.length > current.length)) {
        if (text.length > current.length) this.append(text.slice(current.length));
      } else {
        this.reset();
        this.append(text);
      }
      if (done) this.end();
    },
    reset() {
      if (frame !== null) {
        (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout)(frame);
        frame = null;
      }
      scheduler.clear();
      for (const views of diffViews.values()) for (const view of views) view.destroy();
      diffViews.clear();
      for (const wrapper of blocks) wrapper.remove();
      blocks.length = 0;
      live?.wrapper.remove();
      live = null;
      stream = new BlockStream();
      ended = false;
      pendingChunks = "";
      pendingEnd = false;
    },
    update(next) {
      const before = opts;
      opts = withDefaults({ ...opts, ...next });
      applyRootAttributes();
      if (before.diff !== opts.diff) {
        // Copy the keys first: re-rendering adds fresh views to the map.
        for (const wrapper of [...diffViews.keys()]) {
          for (const view of diffViews.get(wrapper) ?? []) view.destroy();
          diffViews.delete(wrapper);
          const raw = rawOf.get(wrapper);
          if (raw !== undefined) {
            wrapper.innerHTML = renderTokens(markdown.lexer(raw));
            enhance(wrapper);
          } else if (liveHtml.has(wrapper)) {
            wrapper.innerHTML = liveHtml.get(wrapper)!;
            upgradeDiffs(wrapper, false);
          }
        }
      }
      if (before.justify !== opts.justify || before.hyphenate !== opts.hyphenate || before.highlight !== opts.highlight || before.minJustifyWidth !== opts.minJustifyWidth || before.letterSpacing !== opts.letterSpacing) {
        if (before.highlight !== opts.highlight) {
          for (const wrapper of blocks) {
            const fresh = document.createElement("div");
            for (const figure of wrapper.querySelectorAll<HTMLElement>(".ov-code")) {
              const code = figure.querySelector("code");
              if (code) {
                fresh.textContent = code.textContent ?? "";
                code.innerHTML = fresh.innerHTML;
              }
            }
          }
        }
        rerenderSettled();
      } else if (before.theme !== opts.theme) {
        scheduler.relayoutAll(true);
      }
    },
    async flush() {
      if (frame !== null) {
        (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout)(frame);
        frame = null;
        commit();
      }
      await Promise.all([...pendingWork]);
    },
    destroy() {
      this.reset();
      scheduler.destroy();
      element.removeEventListener("click", onClick);
      element.classList.remove("ov-output");
    },
  };
}
