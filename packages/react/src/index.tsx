import { createOutput, type Output as OutputHandle, type OutputOptions } from "@output/core";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties } from "react";

export type { OutputOptions, Highlighter } from "@output/core";

export type OutputSource = string | AsyncIterable<string> | ReadableStream<string>;

export interface OutputProps extends OutputOptions {
  /**
   * The markdown to render. Pass the whole message as a string that grows
   * while it streams (the AI SDK and most chat state work this way), or an
   * async iterable or stream of chunks.
   */
  source: OutputSource;
  /**
   * For string sources: true while the message is still being written.
   * The last block settles (and gets typeset) when this turns false.
   */
  streaming?: boolean;
  /** Color scheme. "auto" follows the system. */
  scheme?: "auto" | "light" | "dark";
  className?: string;
  style?: CSSProperties;
  /** Called once an iterable or stream source finishes. */
  onDone?: () => void;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Renders model output with reading-quality typography.
 *
 * ```tsx
 * <Output source={message.text} streaming={status === "streaming"} />
 * ```
 */
export const Output = forwardRef<OutputHandle | null, OutputProps>(function Output(
  { source, streaming = false, scheme = "auto", className, style, onDone, theme, justify, hyphenate, highlight, lang, minJustifyWidth },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<OutputHandle | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useIsoLayoutEffect(() => {
    const handle = createOutput(elementRef.current!, { theme, justify, hyphenate, highlight, lang, minJustifyWidth });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // Options are applied by the effect below; the handle lives for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Declared after the handle is created, so the ref sees it.
  useImperativeHandle(ref, () => handleRef.current!, []);

  useIsoLayoutEffect(() => {
    handleRef.current?.update({ theme, justify, hyphenate, highlight, lang, minJustifyWidth });
  }, [theme, justify, hyphenate, highlight, lang, minJustifyWidth]);

  // String sources: diff against what's already rendered.
  useIsoLayoutEffect(() => {
    if (typeof source !== "string") return;
    handleRef.current?.setText(source, { done: !streaming });
  }, [source, streaming]);

  // Iterable and stream sources: pump chunks until done or replaced.
  useEffect(() => {
    if (typeof source === "string") return;
    const handle = handleRef.current;
    if (!handle) return;
    let cancelled = false;
    handle.reset();
    (async () => {
      const iterable = isReadableStream(source) ? readStream(source) : source;
      for await (const chunk of iterable) {
        if (cancelled) return;
        handle.append(chunk);
      }
      if (!cancelled) {
        handle.end();
        onDoneRef.current?.();
      }
    })().catch((error) => {
      if (!cancelled) console.error("[output] stream failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={style}
      data-ov-scheme={scheme === "auto" ? undefined : scheme}
    />
  );
});

function isReadableStream(value: unknown): value is ReadableStream<string> {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

async function* readStream(stream: ReadableStream<string>): AsyncIterable<string> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
