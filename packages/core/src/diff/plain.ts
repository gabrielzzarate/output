import { escapeHtml } from "../render/markdown";
import { readPatch, toPatch } from "./patch";
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
  for (const entry of readPatch(patch)) {
    if (entry.kind === "hunk") {
      if (rows.length) rows.push(`<tr class="ov-diff-sep"><td colspan="3"></td></tr>`);
      oldLine = entry.oldStart;
      newLine = entry.newStart;
    } else if (entry.kind === "line") {
      const text = escapeHtml(entry.text) || " ";
      if (entry.sign === "+") rows.push(`<tr class="ov-diff-add"><td class="ov-diff-n"></td><td class="ov-diff-n">${newLine++}</td><td>${text}</td></tr>`);
      else if (entry.sign === "-") rows.push(`<tr class="ov-diff-del"><td class="ov-diff-n">${oldLine++}</td><td class="ov-diff-n"></td><td>${text}</td></tr>`);
      else rows.push(`<tr><td class="ov-diff-n">${oldLine++}</td><td class="ov-diff-n">${newLine++}</td><td>${text}</td></tr>`);
    }
  }
  return `<div class="ov-diff-plain"><table><tbody>${rows.join("")}</tbody></table></div>`;
}
