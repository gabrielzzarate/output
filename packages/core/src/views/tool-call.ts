import type { DiffRenderer, Highlighter } from "../types";
import type { ToolPart } from "../parts/types";
import { escapeHtml } from "../render/markdown";
import { createDiffView, type DiffView } from "./diff-view";
import { diffFromToolCall, summarizeToolInput } from "./tool-diff";

export interface ToolCallViewOptions {
  diff?: DiffRenderer;
  highlight?: Highlighter;
  /** One-line summary shown next to the tool name. */
  summarize?: (call: ToolPart) => string | undefined;
  /** Display name for a tool, for example "Read file" for "read_file". */
  label?: (call: ToolPart) => string | undefined;
}

export interface ToolCallView {
  readonly element: HTMLElement;
  update(call: ToolPart): void;
  destroy(): void;
}

const STATUS_LABEL: Record<ToolPart["state"], string> = {
  pending: "Preparing",
  running: "Running",
  done: "Done",
  error: "Failed",
};

/**
 * A compact row for one tool call: status, name, what it acted on, and how
 * long it took. Expands to show the input and output. Edits are shown as a
 * diff under the row, since in a coding harness they're the main content.
 */
export function createToolCallView(options: ToolCallViewOptions = {}): ToolCallView {
  const root = document.createElement("div");
  root.className = "ov-tool";
  root.innerHTML =
    `<details class="ov-tool-details"><summary class="ov-tool-row">` +
    `<span class="ov-tool-status" aria-hidden="true"></span>` +
    `<span class="ov-tool-name"></span><span class="ov-tool-arg"></span>` +
    `<span class="ov-tool-meta"></span><span class="ov-tool-chevron" aria-hidden="true"></span>` +
    `</summary><div class="ov-tool-detail"></div></details>`;
  const details = root.querySelector("details")!;
  const status = root.querySelector<HTMLElement>(".ov-tool-status")!;
  const name = root.querySelector<HTMLElement>(".ov-tool-name")!;
  const arg = root.querySelector<HTMLElement>(".ov-tool-arg")!;
  const meta = root.querySelector<HTMLElement>(".ov-tool-meta")!;
  const detail = root.querySelector<HTMLElement>(".ov-tool-detail")!;
  let diffView: DiffView | null = null;
  let startedAt: number | null = null;
  let finishedMs: number | null = null;
  let current: ToolPart | null = null;
  let detailKey = "";

  const renderDetail = () => {
    if (!current || !details.open) return;
    const key = JSON.stringify([current.input, current.output, current.error]);
    if (key === detailKey) return;
    detailKey = key;
    const sections: string[] = [];
    if (current.input !== undefined) sections.push(section("Input", current.input));
    if (current.error) sections.push(`<section class="ov-tool-section ov-tool-error"><h4>Error</h4><pre>${escapeHtml(current.error)}</pre></section>`);
    else if (current.output !== undefined) sections.push(section("Output", current.output));
    detail.innerHTML = sections.join("") || `<p class="ov-tool-empty">No details yet.</p>`;
    if (options.highlight) {
      for (const code of detail.querySelectorAll<HTMLElement>("code[data-ov-json]")) {
        const source = code.textContent ?? "";
        Promise.resolve(options.highlight(source, "json")).then(
          (html) => code.isConnected !== false && (code.innerHTML = html),
          () => {},
        );
      }
    }
  };
  details.addEventListener("toggle", renderDetail);

  return {
    element: root,
    update(call) {
      current = call;
      root.dataset.ovState = call.state;
      status.dataset.ovState = call.state;
      status.title = STATUS_LABEL[call.state];
      name.textContent = options.label?.(call) ?? humanize(call.name);
      arg.textContent = options.summarize?.(call) ?? summarizeToolInput(call.input);

      if ((call.state === "pending" || call.state === "running") && startedAt === null) startedAt = Date.now();
      if ((call.state === "done" || call.state === "error") && finishedMs === null && startedAt !== null) finishedMs = Date.now() - startedAt;
      const ms = call.durationMs ?? finishedMs;
      meta.textContent = call.state === "error" ? "Failed" : ms != null ? formatDuration(ms) : call.state === "done" ? "" : STATUS_LABEL[call.state] + "…";

      const diff = call.input !== undefined ? diffFromToolCall(call) : null;
      if (diff) {
        if (!diffView) {
          diffView = createDiffView(options.diff);
          diffView.element.classList.add("ov-tool-diff");
          root.appendChild(diffView.element);
        }
        diffView.update(diff, { settled: call.state !== "pending" });
      } else if (diffView) {
        diffView.destroy();
        diffView = null;
      }
      renderDetail();
    },
    destroy() {
      diffView?.destroy();
      details.removeEventListener("toggle", renderDetail);
      root.remove();
    },
  };
}

function section(title: string, value: unknown): string {
  if (typeof value === "string") {
    return `<section class="ov-tool-section"><h4>${title}</h4><pre><code>${escapeHtml(value)}</code></pre></section>`;
  }
  const json = JSON.stringify(value, null, 2) ?? String(value);
  return `<section class="ov-tool-section"><h4>${title}</h4><pre><code data-ov-json>${escapeHtml(json)}</code></pre></section>`;
}

/** "read_file" and "readFile" become "Read file". */
export function humanize(name: string): string {
  const words = name
    .replace(/^mcp__[^_]+__/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDuration(ms: number): string {
  if (ms < 50) return "<0.1s";
  const tenths = Math.round(ms / 100);
  if (tenths < 100) return `${(tenths / 10).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
