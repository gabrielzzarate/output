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
  /**
   * How far each letter may be tracked out on a loose line, in ems. Spreading
   * part of a line's extra space across its letters keeps word gaps from
   * opening into rivers. 0 turns it off.
   */
  letterSpacing: number;
}

export const defaultJustifyOptions: JustifyOptions = {
  hyphenate: false,
  minWidthEm: 22,
  stretch: 0.15,
  shrink: 0.035,
  hyphenPenalty: 50,
  letterSpacing: 0.012,
};

/** How one line's extra width is shared between word gaps and letters. */
export interface LineSpacing {
  /** Extra width added to each word gap, in px. */
  word: number;
  /** Extra width added after each letter, in px. */
  letter: number;
}

/**
 * Shares a line's slack between its word gaps and its letters, in
 * proportion to how much each may stretch, so neither is pushed to its
 * limit while the other has room. Shrinking only ever tightens word gaps.
 */
export function distributeSlack(slack: number, gaps: number, gapStretch: number, letters: number, letterStretch: number): LineSpacing {
  if (slack <= 0 || letters === 0 || letterStretch <= 0) return { word: gaps ? slack / gaps : 0, letter: 0 };
  const wordRoom = gaps * gapStretch;
  const letterRoom = letters * letterStretch;
  if (gaps === 0) return { word: 0, letter: Math.min(slack, letterRoom) / letters };
  const letter = (Math.min(slack / (wordRoom + letterRoom), 1) * letterRoom) / letters;
  return { word: (slack - letter * letters) / gaps, letter };
}

/** Counts the characters letter-spacing applies to (code points, as an approximation of grapheme clusters). */
function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/** Tracking below this many px per letter isn't worth losing ligatures for. */
const MIN_TRACKING = 0.01;

const ALLOWED_INLINE = new Set(["A", "STRONG", "EM", "B", "I", "CODE", "DEL", "S", "SPAN", "SUB", "SUP", "MARK", "KBD", "ABBR", "Q", "SMALL", "U"]);

interface Segment {
  node: Text;
  start: number;
  end: number;
}

