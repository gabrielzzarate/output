import { normalizeParts, type DiffPart, type OutputOptions, type Part, type ReasoningPart, type TextPart, type ToolCallViewOptions, type ToolPart } from "@output/core";
import { useMemo, type ComponentType, type CSSProperties } from "react";
import { Output } from "./index";
import { Diff, Reasoning, ToolCall } from "./views";

export interface TurnComponents {
  Text?: ComponentType<{ part: TextPart; streaming: boolean; options: OutputOptions }>;
  Reasoning?: ComponentType<{ part: ReasoningPart; streaming: boolean; options: OutputOptions }>;
  ToolCall?: ComponentType<{ call: ToolPart; options: OutputOptions }>;
  Diff?: ComponentType<{ part: DiffPart; settled: boolean; options: OutputOptions }>;
}

export interface TurnProps extends OutputOptions {
  /** The message's parts: this library's, or AI SDK UI message parts as-is. */
  parts: readonly unknown[];
  /** True while the message is still being written. */
  streaming?: boolean;
  scheme?: "auto" | "light" | "dark";
  /** Replace how any kind of part renders. */
  components?: TurnComponents;
  /** Labels and one-line summaries for tool calls. */
  tools?: Pick<ToolCallViewOptions, "label" | "summarize">;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a whole assistant turn: text, reasoning, tool calls, and diffs.
 *
 * ```tsx
 * <Turn parts={message.parts} streaming={status === "streaming"} />
 * ```
 */
export function Turn({ parts, streaming = false, scheme = "auto", components = {}, tools, className, style, ...options }: TurnProps) {
  const normalized = useMemo(() => normalizeParts(parts), [parts]);
  const { theme = "reader" } = options;

  return (
    <div
      className={["ov-turn", className].filter(Boolean).join(" ")}
      style={style}
      data-ov-theme={theme}
      data-ov-scheme={scheme === "auto" ? undefined : scheme}
    >
      {normalized.map((part, index) => {
        const key = `${part.type}:${part.id ?? index}`;
        const isLast = index === normalized.length - 1;
        const live = (p: Part) => ("state" in p && p.state === "streaming") || (!("state" in p && p.state) && streaming && isLast);
        switch (part.type) {
          case "text": {
            const isLive = live(part);
            return components.Text ? (
              <components.Text key={key} part={part} streaming={isLive} options={options} />
            ) : (
              <Output key={key} source={part.text} streaming={isLive} {...options} />
            );
          }
          case "reasoning": {
            const isLive = live(part);
            return components.Reasoning ? (
              <components.Reasoning key={key} part={part} streaming={isLive} options={options} />
            ) : (
              <Reasoning key={key} part={part} streaming={isLive} {...options} />
            );
          }
          case "tool":
            return components.ToolCall ? (
              <components.ToolCall key={key} call={part} options={options} />
            ) : (
              <ToolCall key={key} call={part} diff={options.diff} highlight={options.highlight} {...tools} />
            );
          case "diff": {
            const settled = !(streaming && isLast);
            return components.Diff ? (
              <components.Diff key={key} part={part} settled={settled} options={options} />
            ) : (
              <Diff key={key} diff={part.diff} settled={settled} renderer={options.diff} />
            );
          }
        }
      })}
    </div>
  );
}
