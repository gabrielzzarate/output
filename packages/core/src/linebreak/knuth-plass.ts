/**
 * The Knuth-Plass optimal line breaking algorithm, as used by TeX.
 *
 * A paragraph is a list of items: boxes (unbreakable content such as a word
 * or a syllable), glue (stretchable space), and penalties (places where a
 * break is allowed at some cost, such as a hyphen). The algorithm picks the
 * set of breaks that minimises total "demerits" over the whole paragraph,
 * rather than filling each line greedily, which is what removes the rivers
 * and gappy lines browsers produce with `text-align: justify`.
 */

export interface Box {
  type: "box";
  width: number;
}
export interface Glue {
  type: "glue";
  width: number;
  stretch: number;
  shrink: number;
}
export interface Penalty {
  type: "penalty";
  width: number;
  penalty: number;
  flagged: boolean;
}
export type Item = Box | Glue | Penalty;

export const INFINITY = 10000;

export const box = (width: number): Box => ({ type: "box", width });
export const glue = (width: number, stretch: number, shrink: number): Glue => ({ type: "glue", width, stretch, shrink });
export const penalty = (width: number, cost: number, flagged = false): Penalty => ({
  type: "penalty",
  width,
  penalty: cost,
  flagged,
});

export interface BreakOptions {
  /** Largest adjustment ratio allowed for a line. TeX uses 1 to 2; higher accepts looser lines. */
  tolerance?: number;
  /** Added to every line, so fewer lines are preferred. */
  linePenalty?: number;
  /** Charged when two consecutive lines both end in a hyphen. */
  flaggedDemerits?: number;
  /** Charged when a tight line sits next to a loose one. */
  fitnessDemerits?: number;
  /** When false, flagged penalties (hyphens) are not considered as breaks. */
  hyphenate?: boolean;
}

export interface Break {
  /** Index of the item the line ends at. */
  position: number;
  /** How much the line's glue is stretched (positive) or shrunk (negative), as a fraction of its capacity. */
  ratio: number;
}

interface Node {
  position: number;
  line: number;
  fitness: number;
  width: number;
  stretch: number;
  shrink: number;
  demerits: number;
  ratio: number;
  previous: Node | null;
}

/**
 * Returns the optimal breaks, or null when the paragraph can't be set within
 * the tolerance (for example a word wider than the line).
 */
export function breakLines(
  items: Item[],
  lineWidth: number | ((line: number) => number),
  options: BreakOptions = {},
): Break[] | null {
  const tolerance = options.tolerance ?? 2;
  const linePenalty = options.linePenalty ?? 10;
  const flaggedDemerits = options.flaggedDemerits ?? 3000;
  const fitnessDemerits = options.fitnessDemerits ?? 3000;
  const hyphenate = options.hyphenate ?? true;
  const widthOf = typeof lineWidth === "number" ? () => lineWidth : lineWidth;

  const sum = { width: 0, stretch: 0, shrink: 0 };
  let active: Node[] = [
    { position: 0, line: 0, fitness: 1, width: 0, stretch: 0, shrink: 0, demerits: 0, ratio: 0, previous: null },
  ];

  const ratioFor = (node: Node, index: number, item: Item): number => {
    let width = sum.width - node.width;
    if (item.type === "penalty") width += item.width;
    const target = widthOf(node.line);
    if (width < target) {
      const stretch = sum.stretch - node.stretch;
      return stretch > 0 ? (target - width) / stretch : INFINITY;
    }
    if (width > target) {
      const shrink = sum.shrink - node.shrink;
      return shrink > 0 ? (target - width) / shrink : -INFINITY;
    }
    return 0;
  };

  const totalsAfter = (index: number) => {
    const totals = { ...sum };
    for (let j = index; j < items.length; j++) {
      const it = items[j]!;
      if (it.type === "glue") {
        totals.width += it.width;
        totals.stretch += it.stretch;
        totals.shrink += it.shrink;
      } else if (it.type === "box" || (it.penalty === -INFINITY && j > index)) {
        break;
      }
    }
    return totals;
  };

  const consider = (index: number, item: Item) => {
    const isPenalty = item.type === "penalty";
    const cost = isPenalty ? item.penalty : 0;
    const flagged = isPenalty && item.flagged;
    const next: Node[] = [];
    const best: (Node | null)[] = [null, null, null, null];

    for (const node of active) {
      const ratio = ratioFor(node, index, item);
      const keep = !(ratio < -1 || cost === -INFINITY);
      if (keep) next.push(node);
      if (ratio < -1 || ratio > tolerance) continue;

      const badness = 100 * Math.abs(ratio) ** 3;
      let demerits: number;
      if (cost >= 0) demerits = (linePenalty + badness) ** 2 + cost ** 2;
      else if (cost > -INFINITY) demerits = (linePenalty + badness) ** 2 - cost ** 2;
      else demerits = (linePenalty + badness) ** 2;

      const previousItem = items[node.position];
      if (flagged && previousItem?.type === "penalty" && previousItem.flagged) demerits += flaggedDemerits;

      const fitness = ratio < -0.5 ? 0 : ratio <= 0.5 ? 1 : ratio <= 1 ? 2 : 3;
      if (node.previous !== null && Math.abs(fitness - node.fitness) > 1) demerits += fitnessDemerits;
      demerits += node.demerits;

      const current = best[fitness];
      if (!current || demerits < current.demerits) {
        best[fitness] = {
          position: index,
          line: node.line + 1,
          fitness,
          width: 0,
          stretch: 0,
          shrink: 0,
          demerits,
          ratio,
          previous: node,
        };
      }
    }

    const totals = totalsAfter(index);
    for (const candidate of best) {
      if (!candidate) continue;
      candidate.width = totals.width;
      candidate.stretch = totals.stretch;
      candidate.shrink = totals.shrink;
      next.push(candidate);
    }
    active = next;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.type === "box") {
      sum.width += item.width;
    } else if (item.type === "glue") {
      if (i > 0 && items[i - 1]!.type === "box") consider(i, item);
      sum.width += item.width;
      sum.stretch += item.stretch;
      sum.shrink += item.shrink;
    } else if (item.penalty !== INFINITY && (hyphenate || !item.flagged)) {
      consider(i, item);
    }
    if (active.length === 0) return null;
  }

  let winner: Node | null = null;
  for (const node of active) {
    if (node.position === items.length - 1 && (!winner || node.demerits < winner.demerits)) winner = node;
  }
  if (!winner) return null;

  const breaks: Break[] = [];
  for (let node: Node | null = winner; node && node.previous; node = node.previous) {
    breaks.unshift({ position: node.position, ratio: node.ratio });
  }
  return breaks;
}

/**
 * Sets a paragraph with hyphenation allowed at a normal tolerance, then
 * retries with a loose tolerance as a last resort. (TeX first tries without
 * hyphenation, but on narrow screen columns that tends to accept loose lines
 * that a single hyphen would have fixed.)
 */
export function breakParagraph(items: Item[], lineWidth: number, options: BreakOptions = {}): Break[] | null {
  return (
    breakLines(items, lineWidth, { ...options, tolerance: options.tolerance ?? 2 }) ??
    breakLines(items, lineWidth, { ...options, tolerance: 10 })
  );
}
