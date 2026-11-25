import { box, breakParagraph, glue, penalty, type Item } from "./knuth-plass";
import type { Hyphenator } from "./hyphenate";

export interface JustifyOptions {
  hyphenate: Hyphenator | false;
  /** Paragraphs narrower than this many ems keep ragged-right text. */
  minWidthEm: number;
  /** How far a space may stretch, in ems. */
  stretch: number;
  /**
   * How far a space may shrink, in ems. Kept small on purpose: many text
   * faces already have narrow spaces, and squeezed lines read worse than
   * loose ones.
   */
  shrink: number;
  /** Cost of breaking at a hyphen. */
  hyphenPenalty: number;
}

export const defaultJustifyOptions: JustifyOptions = {
  hyphenate: false,
  minWidthEm: 22,
  stretch: 0.15,
  shrink: 0.035,
  hyphenPenalty: 50,
};

const ALLOWED_INLINE = new Set(["A", "STRONG", "EM", "B", "I", "CODE", "DEL", "S", "SPAN", "SUB", "SUP", "MARK", "KBD", "ABBR", "Q", "SMALL", "U"]);

type Ref =
  | { kind: "box" }
  | { kind: "glue"; node: Text; offset: number }
  | { kind: "hyphen"; node: Text; offset: number }
  | { kind: "dash"; node: Text; offset: number }
  | { kind: "end" };


const ORIGINAL = new WeakMap<HTMLElement, string>();

/** Restores a paragraph to its original markup. */
export function unjustify(p: HTMLElement): void {
  const original = ORIGINAL.get(p);
  if (original !== undefined) {
    p.innerHTML = original;
    ORIGINAL.delete(p);
  }
  p.classList.remove("ov-justified", "ov-measuring");
  delete p.dataset.ovLines;
}

/**
 * Sets a rendered paragraph with Knuth-Plass line breaks.
 *
 * The text itself is never rewritten. Line ends and hyphens are drawn with
 * generated content, and spacing is adjusted per space, so selecting,
 * copying, find-in-page, and screen readers all see the original words.
 * Returns false and leaves the paragraph ragged-right when it can't be set
 * well: a column too narrow to justify, unusual inline content, or a word
 * wider than the line.
 */
