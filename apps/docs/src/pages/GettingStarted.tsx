import { Output } from "@output/react";
import { Callout, Code, Example, H2, Md, PageHeader } from "../components/doc";
import { useReplay } from "../components/replay";
import { skyAnswer } from "../content/samples";
import { useRuntime } from "../runtime";

export function GettingStarted() {
  return (
    <>
      <PageHeader
        eyebrow="Start"
        title="Getting started"
        lede="Install two packages, load three typefaces, and render your first streamed answer. About five minutes."
      />

      <H2>Install</H2>
      <Md>{`
        \`@output/core\` is the framework-free renderer. \`@output/react\` wraps it in components for React 18 and newer. The
        typefaces are not bundled, so you choose how they load. The defaults expect Literata for prose, Inter for interface text,
        and JetBrains Mono for code.
      `}</Md>
      <Code lang="bash">{`
        pnpm add @output/react @output/core
        pnpm add @fontsource-variable/literata @fontsource-variable/inter @fontsource-variable/jetbrains-mono
      `}</Code>

      <H2>Load the styles</H2>
      <Md>{`
        Import the faces once, near the root of your app, followed by the base styles and at least one theme. Literata's optical
        size axis (\`opsz.css\`) is what lets body text and headings each get letterforms drawn for their size.
      `}</Md>
      <Code>{`
        import "@fontsource-variable/literata/opsz.css";
        import "@fontsource-variable/inter";
        import "@fontsource-variable/jetbrains-mono";
        import "@output/core/styles.css";
        import "@output/core/themes/reader.css";
      `}</Code>

      <H2>Render a message</H2>
      <Md>{`
        Pass the message text as \`source\` and say whether it is still streaming. With the AI SDK, or most chat state, the text is
        a string that grows on every render, and that is exactly what \`<Output>\` expects. It works out what is new and appends only
        that.
      `}</Md>
      <FirstExample />
      <Md>{`
        While \`streaming\` is true the last block stays ragged-right and is re-rendered as tokens arrive. Every block above it is
        *settled*: rendered once, then typeset in idle time. When \`streaming\` turns false, the last block settles too.
      `}</Md>

      <H2>Stream from an iterable</H2>
      <Md>{`
        If you hold the stream itself rather than the text so far, pass an async iterable or a \`ReadableStream<string>\`.
        \`onDone\` fires when it finishes.
      `}</Md>
      <Code>{`
        const response = await fetch("/api/answer", { method: "POST", body });
        const stream = response.body!.pipeThrough(new TextDecoderStream());

        <Output source={stream} onDone={() => setFinished(true)} />;
      `}</Code>

      <H2>Without React</H2>
      <Md>{`
        \`createOutput\` mounts into any element and gives you a handle to drive it. The React component is a thin layer over
        this.
      `}</Md>
      <Code lang="ts">{`
        import { createOutput } from "@output/core";

        const out = createOutput(document.querySelector("#answer")!, { theme: "reader" });
        for await (const chunk of stream) out.append(chunk);
        out.end();
      `}</Code>

      <H2>Whole agent turns</H2>
      <Md>{`
        When a message carries reasoning and tool calls as well as text, render it with \`<Turn>\`. It takes AI SDK UI message parts
        as they are.
      `}</Md>
      <Code>{`
        import { Turn } from "@output/react";

        <Turn parts={message.parts} streaming={status === "streaming"} />;
      `}</Code>
      <Callout title="Next">{`
        [Agent turns](/docs/agent-turns) covers reasoning, tool calls, and overrides. [Diffs and code](/docs/diffs-and-code) adds
        Shiki highlighting and Pierre's diff renderer, both loaded lazily so they never hold up text.
      `}</Callout>
    </>
  );
}

function FirstExample() {
  const { scheme, highlight } = useRuntime();
  const { text, streaming, play, stop } = useReplay(skyAnswer, 80);
  return (
    <Example
      label="Live"
      title="A streamed answer"
      code={`
        import { useChat } from "@ai-sdk/react";
        import { Output } from "@output/react";

        export function Answer() {
          const { messages, status } = useChat();
          const last = messages.at(-1);
          const text = last?.parts.filter((p) => p.type === "text").map((p) => p.text).join("") ?? "";

          return <Output source={text} streaming={status === "streaming"} />;
        }
      `}
      actions={
        <button type="button" className="doc-btn doc-btn-small" onClick={streaming ? stop : play}>
          {streaming ? "Stop" : "Stream it"}
        </button>
      }
    >
      <div className="example-scroll">
        <Output source={text} streaming={streaming} scheme={scheme} highlight={highlight} />
      </div>
    </Example>
  );
}
