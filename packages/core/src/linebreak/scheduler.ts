import { defaultJustifyOptions, justifyParagraph, unjustify, type JustifyOptions } from "./justify";

type IdleCallback = (deadline: { timeRemaining(): number }) => void;
const requestIdle: (cb: IdleCallback) => number =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 200 })
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 16) as unknown as number;

/**
 * Typesets paragraphs during idle time and re-sets them when their width
 * or fonts change. Paragraphs are only ever handed over once settled.
 */
export class JustifyScheduler {
  private queue: HTMLElement[] = [];
  private queued = new Set<HTMLElement>();
  private managed = new Set<HTMLElement>();
  private widths = new WeakMap<HTMLElement, number>();
  private scheduled = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly onFonts = () => this.relayoutAll(true);
  options: JustifyOptions;

  constructor(private root: HTMLElement, options: Partial<JustifyOptions> = {}) {
    this.options = { ...defaultJustifyOptions, ...options };
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(root);
    }
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.addEventListener?.("loadingdone", this.onFonts);
      document.fonts.ready.then(() => !this.destroyed && this.relayoutAll(true));
    }
  }

  add(p: HTMLElement): void {
    this.managed.add(p);
    this.enqueue(p);
  }

  remove(p: HTMLElement): void {
    this.managed.delete(p);
    this.queued.delete(p);
    unjustify(p);
  }

  clear(): void {
    for (const p of this.managed) unjustify(p);
    this.managed.clear();
    this.queue = [];
    this.queued.clear();
  }

  destroy(): void {
    this.destroyed = true;
    this.clear();
    this.resizeObserver?.disconnect();
    if (typeof document !== "undefined") document.fonts?.removeEventListener?.("loadingdone", this.onFonts);
  }

  relayoutAll(force = false): void {
    for (const p of this.managed) {
      if (force) this.widths.delete(p);
      this.enqueue(p);
    }
  }

  private onResize(): void {
    // Release fixed lines right away so text reflows naturally while the
    // width is changing, then re-set once resizing settles.
    for (const p of this.managed) {
      if (p.isConnected && this.widths.get(p) !== p.clientWidth) unjustify(p);
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.relayoutAll(), 120);
  }

  private enqueue(p: HTMLElement): void {
    if (this.queued.has(p)) return;
    this.queued.add(p);
    this.queue.push(p);
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled || this.destroyed) return;
    this.scheduled = true;
    requestIdle((deadline) => {
      this.scheduled = false;
      while (this.queue.length && deadline.timeRemaining() > 2) {
        const p = this.queue.shift()!;
        this.queued.delete(p);
        if (!p.isConnected || !this.managed.has(p)) continue;
        const width = p.clientWidth;
        if (this.widths.get(p) === width && p.classList.contains("ov-justified")) continue;
        this.widths.set(p, width);
        justifyParagraph(p, this.options);
      }
      if (this.queue.length) this.schedule();
    });
  }
}
