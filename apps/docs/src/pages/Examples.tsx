import { createOutput, type Output as OutputHandle } from "@output/core";
import { Output, ToolCall, Turn, type TurnComponents } from "@output/react";
import { useEffect, useRef, useState } from "react";
import { Example, PageHeader, Seg } from "../components/doc";
import { useAgentReplay, useReplay } from "../components/replay";
import { readingAnswer, skyAnswer, tokenize } from "../content/samples";
import { useRuntime } from "../runtime";

export function Examples() {
  return (
    <>
      <PageHeader
        eyebrow="Examples"
        title="Examples"
        lede="Live, and editable in your head. Every example replays a recorded model answer through the real components. Open the code to see how each one is built."
      />
      <div className="examples-grid">
        <ChatExample />
        <AgentExample />
        <SidebarExample />
        <VanillaExample />
        <AiSdkExample />
        <OverrideExample />
      </div>
    </>
  );
}

function ChatExample() {
  const { scheme, highlight, diff } = useRuntime();
  const [speed, setSpeed] = useState(70);
  const [theme, setTheme] = useState<"reader" | "compact">("reader");
  const replay = useReplay(readingAnswer, speed);
  return (
    <Example
      wide
      label="Chat"
      title="A long answer, streamed"
      code={`
        <Output
          source={text}
          streaming={status === "streaming"}
          theme="${theme}"
          highlight={highlight}
        />
      `}
      actions={
        <>
          <label className="doc-range">
            <span>Speed</span>
            <input type="range" min={10} max={300} step={10} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
            <output>{speed} tok/s</output>
          </label>
          <Seg
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "reader", label: "Reader" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <button type="button" className="doc-btn doc-btn-small" onClick={replay.streaming ? replay.stop : replay.play}>
            {replay.streaming ? "Stop" : "Stream it"}
          </button>
        </>
      }
    >
      <div className="example-scroll" style={{ maxHeight: 520 }}>
        <Output
          className="keep-measure"
          style={{ margin: "0 auto" }}
          source={replay.text}
          streaming={replay.streaming}
          theme={theme}
          scheme={scheme}
          highlight={highlight}
          diff={diff}
        />
      </div>
    </Example>
  );
}

function AgentExample() {
  const { scheme, highlight, diff } = useRuntime();
  const agent = useAgentReplay(90);
  return (
    <Example
      wide
      label="Agent"
      title="Reasoning, tools, an edit, and the answer"
      code={`<Turn parts={message.parts} streaming={status === "streaming"} highlight={highlight} diff={diff} />`}
      actions={
        <button type="button" className="doc-btn doc-btn-small" onClick={agent.streaming ? agent.stop : agent.play}>
          {agent.streaming ? "Stop" : "Replay"}
        </button>
      }
    >
      <Turn className="keep-measure" style={{ margin: "0 auto" }} parts={agent.parts} streaming={agent.streaming} scheme={scheme} highlight={highlight} diff={diff} />
    </Example>
  );
}

function SidebarExample() {
  const { scheme, highlight, diff } = useRuntime();
  const agent = useAgentReplay(90);
  return (
    <Example
      label="Harness"
      title="Compact theme in a 340px pane"
      code={`<Turn parts={parts} theme="compact" streaming={streaming} />`}
      actions={
        <button type="button" className="doc-btn doc-btn-small" onClick={agent.streaming ? agent.stop : agent.play}>
          {agent.streaming ? "Stop" : "Replay"}
        </button>
      }
    >
      <div className="pane-frame">
        <Turn parts={agent.parts} streaming={agent.streaming} theme="compact" scheme={scheme} highlight={highlight} diff={diff} />
      </div>
    </Example>
  );
}

/** Parts exactly as the AI SDK's useChat hands them over. */
const aiSdkParts = [
  { type: "step-start" },
  { type: "reasoning", text: "The user wants tomorrow's forecast. I'll call the weather tool for Lisbon.", state: "done" },
  {
    type: "tool-get_weather",
    toolCallId: "call_1",
    state: "output-available",
    input: { city: "Lisbon", day: "tomorrow" },
    output: { high: 21, low: 14, sky: "Clear in the morning, cloud building after 3 pm" },
  },
  {
    type: "tool-search_events",
    toolCallId: "call_2",
    state: "output-error",
    input: { query: "open air concerts Lisbon" },
    errorText: "Rate limited. Try again in 30 seconds.",
  },
  {
    type: "text",
    text: "Tomorrow in Lisbon should be **clear in the morning** with a high of 21°C, and cloud building after 3 pm. I couldn't check concert listings just now, but I can try again in a moment.",
    state: "done",
  },
];

