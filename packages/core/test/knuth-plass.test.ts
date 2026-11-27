import { describe, expect, it } from "vitest";
import { box, breakLines, breakParagraph, glue, penalty, type Item } from "../src/linebreak/knuth-plass";

// Monospace model: each character is 1 unit, a space is 1 unit.
function paragraph(text: string): Item[] {
  const items: Item[] = [];
  text.split(" ").forEach((word, i) => {
    if (i > 0) items.push(glue(1, 0.5, 0.33));
    items.push(box(word.length));
  });
  items.push(glue(0, 10000, 0), penalty(0, -10000, true));
  return items;
}

function lines(items: Item[], text: string, breaks: { position: number }[]) {
  const words = text.split(" ");
  const out: string[] = [];
  let current: string[] = [];
  let w = 0;
  items.forEach((item, i) => {
    if (item.type === "box") current.push(words[w++]!);
    if (breaks.some((b) => b.position === i)) {
      out.push(current.join(" "));
      current = [];
    }
  });
  return out;
}

describe("breakLines", () => {
  const text = "the quick brown fox jumps over the lazy dog and keeps running far away";

  it("breaks into lines that fit", () => {
    const items = paragraph(text);
    const breaks = breakParagraph(items, 20)!;
    expect(breaks).not.toBeNull();
    for (const l of lines(items, text, breaks)) expect(l.length).toBeLessThanOrEqual(20 + 3);
    expect(breaks[breaks.length - 1]!.position).toBe(items.length - 1);
  });

  it("keeps every non-final line within tolerance", () => {
    const items = paragraph(text);
    const breaks = breakLines(items, 20, { tolerance: 10 })!;
    for (const b of breaks.slice(0, -1)) {
      expect(b.ratio).toBeGreaterThanOrEqual(-1);
      expect(b.ratio).toBeLessThanOrEqual(10);
    }
  });

  it("returns null when a box is wider than the line", () => {
    expect(breakLines(paragraph("supercalifragilistic word"), 10, { tolerance: 10 })).toBeNull();
  });

  it("evens out lines better than greedy filling", () => {
    // Greedy fills the first line and leaves a very loose second line;
    // optimal breaking balances them.
    const t = "aaaa bb cc ddddd eeeeee";
    const items = paragraph(t);
    const breaks = breakLines(items, 12, { tolerance: 5 })!;
    const worst = Math.max(...breaks.slice(0, -1).map((b) => Math.abs(b.ratio)));
    expect(worst).toBeLessThan(3);
  });

  it("only uses hyphen breaks when allowed", () => {
    // "abc def-|ghij": only a hyphen break makes the first line fit.
    const items: Item[] = [box(3), glue(1, 1, 0.33), box(3), penalty(1, 50, true), box(4), glue(0, 10000, 0), penalty(0, -10000, true)];
    expect(breakLines(items, 8, { tolerance: 2, hyphenate: false })).toBeNull();
    expect(breakLines(items, 8, { tolerance: 2 })?.[0]?.position).toBe(3);
  });
});

import { distributeSlack } from "../src/linebreak/justify";

describe("distributeSlack", () => {
  it("shares slack between word gaps and letters in proportion to their room", () => {
    // 10 gaps × 2px and 100 letters × 0.2px: 20px of room each, so half and half.
    const s = distributeSlack(8, 10, 2, 100, 0.2);
    expect(s.letter).toBeCloseTo(0.04);
    expect(s.word).toBeCloseTo(0.4);
    expect(s.word * 10 + s.letter * 100).toBeCloseTo(8);
  });

  it("puts everything in the gaps when letter spacing is off", () => {
    expect(distributeSlack(6, 3, 2, 40, 0)).toEqual({ word: 2, letter: 0 });
  });

  it("tracks a one-word line, up to the letter limit", () => {
    expect(distributeSlack(1, 0, 2, 10, 0.2).letter).toBeCloseTo(0.1);
    expect(distributeSlack(5, 0, 2, 10, 0.2).letter).toBeCloseTo(0.2);
  });

  it("caps letters at their limit and gives the rest to the gaps", () => {
    const s = distributeSlack(100, 10, 2, 50, 0.2);
    expect(s.letter).toBeCloseTo(0.2);
    expect(s.word * 10 + s.letter * 50).toBeCloseTo(100);
  });
});
