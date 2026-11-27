import { Turn, type ToolPart } from "@output/react";
import { Code, Example, H2, Md, PageHeader } from "../components/doc";
import { useAgentReplay } from "../components/replay";
import { useRuntime } from "../runtime";

export function AgentTurns() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="Agent turns"
        lede="Reasoning, tool calls, edits, and the answer, rendered as one piece of writing in one type system."
      />
      <TurnExample />

      <H2>Parts</H2>
      <Md>{`
        \`<Turn>\` takes the message's parts and renders each in order. It accepts the Vercel AI SDK's UI message parts as they are
        (\`text\`, \`reasoning\`, \`tool-*\`, and \`dynamic-tool\`), or this library's own simpler shapes. Unknown part types, such as
        step boundaries or sources, are skipped.
      `}</Md>
      <Code>{`
        // AI SDK
        <Turn parts={message.parts} streaming={status === "streaming"} />

        // Your own harness
        <Turn
          streaming
          parts={[
            { type: "reasoning", text: "Read the helper first…", state: "done", durationMs: 6400 },
            { type: "tool", id: "t1", name: "read_file", state: "done", input: { path: "src/net/retry.ts" }, output },
            { type: "text", text: answerSoFar, state: "streaming" },
          ]}
        />
      `}</Code>
      <Md>{`
        A part with its own \`state\` uses it. A part without one is treated as live only when it is the last part and the turn is
        streaming. See [Part types](/docs/api/core#part-types) for every field.
      `}</Md>

      <H2>Reasoning</H2>
      <Md>{`
        Reasoning stays open while the model thinks, set a step quieter than the answer. When thinking ends it folds into a single
        line, such as "Thought for 6.4s". Pass \`durationMs\` if you know it; otherwise it is measured from when the part first
        appeared to when it finished. If the reader opens or closes it, that choice sticks across updates.
      `}</Md>

      <H2>Tool calls</H2>
      <Md>{`
        Each call is a compact row: a status mark, a readable name (\`read_file\` becomes "Read file"), a one-line summary of what it
        acted on, and how long it took. The row expands to show the input and output, highlighted when they are code.

        Edits are recognised and shown as a diff under the row, since in a coding harness they're the main content. That covers
        \`old_string\`/\`new_string\` replacements (and \`oldString\`, \`old_str\`, \`search\`/\`replace\`), whole-file writes from tools
        whose name contains "write" or "create", and unified patches in the input or output.
      `}</Md>

      <H2>Labels and summaries</H2>
      <Md>{`
        Give tools friendlier names, or say what a call did in your own words. Return \`undefined\` to fall back to the default.
      `}</Md>
      <LabelsExample />

      <H2>Replacing a part's component</H2>
      <Md>{`
        Anything \`<Turn>\` renders can be swapped. Your component receives the normalized part and the turn's options, so a custom
        text renderer can still hand off to \`<Output>\`.
      `}</Md>
      <Code>{`
        import { Turn, Output, type TurnComponents } from "@output/react";

        const components: TurnComponents = {
          ToolCall: ({ call }) =>
            call.name === "web_search" ? <SearchResults query={call.input.query} results={call.output} /> : <ToolCall call={call} />,
          Text: ({ part, streaming, options }) => (
            <div className="answer">
              <Output source={part.text} streaming={streaming} {...options} />
            </div>
          ),
        };

        <Turn parts={message.parts} components={components} />;
      `}</Code>

      <H2>Without React</H2>
      <Code lang="ts">{`
        import { createTurn } from "@output/core";

        const turn = createTurn(el, { theme: "compact", tools: { label: myLabels } });
        onMessageUpdate((message, streaming) => turn.setParts(message.parts, { streaming }));
      `}</Code>
      <Md>{`
        Call \`setParts\` with the full list every time anything changes. Views are keyed by part id, so only what changed is
        updated, and a tool row that the reader expanded stays expanded.
      `}</Md>
    </>
  );
}

function TurnExample() {
  const { scheme, highlight, diff } = useRuntime();
  const agent = useAgentReplay(80);
  return (
    <Example
      label="Live"
      title="A coding agent fixes a race"
      code={`<Turn parts={message.parts} streaming={status === "streaming"} highlight={highlight} diff={diff} />`}
      actions={
        <button type="button" className="doc-btn doc-btn-small" onClick={agent.streaming ? agent.stop : agent.play}>
          {agent.streaming ? "Stop" : "Replay"}
        </button>
      }
    >
      <Turn parts={agent.parts} streaming={agent.streaming} scheme={scheme} highlight={highlight} diff={diff} />
    </Example>
  );
}

const searchParts: ToolPart[] = [
  { type: "tool", id: "s1", name: "web_search", state: "done", input: { query: "Knuth-Plass line breaking" }, output: "8 results", durationMs: 940 },
  { type: "tool", id: "s2", name: "fetch_url", state: "done", input: { url: "https://tug.org/TUGboat/tb21-3/tb68fine.pdf" }, output: "…", durationMs: 1820 },
  { type: "tool", id: "s3", name: "run_sql", state: "running", input: { sql: "select count(*) from sessions where ended_at is null" } },
];

function LabelsExample() {
  const { scheme } = useRuntime();
  return (
    <Example
      label="Live"
      title="Custom labels"
      code={`
        <Turn
          parts={parts}
          tools={{
            label: (call) =>
              ({ web_search: "Searched the web", fetch_url: "Read a page", run_sql: "Querying the database" })[call.name],
            summarize: (call) => (call.name === "fetch_url" ? new URL(call.input.url).hostname : undefined),
          }}
        />
      `}
    >
      <Turn
        parts={searchParts}
        scheme={scheme}
        tools={{
          label: (call) =>
            ({ web_search: "Searched the web", fetch_url: "Read a page", run_sql: "Querying the database" })[call.name],
          summarize: (call) =>
            call.name === "fetch_url" ? new URL((call.input as { url: string }).url).hostname : undefined,
        }}
      />
    </Example>
  );
}
