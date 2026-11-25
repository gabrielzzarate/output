import { escapeHtml } from "../render/markdown";
import { toPatch } from "./patch";
import type { DiffInput } from "./types";

/**
 * A dependency-free diff view: used while a diff is still streaming, and as
 * the fallback when no diff renderer is configured.
 */
export function renderPlainDiff(input: DiffInput): string {
  const patch = toPatch(input);
  let oldLine = 0;
  let newLine = 0;
  const rows: string[] = [];
  for (const line of patch.replace(/\n$/, "").split("\n")) {
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("diff --git") || line.startsWith("index ")) continue;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      if (rows.length) rows.push(`<tr class="ov-diff-sep"><td colspan="3"></td></tr>`);
      continue;
    }
    const sign = line[0];
    const text = escapeHtml(line.slice(1)) || " ";
    if (sign === "+") rows.push(`<tr class="ov-diff-add"><td class="ov-diff-n"></td><td class="ov-diff-n">${newLine++}</td><td>${text}</td></tr>`);
    else if (sign === "-") rows.push(`<tr class="ov-diff-del"><td class="ov-diff-n">${oldLine++}</td><td class="ov-diff-n"></td><td>${text}</td></tr>`);
    else if (sign === "\\") continue;
    else rows.push(`<tr><td class="ov-diff-n">${oldLine++}</td><td class="ov-diff-n">${newLine++}</td><td>${text}</td></tr>`);
  }
  return `<div class="ov-diff-plain"><table><tbody>${rows.join("")}</tbody></table></div>`;
}
