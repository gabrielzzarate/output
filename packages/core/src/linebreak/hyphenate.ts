import { hyphenateSync } from "hyphen/en";

/** Splits a word into the fragments it may be hyphenated between. */
export type Hyphenator = (word: string) => string[];

const SOFT_HYPHEN = "­";

/**
 * English hyphenation using Liang's patterns (the ones TeX uses), with TeX's
 * English minimums: at least two letters before a break and three after.
 */
export function createHyphenator(
  hyphenate: (word: string) => string = (w) => hyphenateSync(w),
  leftMin = 2,
  rightMin = 3,
): Hyphenator {
  const cache = new Map<string, string[]>();
  return (word) => {
    const cached = cache.get(word);
    if (cached) return cached;
    let parts = [word];
    if (isHyphenatable(word)) {
      parts = hyphenate(word).split(SOFT_HYPHEN).filter(Boolean);
      parts = enforceMinimums(parts, leftMin, rightMin);
    }
    if (cache.size > 5000) cache.clear();
    cache.set(word, parts);
    return parts;
  };
}

export const englishHyphenator: Hyphenator = createHyphenator();

function isHyphenatable(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  if (letters.length < 6) return false;
  // Leave URLs, paths, identifiers, numbers, and acronyms alone.
  if (/[\d/@.:_\\=<>{}[\]#]/.test(word.replace(/[.,;:!?)"'”’]+$/u, ""))) return false;
  if (/\p{Ll}\p{Lu}/u.test(word)) return false;
  if (letters === letters.toUpperCase()) return false;
  return true;
}

function enforceMinimums(parts: string[], leftMin: number, rightMin: number): string[] {
  const out = [...parts];
  while (out.length > 1 && letterCount(out[0]!) < leftMin) out.splice(0, 2, out[0]! + out[1]!);
  while (out.length > 1 && letterCount(out[out.length - 1]!) < rightMin) {
    const last = out.pop()!;
    out[out.length - 1] += last;
  }
  return out;
}

function letterCount(s: string): number {
  return s.replace(/[^\p{L}]/gu, "").length;
}
