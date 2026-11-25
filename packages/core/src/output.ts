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
};

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
  let opts = { ...defaults, ...options };
  let stream = new BlockStream();
  let ended = false;
  let live: { wrapper: HTMLElement; id: number } | null = null;
  const blocks: HTMLElement[] = [];
  let frame: number | null = null;
  let pendingChunks = "";
  let pendingEnd = false;
  const pendingWork = new Set<Promise<unknown>>();
  const diffViews = new Map<HTMLElement, DiffView>();
  const rawOf = new WeakMap<HTMLElement, string>();
  const liveHtml = new WeakMap<HTMLElement, string>();

  const scheduler = new JustifyScheduler(element, {
    hyphenate: opts.hyphenate === false ? false : (opts.hyphenate ?? englishHyphenator),
    minWidthEm: opts.minJustifyWidth,
  });

  element.classList.add("ov-output");
  applyRootAttributes();
  element.addEventListener("click", onClick);

  function applyRootAttributes() {
    element.dataset.ovTheme = opts.theme;
    element.dataset.ovJustify = String(opts.justify);
    if (!element.getAttribute("lang")) element.setAttribute("lang", opts.lang);
    scheduler.options.minWidthEm = opts.justify === true ? 0 : opts.minJustifyWidth;
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
      const existing = diffViews.get(wrapper);
      if (existing && wrapper.contains(existing.element)) {
        const probe = document.createElement("div");
        probe.innerHTML = html;
        const figure = probe.querySelector<HTMLElement>(".ov-code");
        if (figure) {
          wrapper.replaceChildren(figure);
          upgradeDiff(wrapper, figure, false);
        } else {
          wrapper.innerHTML = html;
        }
      } else if (liveHtml.get(wrapper) !== html) {
        liveHtml.set(wrapper, html);
        wrapper.innerHTML = html;
        const figure = wrapper.querySelector<HTMLElement>(".ov-code");
        if (figure) upgradeDiff(wrapper, figure, false);
      }
      live = { wrapper, id: update.live.id };
    } else if (live) {
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
    for (const figure of wrapper.querySelectorAll<HTMLElement>(".ov-code")) {
      if (upgradeDiff(wrapper, figure, true)) return;
    }
    if (opts.highlight) {
      for (const figure of wrapper.querySelectorAll<HTMLElement>(".ov-code")) highlight(figure);
    }
    if (opts.justify !== false) {
      for (const p of wrapper.querySelectorAll<HTMLElement>("p")) scheduler.add(p);
    }
  }

  /** Shows a ```diff fence that holds a real patch as a diff view. */
  function upgradeDiff(wrapper: HTMLElement, figure: HTMLElement, settled: boolean): boolean {
    const lang = figure.dataset.ovLang;
    if (lang !== "diff" && lang !== "patch") return false;
    const patch = figure.querySelector("code")?.textContent ?? "";
    if (!isPatch(patch)) return false;
    let view = diffViews.get(wrapper);
    if (!view) {
      view = createDiffView(opts.diff);
      diffViews.set(wrapper, view);
    }
    figure.replaceWith(view.element);
    view.update({ patch: patch.endsWith("\n") ? patch : patch + "\n" }, { settled });
    wrapper.dataset.ovType = "diff";
    return true;
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
      for (const view of diffViews.values()) view.destroy();
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
      opts = { ...opts, ...next };
      applyRootAttributes();
      if (before.diff !== opts.diff) {
        for (const [wrapper, view] of diffViews) {
          view.destroy();
          diffViews.delete(wrapper);
          const block = blocks.indexOf(wrapper);
          if (block !== -1) {
            const raw = rawOf.get(wrapper);
            if (raw !== undefined) {
              wrapper.innerHTML = renderTokens(markdown.lexer(raw));
              enhance(wrapper);
            }
          }
        }
      }
      if (before.justify !== opts.justify || before.hyphenate !== opts.hyphenate || before.highlight !== opts.highlight || before.minJustifyWidth !== opts.minJustifyWidth) {
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
