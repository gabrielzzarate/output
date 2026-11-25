/**
 * Repairs the unfinished tail of a markdown block while it streams, so the
 * reader never sees raw syntax such as a dangling `**` or a half-typed link.
 *
 * Only inline syntax is handled here. Unclosed code fences are already
 * rendered correctly by the block lexer.
 */
export function repairTail(src: string): string {
  let text = src;

  // An image that hasn't finished is dropped entirely; it can't render yet.
  text = text.replace(/!\[[^\]\n]*(\]\([^)\n]*)?$/, "");
  // A link whose URL hasn't finished shows as its text for now.
  text = text.replace(/\[([^\]\n]*)\]\([^)\s\n]*$/, "$1");
  // An opening bracket with no closing bracket yet.
  text = text.replace(/\[([^\]\n]*)$/, "$1");

  const stack: string[] = [];
  const positions: number[] = [];
  let i = 0;
  let inCode = false;
  let codeTicks = 0;
  let codeStart = -1;

  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") {
      let n = 0;
      while (text[i + n] === "`") n++;
      if (!inCode) {
        inCode = true;
        codeTicks = n;
        codeStart = i;
      } else if (n === codeTicks) {
        inCode = false;
      }
      i += n;
      continue;
    }
    if (inCode) {
      i++;
      continue;
    }
    const marker = matchMarker(text, i);
    if (marker) {
      const top = stack[stack.length - 1];
      if (top === marker) {
        stack.pop();
        positions.pop();
      } else {
        stack.push(marker);
        positions.push(i);
      }
      i += marker.length;
      continue;
    }
    i++;
  }

  if (inCode) {
    // A code span that opened at the very end has no content yet.
    if (codeStart + codeTicks >= text.length) return text.slice(0, codeStart).trimEnd() === "" ? "" : text.slice(0, codeStart);
    text += "`".repeat(codeTicks);
  }

  let suffix = "";
  for (let k = stack.length - 1; k >= 0; k--) {
    const marker = stack[k]!;
    const pos = positions[k]!;
    if (pos + marker.length >= text.length) {
      // The marker is the last thing typed: hide it rather than close it.
      text = text.slice(0, pos);
    } else {
      suffix += marker;
    }
  }
  return text + suffix;
}

function matchMarker(text: string, i: number): string | null {
  const two = text.slice(i, i + 2);
  if (two === "**" || two === "~~") {
    return two;
  }
  if (two === "__" && isBoundary(text[i - 1])) return two;
  const ch = text[i];
  if (ch === "*") {
    const prev = text[i - 1];
    const next = text[i + 1];
    // A list bullet or a free-standing asterisk is not emphasis.
    if ((prev === undefined || prev === "\n" || /\s/.test(prev)) && (next === " " || next === undefined && prev !== undefined && /\s/.test(prev))) {
      return null;
    }
    return "*";
  }
  if (ch === "_") {
    // Intraword underscores (snake_case) never open emphasis.
    const prev = text[i - 1];
    const next = text[i + 1];
    if (isBoundary(prev) && next !== undefined && !/\s/.test(next)) return "_";
    if (!isBoundary(prev) && isBoundary(next)) return "_";
    return null;
  }
  return null;
}

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || /[\s\p{P}]/u.test(ch);
}
