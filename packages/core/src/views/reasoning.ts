import { createOutput, type Output } from "../output";
import type { ReasoningPart } from "../parts/types";
import type { OutputOptions } from "../types";
import { formatDuration } from "./tool-call";

export interface ReasoningView {
  readonly element: HTMLElement;
  update(part: ReasoningPart, streaming: boolean): void;
  destroy(): void;
}

/**
 * The model's thinking, set in a quieter voice. It stays open while the
 * model thinks and folds away when it's done, unless the reader opened or
 * closed it themselves.
 */
export function createReasoningView(options: OutputOptions = {}): ReasoningView {
  const details = document.createElement("details");
  details.className = "ov-reasoning";
  details.innerHTML = `<summary><span class="ov-reasoning-label"></span></summary><div class="ov-reasoning-body"></div>`;
  const label = details.querySelector<HTMLElement>(".ov-reasoning-label")!;
  const body = details.querySelector<HTMLElement>(".ov-reasoning-body")!;
  const output: Output = createOutput(body, { ...options, justify: false, highlight: options.highlight });
  let touched = false;
  let programmatic = false;
  let startedAt: number | null = null;
  let measured: number | null = null;
  let wasStreaming: boolean | null = null;

  details.addEventListener("toggle", () => {
    if (!programmatic) touched = true;
    programmatic = false;
  });
  const setOpen = (open: boolean) => {
    if (details.open === open || touched) return;
    programmatic = true;
    details.open = open;
  };

  return {
    element: details,
    update(part, streaming) {
      if (streaming && startedAt === null) startedAt = Date.now();
      if (!streaming && startedAt !== null && measured === null) measured = Date.now() - startedAt;
      details.dataset.ovState = streaming ? "streaming" : "done";
      const ms = part.durationMs ?? measured;
      label.textContent = streaming ? "Thinking" : ms != null ? `Thought for ${formatDuration(ms)}` : "Thoughts";
      if (wasStreaming !== streaming) setOpen(streaming);
      wasStreaming = streaming;
      output.setText(part.text, { done: !streaming });
    },
    destroy() {
      output.destroy();
      details.remove();
    },
  };
}
