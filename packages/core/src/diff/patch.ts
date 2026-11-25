import type { DiffInput } from "./types";

/** True when the text looks like a unified diff rather than arbitrary code. */
export function isPatch(text: string): boolean {
  return /^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/m.test(text) || (/^--- \S/m.test(text) && /^\+\+\+ \S/m.test(text));
}

export type PatchLine =
  | { kind: "file"; side: "old" | "new"; name: string }
  | { kind: "hunk"; oldStart: number; newStart: number }
  | { kind: "line"; sign: " " | "+" | "-"; text: string };

/**
 * Reads a unified patch line by line. `---` and `+++` count as file headers
 * only between hunks: inside a hunk, the header's line counts decide where
 * it ends, so a removed line that reads "-- comment" stays a removed line.
 */
export function* readPatch(patch: string): Generator<PatchLine> {
  let oldLeft = 0;
  let newLeft = 0;
  for (const line of patch.replace(/\n$/, "").split("\n")) {
    if (oldLeft > 0 || newLeft > 0) {
      const sign = line[0];
      if (sign === "\\") continue;
      if (sign === "+") newLeft--;
      else if (sign === "-") oldLeft--;
      else {
        oldLeft--;
        newLeft--;
      }
      yield { kind: "line", sign: sign === "+" || sign === "-" ? sign : " ", text: line.slice(1) };
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = hunk[2] === undefined ? 1 : Number(hunk[2]);
      newLeft = hunk[4] === undefined ? 1 : Number(hunk[4]);
      yield { kind: "hunk", oldStart: Number(hunk[1]), newStart: Number(hunk[3]) };
    } else if (line.startsWith("--- ")) {
      yield { kind: "file", side: "old", name: line.slice(4).replace(/^a\//, "").replace(/\t.*$/, "").trim() };
    } else if (line.startsWith("+++ ")) {
      yield { kind: "file", side: "new", name: line.slice(4).replace(/^b\//, "").replace(/\t.*$/, "").trim() };
    }
  }
}

/** Counts added and removed lines. */
export function diffStats(input: DiffInput): { additions: number; deletions: number; name: string } {
  if ("patch" in input) {
    let additions = 0;
    let deletions = 0;
    let oldName = "";
    let newName = "";
    for (const entry of readPatch(input.patch)) {
      if (entry.kind === "file") {
        if (entry.side === "old") oldName ||= entry.name;
        else newName ||= entry.name;
      } else if (entry.kind === "line") {
        if (entry.sign === "+") additions++;
        else if (entry.sign === "-") deletions++;
      }
    }
    const name = newName && newName !== "/dev/null" ? newName : oldName !== "/dev/null" ? oldName : "";
    return { additions, deletions, name };
  }
  const split = (f: { contents: string } | null) => (f?.contents ? trimFinalNewline(f.contents).split("\n") : []);
  const { additions, deletions } = lineDiffCounts(split(input.oldFile), split(input.newFile));
  return { additions, deletions, name: input.newFile?.name ?? input.oldFile?.name ?? "" };
}

/**
 * Builds a unified patch from two versions of a file, so the plain renderer
 * and the stats can treat every diff the same way. Uses an LCS over lines,
 * which is fine for the snippet-sized edits tool calls produce.
 */
export function toPatch(input: DiffInput, context = 3): string {
  if ("patch" in input) return input.patch;
  const name = input.newFile?.name ?? input.oldFile?.name ?? "file";
  const a = input.oldFile?.contents ? trimFinalNewline(input.oldFile.contents).split("\n") : [];
  const b = input.newFile?.contents ? trimFinalNewline(input.newFile.contents).split("\n") : [];
  const ops = lineOps(a, b);
  const lines: string[] = [`--- ${input.oldFile ? `a/${name}` : "/dev/null"}`, `+++ ${input.newFile ? `b/${name}` : "/dev/null"}`];
  // Group changes into hunks with `context` unchanged lines around each.
  const changes = ops.flatMap((o, i) => (o.op === " " ? [] : [i]));
  let k = 0;
  while (k < changes.length) {
    const start = Math.max(0, changes[k]! - context);
    let end = Math.min(ops.length, changes[k]! + context + 1);
    while (k + 1 < changes.length && changes[k + 1]! - context <= end) {
      k++;
      end = Math.min(ops.length, changes[k]! + context + 1);
    }
    k++;
    const hunk = ops.slice(start, end);
    const oldCount = hunk.filter((o) => o.op !== "+").length;
    const newCount = hunk.filter((o) => o.op !== "-").length;
    const oldStart = oldCount ? hunk[0]!.a + 1 : hunk[0]!.a;
    const newStart = newCount ? hunk[0]!.b + 1 : hunk[0]!.b;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const o of hunk) lines.push(o.op + o.text);
  }
  return lines.join("\n") + "\n";
}

function trimFinalNewline(s: string): string {
  return s.endsWith("\n") ? s.slice(0, -1) : s;
}

interface Op {
  op: " " | "+" | "-";
  text: string;
  /** Index in the old file of this line, or of the next old line for an insertion. */
  a: number;
  b: number;
}

function lineOps(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // Guard against quadratic blowups on large files: fall back to replace-all.
  if (n * m > 4_000_000) {
    return [...a.map((text, i) => ({ op: "-" as const, text, a: i, b: 0 })), ...b.map((text, j) => ({ op: "+" as const, text, a: n, b: j }))];
  }
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push({ op: " ", text: a[i]!, a: i++, b: j++ });
    else if (j < m && (i >= n || dp[i]![j + 1]! > dp[i + 1]![j]!)) ops.push({ op: "+", text: b[j]!, a: i, b: j++ });
    else ops.push({ op: "-", text: a[i]!, a: i++, b: j });
  }
  return ops;
}

function lineDiffCounts(a: string[], b: string[]) {
  const ops = lineOps(a, b);
  return { additions: ops.filter((o) => o.op === "+").length, deletions: ops.filter((o) => o.op === "-").length };
}