export function justifyParagraph(p: HTMLElement, options: JustifyOptions): boolean {
  unjustify(p);
  for (const el of p.querySelectorAll("*")) {
    if (!ALLOWED_INLINE.has(el.tagName)) return false;
  }
  const style = getComputedStyle(p);
  const fontSize = parseFloat(style.fontSize) || 16;
  const width = p.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
  if (!(width > 0) || width < options.minWidthEm * fontSize) return false;

  ORIGINAL.set(p, p.innerHTML);
  p.classList.add("ov-measuring");

  const items: Item[] = [];
  const refs: Ref[] = [];
  const push = (item: Item, ref: Ref) => {
    items.push(item);
    refs.push(ref);
  };

  // Collect the text, then measure everything in one layout pass.
  const measures: Range[] = [];
  const measure = (node: Text, start: number, end: number) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    measures.push(range);
    return measures.length - 1;
  };

  type Pending =
    | { type: "box"; m: number }
    | { type: "edge"; width: number }
    | { type: "glue"; m: number; node: Text; offset: number }
    | { type: "hyphen"; node: Text; offset: number; parent: Element }
    | { type: "dash"; node: Text; offset: number };
  const pending: Pending[] = [];
  const hyphenProbes = new Map<Element, HTMLSpanElement>();

  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let lastWasGlue = true; // no glue at the start of a paragraph
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    const text = node.data;
    const parent = node.parentElement ?? p;
    const inCode = parent.closest("code") !== null;
    const [leading, trailing] = inlineEdges(node, p);
    if (leading) pending.push({ type: "edge", width: leading });
    if (inCode) {
      // Inline code never breaks inside.
      if (text.length) pending.push({ type: "box", m: measure(node, 0, text.length) });
      if (trailing) pending.push({ type: "edge", width: trailing });
      lastWasGlue = false;
      continue;
    }
    const re = /(\s+)|([^\s]+)/g;
    for (let match = re.exec(text); match; match = re.exec(text)) {
      const start = match.index;
      if (match[1] !== undefined) {
        if (!lastWasGlue) pending.push({ type: "glue", m: measure(node, start, start + 1), node, offset: start });
        lastWasGlue = true;
        continue;
      }
      lastWasGlue = false;
      const word = match[2]!;
      // Allow a break after an existing hyphen or dash inside the word.
      const pieces = word.split(/(?<=[-‐–—])(?=\p{L})/u);
      let offset = start;
      pieces.forEach((piece, pi) => {
        const fragments = options.hyphenate && parent.closest("a") === null ? options.hyphenate(piece) : [piece];
        let fragmentOffset = offset;
        fragments.forEach((fragment, fi) => {
          pending.push({ type: "box", m: measure(node, fragmentOffset, fragmentOffset + fragment.length) });
          fragmentOffset += fragment.length;
          if (fi < fragments.length - 1) {
            pending.push({ type: "hyphen", node, offset: fragmentOffset, parent });
            if (!hyphenProbes.has(parent)) hyphenProbes.set(parent, document.createElement("span"));
          }
        });
        offset += piece.length;
        if (pi < pieces.length - 1) pending.push({ type: "dash", node, offset });
      });
    }
    if (trailing) pending.push({ type: "edge", width: trailing });
  }

  for (const [parent, probe] of hyphenProbes) {
    probe.textContent = "‐";
    parent.appendChild(probe);
  }
  const widths = measures.map((r) => r.getBoundingClientRect().width);
  const hyphenWidth = new Map<Element, number>();
  for (const [parent, probe] of hyphenProbes) {
    hyphenWidth.set(parent, probe.getBoundingClientRect().width);
    probe.remove();
  }

  // Merge adjacent boxes (a word split across <em> and plain text, for example).
  for (const entry of pending) {
    if (entry.type === "box" || entry.type === "edge") {
      const last = items[items.length - 1];
      const w = entry.type === "box" ? widths[entry.m]! : entry.width;
      if (last && last.type === "box") last.width += w;
      else push(box(w), { kind: "box" });
    } else if (entry.type === "glue") {
      const w = widths[entry.m]!;
      push(glue(w, fontSize * options.stretch, Math.min(w * 0.5, fontSize * options.shrink)), { kind: "glue", node: entry.node, offset: entry.offset });
    } else if (entry.type === "hyphen") {
      push(penalty(hyphenWidth.get(entry.parent) ?? fontSize * 0.33, options.hyphenPenalty, true), {
        kind: "hyphen",
        node: entry.node,
        offset: entry.offset,
      });
    } else {
      push(penalty(0, options.hyphenPenalty, true), { kind: "dash", node: entry.node, offset: entry.offset });
    }
  }
  // Drop trailing glue, then finish the paragraph the TeX way.
  while (items.length && items[items.length - 1]!.type !== "box") {
    items.pop();
    refs.pop();
  }
  push(glue(0, 100000, 0), { kind: "end" });
  push(penalty(0, -10000, true), { kind: "end" });

  // Leave a quarter pixel of slack for sub-pixel rounding between words.
  const breaks = breakParagraph(items, width - 0.25);
  if (!breaks || breaks.length < 2) {
    unjustify(p);
    return false;
  }

  // Apply from the end backwards so earlier text offsets stay valid.
  const lineOf: number[] = new Array(items.length);
  let line = 0;
  for (let i = 0; i < items.length; i++) {
    lineOf[i] = line;
    if (breaks[line] && breaks[line]!.position === i) line++;
  }
  const breakAt = new Set(breaks.slice(0, -1).map((b) => b.position));
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    const ref = refs[i]!;
    if (ref.kind === "glue" && item.type === "glue") {
      if (breakAt.has(i)) {
        wrap(ref.node, ref.offset, "ov-br");
      } else {
        const ratio = breaks[lineOf[i]!]?.ratio ?? 0;
        const isLastLine = lineOf[i] === breaks.length - 1;
        const extra = isLastLine ? 0 : ratio >= 0 ? ratio * item.stretch : ratio * item.shrink;
        if (Math.abs(extra) > 0.01) wrap(ref.node, ref.offset, "ov-g").style.wordSpacing = `${extra.toFixed(2)}px`;
      }
    } else if ((ref.kind === "hyphen" || ref.kind === "dash") && breakAt.has(i)) {
      const marker = document.createElement("span");
      marker.className = ref.kind === "hyphen" ? "ov-hy" : "ov-br";
      marker.setAttribute("aria-hidden", "true");
      const tail = ref.node.splitText(ref.offset);
      tail.parentNode!.insertBefore(marker, tail);
    }
  }

  p.classList.remove("ov-measuring");
  p.classList.add("ov-justified");
  p.dataset.ovLines = String(breaks.length);
  return true;
}

/**
 * Padding, border, and margin that inline elements (such as code with a
 * background) add before and after a text node. Range measurements only
 * cover the glyphs, so these have to be added to the line widths.
 */
function inlineEdges(node: Text, root: HTMLElement): [number, number] {
  let leading = 0;
  let trailing = 0;
  let child: Node = node;
  for (let el = node.parentElement; el && el !== root; child = el, el = el.parentElement) {
    const first = child === firstContent(el);
    const last = child === lastContent(el);
    if (!first && !last) break;
    const cs = getComputedStyle(el);
    if (first) leading += px(cs.paddingLeft) + px(cs.borderLeftWidth) + px(cs.marginLeft);
    if (last) trailing += px(cs.paddingRight) + px(cs.borderRightWidth) + px(cs.marginRight);
  }
  return [leading, trailing];
}

function firstContent(el: Element): Node | null {
  let n = el.firstChild;
  while (n && n.nodeType === Node.TEXT_NODE && !(n as Text).data) n = n.nextSibling;
  return n;
}

function lastContent(el: Element): Node | null {
  let n = el.lastChild;
  while (n && n.nodeType === Node.TEXT_NODE && !(n as Text).data) n = n.previousSibling;
  return n;
}

function px(value: string): number {
  return parseFloat(value) || 0;
}

function wrap(node: Text, offset: number, className: string): HTMLSpanElement {
  const after = node.splitText(offset);
  after.splitText(1);
  const span = document.createElement("span");
  span.className = className;
  after.parentNode!.insertBefore(span, after);
  span.appendChild(after);
  return span;
}
