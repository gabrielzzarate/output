import {
  humanize,
  summarizeToolInput,
  createDiffView,
  createReasoningView,
  createToolCallView,
  type DiffInput,
  type DiffRenderer,
  type Highlighter,
  type OutputOptions,
  type ReasoningPart,
  type ToolCallViewOptions,
  type ToolPart,
} from "@output/core";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Mounts a core view's element inside a `display: contents` host. */
function useCoreView<V extends { element: HTMLElement; destroy(): void }>(create: () => V, deps: unknown[]) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<V | null>(null);
  useIsoLayoutEffect(() => {
    const v = create();
    view.current = v;
    host.current!.appendChild(v.element);
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { host, view };
}

export interface ToolCallProps extends Pick<ToolCallViewOptions, "label" | "summarize"> {
  call: ToolPart;
  diff?: DiffRenderer;
  highlight?: Highlighter;
}

/** One tool call: a compact row that expands, with edits shown as a diff. */
export function ToolCall({ call, diff, highlight, label, summarize }: ToolCallProps) {
  const labelRef = useRef(label);
  const summarizeRef = useRef(summarize);
  labelRef.current = label;
  summarizeRef.current = summarize;
  const { host, view } = useCoreView(
    () =>
      createToolCallView({
        diff,
        highlight,
        label: (c) => labelRef.current?.(c) ?? defaultLabel(c),
        summarize: (c) => summarizeRef.current?.(c) ?? defaultSummary(c),
      }),
    [diff, highlight],
  );
  // Runs after every render (and after a view is recreated); views skip no-op updates.
  useIsoLayoutEffect(() => view.current?.update(call));
  return <div ref={host} style={{ display: "contents" }} />;
}

// Fall back to the core defaults when no override is given.
const defaultLabel = (c: ToolPart) => humanize(c.name);
const defaultSummary = (c: ToolPart) => summarizeToolInput(c.input);

export interface ReasoningProps extends OutputOptions {
  part: ReasoningPart;
  streaming: boolean;
}

/** The model's thinking, open while it streams and folded away after. */
export function Reasoning({ part, streaming, ...options }: ReasoningProps) {
  const { host, view } = useCoreView(() => createReasoningView(options), [options.highlight, options.theme]);
  useIsoLayoutEffect(() => view.current?.update(part, streaming));
  return <div ref={host} style={{ display: "contents" }} />;
}

export interface DiffProps {
  diff: DiffInput;
  /** False while the diff is still streaming. */
  settled?: boolean;
  renderer?: DiffRenderer;
}

/** A diff with a file header and change counts. */
export function Diff({ diff, settled = true, renderer }: DiffProps) {
  const { host, view } = useCoreView(() => createDiffView(renderer), [renderer]);
  useIsoLayoutEffect(() => view.current?.update(diff, { settled }));
  return <div ref={host} style={{ display: "contents" }} />;
}
