import { renderMarkdown } from "@output/core";
import { Output } from "@output/react";
import { useState } from "react";
import { Callout, Code, Example, H2, Md, PageHeader } from "../components/doc";
import { useReplay } from "../components/replay";
import { useRuntime } from "../runtime";

const halfTyped = `The fix is to read **and** write \`state.backoff\` before any \`await\`, as described in the [retry notes](https://example.com/retry). Then every failure claims its own slot, and concurrent retries spread out instead of piling up on the same tick.`;

export function Streaming() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="Streaming"
        lede="How a growing message becomes stable blocks, why nothing jumps under the reader's eye, and how to feed it."
      />

      <H2>Settled and live blocks</H2>
      <Md>{`
        A \`BlockStream\` splits the incoming markdown into blocks: paragraphs, headings, lists, code fences, tables, and quotes.
        Every block except the last is **settled**. A settled block is final, so it is rendered once and never touched again. Only
        the text after the last settled block is lexed again on each update, which keeps the cost of an update flat however long
        the answer grows.

        The last block is **live**. It re-renders as tokens arrive and stays ragged-right, because re-justifying a line on every
        token would make words jump. When the next block begins, or the stream ends, it settles and is queued for typesetting in
        idle time.
      `}</Md>

      <H2>Repairing half-typed markdown</H2>
      <Md>{`
        Mid-stream, the live block is usually broken markdown: an opening \`**\` with no partner, a link whose URL hasn't arrived,
        a code span still open. Rendered as-is, those flash as raw symbols and then snap into formatting. \`repairTail\` closes
        whatever is open before each render, so the reader only ever sees formatted text.
      `}</Md>
      <RepairExample />

      <H2>Three ways to feed it</H2>
      <Md>{`
        **A growing string.** The common case with React state. Pass the full text so far on every render. If it extends what was
        rendered, only the new part is appended. If it doesn't (a regenerated answer, say), the output starts over.
      `}</Md>
      <Code>{`<Output source={text} streaming={status === "streaming"} />`}</Code>
      <Md>{`
        **An async iterable or a \`ReadableStream<string>\`.** \`<Output>\` reads it to the end, then settles. Passing a new stream
        resets the output.
      `}</Md>
      <Code>{`<Output source={streamText({ model, prompt }).textStream} onDone={save} />`}</Code>
      <Md>{`
        **Imperatively.** With \`createOutput\`, call \`append\` for each chunk and \`end\` when you're done. Calls within one frame
        are batched into a single render.
      `}</Md>
      <Code lang="ts">{`
        const out = createOutput(el);
        socket.on("token", (t) => out.append(t));
        socket.on("done", () => out.end());
      `}</Code>

      <H2>Waiting for typesetting</H2>
      <Md>{`
        Justification runs in idle time after a paragraph settles, and highlighting after a code block settles. If you need the
        final layout (to measure it, snapshot it, or scroll to its end), await \`flush()\`.
      `}</Md>
      <Code lang="ts">{`
        out.end();
        await out.flush();
        container.scrollTop = container.scrollHeight;
      `}</Code>
      <Callout title="Scrolling while streaming">{`
        Settled blocks never change height, and the live block only grows. That makes "stick to bottom" scrolling simple: if the
        reader was at the bottom before an update, keep them there after it.
      `}</Callout>
    </>
  );
}

function RepairExample() {
  const { scheme } = useRuntime();
  const slow = useReplay(halfTyped, 12);
  const [repair, setRepair] = useState(true);
  return (
    <Example
      label="Live"
      title="Slow stream, half-typed syntax"
      code={`
        import { repairTail, renderMarkdown } from "@output/core";

        // What <Output> does for the live block on every update:
        const html = renderMarkdown(repairTail(liveBlockSource));
      `}
      actions={
        <>
          <label className="doc-range">
            <input type="checkbox" checked={repair} onChange={(e) => setRepair(e.target.checked)} /> Repair
          </label>
          <button type="button" className="doc-btn doc-btn-small" onClick={slow.streaming ? slow.stop : slow.play}>
            {slow.streaming ? "Stop" : "Stream it"}
          </button>
        </>
      }
    >
      {repair ? (
        <Output source={slow.text} streaming={slow.streaming} scheme={scheme} justify={false} />
      ) : (
        // The same markdown renderer, minus the repair step.
        <div className="ov-output" data-ov-theme="reader" dangerouslySetInnerHTML={{ __html: renderMarkdown(slow.text) }} />
      )}
    </Example>
  );
}
