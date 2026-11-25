import type { DiffInput } from "../diff/types";

export interface TextPart {
  type: "text";
  id?: string;
  text: string;
  /** "streaming" while the text is still arriving. */
  state?: "streaming" | "done";
}

export interface ReasoningPart {
  type: "reasoning";
  id?: string;
  text: string;
  state?: "streaming" | "done";
  /** How long the model thought. Measured automatically if left out. */
  durationMs?: number;
}

export interface ToolPart {
  type: "tool";
  id: string;
  name: string;
  /** "pending" while arguments stream in, "running" once the tool is executing. */
  state: "pending" | "running" | "done" | "error";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export interface DiffPart {
  type: "diff";
  id?: string;
  diff: DiffInput;
}

export type Part = TextPart | ReasoningPart | ToolPart | DiffPart;

/**
 * Accepts this library's parts or Vercel AI SDK UI message parts
 * (`text`, `reasoning`, `tool-*`, `dynamic-tool`) and returns parts this
 * library can render. Unknown part types are skipped.
 */
export function normalizeParts(parts: readonly unknown[]): Part[] {
  const out: Part[] = [];
  for (const raw of parts) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const type = String(p.type ?? "");
    if (type === "text" || type === "reasoning") {
      out.push({
        type,
        id: typeof p.id === "string" ? p.id : undefined,
        text: String(p.text ?? ""),
        state: p.state === "streaming" ? "streaming" : p.state === "done" ? "done" : undefined,
        ...(type === "reasoning" && typeof p.durationMs === "number" ? { durationMs: p.durationMs } : {}),
      } as TextPart | ReasoningPart);
    } else if (type === "diff" && p.diff) {
      out.push(p as unknown as DiffPart);
    } else if (type === "tool") {
      out.push(p as unknown as ToolPart);
    } else if (type.startsWith("tool-") || type === "dynamic-tool") {
      const name = type === "dynamic-tool" ? String(p.toolName ?? "tool") : type.slice(5);
      out.push({
        type: "tool",
        id: String(p.toolCallId ?? p.id ?? name),
        name,
        state: aiSdkState(p.state),
        input: p.input,
        output: p.output,
        error: typeof p.errorText === "string" ? p.errorText : undefined,
      });
    }
  }
  return out;
}

function aiSdkState(state: unknown): ToolPart["state"] {
  switch (state) {
    case "input-streaming":
      return "pending";
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      return "running";
    case "output-error":
    case "output-denied":
      return "error";
    case "output-available":
      return "done";
    default:
      return "running";
  }
}
