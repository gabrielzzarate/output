import { Callout, Code, Entry, H2, Md, PageHeader, Props, type PropRow } from "../components/doc";

export const optionRows: PropRow[] = [
  { name: "theme", type: `"reader" | "compact" | string`, default: `"reader"`, description: "Sets data-ov-theme on the root. Any name works once you've written CSS for it." },
  { name: "justify", type: `"auto" | boolean`, default: `"auto"`, description: "Optimal justification for settled paragraphs. \"auto\" justifies only when the column is at least minJustifyWidth ems wide." },
  { name: "hyphenate", type: "Hyphenator | false", default: "English", description: "Splits a word into the fragments it may break between. false turns hyphenation off but keeps justification." },
  { name: "highlight", type: "(code, lang) => string | Promise<string>", default: "none", description: "Returns highlighted HTML for the inside of a <code> element. Only settled code blocks are highlighted." },
  { name: "diff", type: "DiffRenderer", default: "built-in view", description: "Renders finished diffs, for example createPierreDiffRenderer() from @output/core/diffs." },
  { name: "lang", type: "string", default: `"en"`, description: "Sets lang on the root, for browser hyphenation and screen readers." },
  { name: "minJustifyWidth", type: "number", default: "22", description: "The narrowest column, in ems, that \"auto\" will justify." },
];

export function ReactApi() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="@output/react"
        lede="Components for React 18 and newer. Each is a thin layer over a view from @output/core."
      />
      <Code lang="ts">{`import { Output, Turn, ToolCall, Reasoning, Diff } from "@output/react";`}</Code>

      <H2>Output</H2>
      <Entry name="<Output>" signature={`<Output source={text} streaming={isStreaming} {...options} />`}>
        <Md>{`Renders markdown from a model with reading-quality typography. Accepts a ref to the underlying [\`Output\` handle](/docs/api/core#createoutput).`}</Md>
        <Props
          rows={[
            { name: "source", type: "string | AsyncIterable<string> | ReadableStream<string>", description: "The markdown. A string can grow on every render; only the new part is appended. A new iterable or stream resets the output." },
            { name: "streaming", type: "boolean", default: "false", description: "For string sources: true while the message is still being written. The last block settles when it turns false." },
            { name: "scheme", type: `"auto" | "light" | "dark"`, default: `"auto"`, description: "Color scheme. \"auto\" follows prefers-color-scheme." },
            { name: "onDone", type: "() => void", description: "Called once an iterable or stream source finishes." },
            { name: "className, style", type: "string, CSSProperties", description: "Applied to the root element." },
            ...optionRows,
          ]}
        />
        <Code>{`
          import type { Output as OutputHandle } from "@output/core";

          const ref = useRef<OutputHandle>(null);

          <Output ref={ref} source={text} />;
          await ref.current?.flush(); // wait for highlighting and justification
        `}</Code>
      </Entry>

      <H2>Turn</H2>
      <Entry name="<Turn>" signature={`<Turn parts={message.parts} streaming={isStreaming} {...options} />`}>
        <Md>{`Renders a whole assistant turn: reasoning, tool calls, diffs, and text, in order. Takes every \`<Output>\` option as well as these.`}</Md>
        <Props
          rows={[
            { name: "parts", type: "readonly unknown[]", description: "The message's parts: this library's Part objects, or AI SDK UI message parts as they are." },
            { name: "streaming", type: "boolean", default: "false", description: "True while the message is still being written. Parts without their own state treat the last part as live." },
            { name: "scheme", type: `"auto" | "light" | "dark"`, default: `"auto"`, description: "Color scheme for every part." },
            { name: "components", type: "TurnComponents", description: "Replace how any kind of part renders. See below." },
            { name: "tools", type: "{ label?, summarize? }", description: "Display names and one-line summaries for tool calls. Return undefined to keep the default." },
            { name: "className, style", type: "string, CSSProperties", description: "Applied to the root element." },
          ]}
        />
      </Entry>
      <Entry
        name="TurnComponents"
        signature={`interface TurnComponents {
  Text?: ComponentType<{ part: TextPart; streaming: boolean; options: OutputOptions }>;
  Reasoning?: ComponentType<{ part: ReasoningPart; streaming: boolean; options: OutputOptions }>;
  ToolCall?: ComponentType<{ call: ToolPart; options: OutputOptions }>;
  Diff?: ComponentType<{ part: DiffPart; settled: boolean; options: OutputOptions }>;
}`}
      >
        <Md>{`Each override receives the normalized part and the turn's options, so it can fall back to the built-in component for the cases it doesn't handle.`}</Md>
      </Entry>

      <H2>Parts on their own</H2>
      <Md>{`\`<Turn>\` is built from these. Use them directly to place a tool call or a diff anywhere in your own layout. Wrap them in an element with the \`ov-turn\` class (or render them inside a \`<Turn>\`) so they pick up the theme.`}</Md>
      <Entry name="<ToolCall>" signature={`<ToolCall call={toolPart} diff={diff} highlight={highlight} label={fn} summarize={fn} />`}>
        <Md>{`A compact, expandable row for one tool call. Edits are shown as a diff under the row.`}</Md>
        <Props
          rows={[
            { name: "call", type: "ToolPart", description: "The call to show. Update it in place as its state changes." },
            { name: "diff", type: "DiffRenderer", description: "Renderer for recognised edits." },
            { name: "highlight", type: "Highlighter", description: "Highlights input and output when they are code." },
            { name: "label", type: "(call) => string | undefined", description: "Display name. Defaults to a humanized tool name." },
            { name: "summarize", type: "(call) => string | undefined", description: "The line shown next to the name. Defaults to the command, path, URL, or query in the input." },
          ]}
        />
      </Entry>
      <Entry name="<Reasoning>" signature={`<Reasoning part={reasoningPart} streaming={isThinking} {...options} />`}>
        <Md>{`The model's thinking: open while it streams, then folded into "Thought for 6.4s". Takes \`<Output>\` options for the text inside.`}</Md>
      </Entry>
      <Entry name="<Diff>" signature={`<Diff diff={{ patch }} settled renderer={diff} />`}>
        <Md>{`A diff with a file header and change counts.`}</Md>
        <Props
          rows={[
            { name: "diff", type: "DiffInput", description: "{ patch } with a unified diff, or { oldFile, newFile } with { name, contents } for each side. Either side may be null for created or deleted files." },
            { name: "settled", type: "boolean", default: "true", description: "False while the diff is still streaming. Live diffs use the built-in view." },
            { name: "renderer", type: "DiffRenderer", default: "built-in view", description: "Draws settled diffs." },
          ]}
        />
      </Entry>
      <Callout title="Server rendering">{`
        The components render an empty root on the server and fill it on the client, since typesetting needs real font
        measurements. Reserve height if layout shift matters, or render the finished text yourself for crawlers.
      `}</Callout>
    </>
  );
}