function AiSdkExample() {
  const { scheme } = useRuntime();
  return (
    <Example
      wide
      label="AI SDK"
      title="UI message parts, passed as they are"
      code={`
        const { messages } = useChat();

        {messages.map((m) =>
          m.role === "assistant" ? (
            <Turn key={m.id} parts={m.parts} />
          ) : (
            <p key={m.id}>{m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}</p>
          ),
        )}
      `}
    >
      <Turn className="keep-measure" style={{ margin: "0 auto" }} parts={aiSdkParts} scheme={scheme} />
    </Example>
  );
}

function VanillaExample() {
  const host = useRef<HTMLDivElement>(null);
  const out = useRef<OutputHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [running, setRunning] = useState(false);
  const { scheme } = useRuntime();

  useEffect(() => {
    out.current = createOutput(host.current!, { theme: "reader" });
    out.current.setText(skyAnswer.slice(0, skyAnswer.indexOf("\n\n## Why not violet")), { done: true });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      out.current?.destroy();
    };
  }, []);

  const run = () => {
    const o = out.current!;
    if (timer.current) clearTimeout(timer.current);
    o.reset();
    setRunning(true);
    const tokens = tokenize(skyAnswer.slice(0, skyAnswer.indexOf("\n\n## Why not violet")));
    let i = 0;
    const step = () => {
      o.append(tokens.slice(i, i + 3).join(""));
      i += 3;
      if (i < tokens.length) timer.current = setTimeout(step, 30);
      else {
        o.end();
        setRunning(false);
      }
    };
    step();
  };

  return (
    <Example
      label="No framework"
      title="createOutput with append and end"
      code={`
        import { createOutput } from "@output/core";

        const out = createOutput(document.querySelector("#answer"), { theme: "reader" });

        for await (const chunk of stream) out.append(chunk);
        out.end();
      `}
      actions={
        <button type="button" className="doc-btn doc-btn-small" onClick={run} disabled={running}>
          {running ? "Streaming" : "Stream it"}
        </button>
      }
    >
      <div ref={host} data-ov-scheme={scheme} />
    </Example>
  );
}

const searchTurn = [
  {
    type: "tool" as const,
    id: "w1",
    name: "web_search",
    state: "done" as const,
    durationMs: 1210,
    input: { query: "Knuth Plass line breaking paper" },
    output: [
      { title: "Breaking Paragraphs into Lines", site: "Software: Practice and Experience, 1981" },
      { title: "TeX: The Program", site: "Addison-Wesley" },
      { title: "Line breaking in the browser", site: "W3C CSS Text 4 draft" },
    ],
  },
  { type: "tool" as const, id: "w2", name: "read_file", state: "done" as const, durationMs: 80, input: { path: "notes/typesetting.md" }, output: "…" },
  {
    type: "text" as const,
    text: "The original description is Knuth and Plass's 1981 paper. It treats a paragraph as boxes, glue, and penalties, and finds the breaks with the lowest total demerits.",
  },
];

const components: TurnComponents = {
  ToolCall: ({ call }) => {
    if (call.name !== "web_search" || !Array.isArray(call.output)) return <ToolCall call={call} />;
    return (
      <div className="source-cards">
        <p className="source-query">Searched for “{(call.input as { query: string }).query}”</p>
        <div className="source-row">
          {(call.output as { title: string; site: string }[]).map((r) => (
            <div className="source-card" key={r.title}>
              <strong>{r.title}</strong>
              <span>{r.site}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

function OverrideExample() {
  const { scheme } = useRuntime();
  return (
    <Example
      wide
      label="Overrides"
      title="A custom component for one tool"
      code={`
        const components: TurnComponents = {
          ToolCall: ({ call }) =>
            call.name === "web_search" ? <SourceCards call={call} /> : <ToolCall call={call} />,
        };

        <Turn parts={parts} components={components} />;
      `}
    >
      <Turn className="keep-measure" style={{ margin: "0 auto" }} parts={searchTurn} components={components} scheme={scheme} />
    </Example>
  );
}