type Ref =
  | { kind: "box"; segments: Segment[]; letters: number; ligatures: number }
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
    | { type: "box"; m: number; segment?: Segment }
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
      // It is never tracked out either, so it carries no segment.
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
          pending.push({
            type: "box",
            m: measure(node, fragmentOffset, fragmentOffset + fragment.length),
            segment: { node, start: fragmentOffset, end: fragmentOffset + fragment.length },
          });
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

  // Browsers drop ligatures (fi, ff, Th) from letter-spaced text, which
  // changes a word's width before any spacing is added. Measure every word
  // again with tracking on, and keep the difference for lines that use it.
  const letterStretch = Math.max(0, options.letterSpacing || 0) * fontSize;
  const ligatureDelta = new Map<number, number>();
  // A theme may already track the text; extra spacing is added to that.
  const baseSpacing = parseFloat(style.letterSpacing) || 0;
  if (letterStretch > 0) {
    // Measure with one extra pixel per letter on top of the theme's spacing.
    p.style.letterSpacing = `${baseSpacing + 1}px`;
    for (const entry of pending) {
      if (entry.type !== "box" || !entry.segment) continue;
      const tracked = measures[entry.m]!.getBoundingClientRect().width;
      const letters = charCount(entry.segment.node.data.slice(entry.segment.start, entry.segment.end));
      ligatureDelta.set(entry.m, tracked - letters - widths[entry.m]!);
    }
    p.style.removeProperty("letter-spacing");
  }

  const wordStretch = fontSize * options.stretch;
  // Merge adjacent boxes (a word split across <em> and plain text, for example).
  for (const entry of pending) {
    if (entry.type === "box" || entry.type === "edge") {
      const last = items[items.length - 1];
      const lastRef = refs[refs.length - 1];
      const w = entry.type === "box" ? widths[entry.m]! : entry.width;
      const segment = entry.type === "box" ? entry.segment : undefined;
      const letters = segment ? charCount(segment.node.data.slice(segment.start, segment.end)) : 0;
      const ligatures = entry.type === "box" ? (ligatureDelta.get(entry.m) ?? 0) : 0;
      if (last && last.type === "box" && lastRef?.kind === "box") {
        last.width += w;
        if (segment) lastRef.segments.push(segment);
        lastRef.letters += letters;
        lastRef.ligatures += ligatures;
      } else push(box(w), { kind: "box", segments: segment ? [segment] : [], letters, ligatures });
    } else if (entry.type === "glue") {
      const w = widths[entry.m]!;
      push(glue(w, wordStretch, Math.min(w * 0.5, fontSize * options.shrink)), { kind: "glue", node: entry.node, offset: entry.offset });
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

  // The breaker only knows about word gaps, so the lines it picks are the
  // same with or without tracking. Afterwards, each loose line hands part of
  // its slack (ratio times its gaps' stretch) to its letters, so gaps on
  // a loose line open up less than they otherwise would.
  const lines = breaks.map(() => ({ stretch: 0, shrink: 0, gaps: 0, letters: 0, ligatures: 0 }));
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const ref = refs[i]!;
    const l = lines[lineOf[i]!]!;
    if (item.type === "glue" && ref.kind === "glue" && !breakAt.has(i)) {
      l.stretch += item.stretch;
      l.shrink += item.shrink;
      l.gaps++;
    } else if (ref.kind === "box") {
      l.letters += ref.letters;
      l.ligatures += ref.ligatures;
    }
  }
  const spacing: LineSpacing[] = breaks.map((b, li) => {
    const l = lines[li]!;
    if (li === breaks.length - 1) return { word: 0, letter: 0 };
    if (b.ratio < 0) return { word: 0, letter: 0 }; // shrink is applied per gap below
    const slack = b.ratio * l.stretch;
    // Tracking the line costs its lost ligatures first; if that leaves
    // nothing, keep the ligatures and use the word gaps alone.
    const tracked = distributeSlack(slack - l.ligatures, l.gaps, wordStretch, l.letters, letterStretch);
    if (slack - l.ligatures > 0 && tracked.letter >= MIN_TRACKING && (l.gaps > 0 || tracked.letter * l.letters >= slack - l.ligatures - 0.01)) return tracked;
    return distributeSlack(slack, l.gaps, wordStretch, 0, 0);
  });
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    const ref = refs[i]!;
    if (ref.kind === "glue" && item.type === "glue") {
      if (breakAt.has(i)) {
        wrap(ref.node, ref.offset, "ov-br");
      } else {
        const ratio = breaks[lineOf[i]!]?.ratio ?? 0;
        const isLastLine = lineOf[i] === breaks.length - 1;
        const extra = isLastLine ? 0 : ratio >= 0 ? spacing[lineOf[i]!]!.word : ratio * item.shrink;
        if (Math.abs(extra) > 0.01) wrap(ref.node, ref.offset, "ov-g").style.wordSpacing = `${extra.toFixed(3)}px`;
      }
    } else if (ref.kind === "box" && ref.segments.length) {
      const letter = spacing[lineOf[i]!]!.letter;
      if (letter >= MIN_TRACKING) {
        for (let k = ref.segments.length - 1; k >= 0; k--) {
          const seg = ref.segments[k]!;
          wrapRange(seg.node, seg.start, seg.end, "ov-ls").style.letterSpacing = `${(baseSpacing + letter).toFixed(3)}px`;
        }
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

function wrapRange(node: Text, start: number, end: number, className: string): HTMLSpanElement {
  const inner = node.splitText(start);
  inner.splitText(end - start);
  const span = document.createElement("span");
  span.className = className;
  inner.parentNode!.insertBefore(span, inner);
  span.appendChild(inner);
  return span;
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
