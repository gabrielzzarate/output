import { isPatch } from "../diff/patch";
import type { DiffInput } from "../diff/types";
import type { ToolPart } from "../parts/types";

/**
 * Finds an edit inside a tool call so it can be shown as a diff. Recognises
 * the common shapes coding agents use: old/new string replacement, whole-file
 * writes, and unified patches in the input or output.
 */
export function diffFromToolCall(call: ToolPart): DiffInput | null {
  const input = asRecord(call.input);
  if (input) {
    const path = str(input.file_path) ?? str(input.filePath) ?? str(input.path) ?? str(input.file) ?? "file";
    const oldText = str(input.old_string) ?? str(input.oldString) ?? str(input.old_str) ?? str(input.search);
    const newText = str(input.new_string) ?? str(input.newString) ?? str(input.new_str) ?? str(input.replace);
    if (oldText !== undefined && newText !== undefined) {
      return { oldFile: { name: path, contents: oldText }, newFile: { name: path, contents: newText } };
    }
    const content = str(input.content) ?? str(input.contents) ?? str(input.file_text);
    if (content !== undefined && /write|create/i.test(call.name)) {
      return { oldFile: null, newFile: { name: path, contents: content } };
    }
    for (const key of ["patch", "diff"]) {
      const v = str(input[key]);
      if (v && isPatch(v)) return { patch: v };
    }
  }
  const output = typeof call.output === "string" ? call.output : str(asRecord(call.output)?.diff) ?? str(asRecord(call.output)?.patch);
  if (output && isPatch(output)) return { patch: output };
  return null;
}

/** One short line describing what a tool call is acting on. */
export function summarizeToolInput(input: unknown): string {
  if (typeof input === "string") return firstLine(input);
  const record = asRecord(input);
  if (!record) return input === undefined ? "" : firstLine(JSON.stringify(input));
  for (const key of ["command", "cmd", "file_path", "filePath", "path", "file", "url", "query", "pattern", "q", "name"]) {
    const v = str(record[key]);
    if (v) return firstLine(v);
  }
  const firstString = Object.values(record).find((v): v is string => typeof v === "string" && v.length > 0);
  return firstString ? firstLine(firstString) : firstLine(JSON.stringify(record));
}

function firstLine(s: string): string {
  const line = s.split("\n")[0] ?? "";
  return line.length > 120 ? line.slice(0, 119) + "…" : line;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
