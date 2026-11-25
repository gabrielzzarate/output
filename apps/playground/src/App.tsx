import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Output, Turn, type DiffRenderer, type Highlighter, type Part } from "@output/react";
import { samples, tokenize } from "./samples";
import { agentPrompt, finalAgentParts, playAgentTurn } from "./agent";

const AGENT = "agent";

type Scheme = "light" | "dark";

const initialScheme: Scheme =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function App() {
  const [sampleId, setSampleId] = useState(samples[0]!.id);
  const isAgent = sampleId === AGENT;
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0]!;
  const [parts, setParts] = useState<Part[]>(finalAgentParts);
  const [diffRenderer, setDiffRenderer] = useState<DiffRenderer>();
  const signal = useRef({ cancelled: false });
  const [text, setText] = useState(sample.text);
  const [streaming, setStreaming] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [width, setWidth] = useState(640);
  const [theme, setTheme] = useState<"reader" | "compact">("reader");
  const [justify, setJustify] = useState(true);
  const [compare, setCompare] = useState(true);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);
  const [highlight, setHighlight] = useState<Highlighter>();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme;
  }, [scheme]);

  // Shiki loads after first paint and never blocks text.
  useEffect(() => {
    let cancelled = false;
    import("@output/core/shiki")
      .then(({ createShikiHighlighter }) => createShikiHighlighter())
      .then((h) => !cancelled && setHighlight(() => h));
    // Pierre's diff renderer loads lazily too.
    import("@output/core/diffs").then(({ createPierreDiffRenderer }) => !cancelled && setDiffRenderer(() => createPierreDiffRenderer()));
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    signal.current.cancelled = true;
  };

  const playAgent = () => {
    stop();
    const token = { cancelled: false };
    signal.current = token;
    setStreaming(true);
    setParts([]);
    playAgentTurn((p, live) => {
      setParts(p);
      setStreaming(live);
    }, speed, token).finally(() => !token.cancelled && setStreaming(false));
  };

  const play = (source = sample.text) => {
    stop();
    const tokens = tokenize(source);
    let i = 0;
    setText("");
    setStreaming(true);
    const tick = 1000 / 30;
    timer.current = setInterval(() => {
      const perTick = Math.max(1, Math.round((speed * tick) / 1000 + (Math.random() - 0.5) * 2));
      i = Math.min(tokens.length, i + perTick);
      setText(tokens.slice(0, i).join(""));
      if (i >= tokens.length) {
        stop();
        setStreaming(false);
      }
    }, tick);
  };

  useEffect(() => stop, []);

  const choose = (id: string) => {
    stop();
    setSampleId(id);
    setStreaming(false);
    if (id === AGENT) {
      setParts(finalAgentParts());
      return;
    }
    const next = samples.find((s) => s.id === id)!;
    setText(next.text);
  };

  return (
    <div className="pg">
      <header className="pg-bar">
        <div className="pg-brand">
          <span className="pg-mark" aria-hidden="true">¶</span>
          <span>output</span>
          <span className="pg-sub">playground</span>
        </div>
        <div className="pg-controls">
          <div className="pg-seg" role="group" aria-label="Sample">
            {samples.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === sampleId} onClick={() => choose(s.id)}>
                {s.label}
              </button>
            ))}
            <button type="button" aria-pressed={isAgent} onClick={() => choose(AGENT)}>
              Agent turn
            </button>
          </div>
          <button type="button" className="pg-primary" onClick={() => (streaming ? (stop(), setStreaming(false)) : isAgent ? playAgent() : play())}>
            {streaming ? "Stop" : "Stream it"}
          </button>
        </div>
      </header>

      <div className="pg-settings">
        <label>
          <span>Speed</span>
          <input type="range" id="speed" min={10} max={300} step={10} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          <output>{speed} tok/s</output>
        </label>
        <label>
          <span>Column</span>
          <input type="range" id="width" min={300} max={820} step={10} value={width} onChange={(e) => setWidth(+e.target.value)} />
          <output>{width}px</output>
        </label>
        <div className="pg-seg" role="group" aria-label="Theme">
          {(["reader", "compact"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === "reader" ? "Reader" : "Compact"}
            </button>
          ))}
        </div>
        <label className="pg-check">
          <input type="checkbox" id="justify" checked={justify} onChange={(e) => setJustify(e.target.checked)} />
          <span>Justify</span>
        </label>
        <label className="pg-check">
          <input type="checkbox" id="compare" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          <span>Compare</span>
        </label>
        <button type="button" className="pg-ghost" onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}>
          {scheme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      <p className="pg-prompt">
        <span>Prompt</span> {isAgent ? agentPrompt : sample.prompt}
      </p>

      <main className={compare ? "pg-panes" : "pg-panes pg-single"}>
        <section className="pg-pane" aria-label="Rendered with output">
          <h2 className="pg-label">output</h2>
          <div className="pg-col" style={{ width: `min(100%, ${width}px)` }}>
            {isAgent ? (
              <Turn
                parts={parts}
                streaming={streaming}
                theme={theme}
                justify={justify ? "auto" : false}
                scheme={scheme}
                highlight={highlight}
                diff={diffRenderer}
              />
            ) : (
              <Output
                source={text}
                streaming={streaming}
                theme={theme}
                justify={justify ? "auto" : false}
                scheme={scheme}
                highlight={highlight}
                diff={diffRenderer}
              />
            )}
          </div>
        </section>
        {compare && (
          <section className="pg-pane pg-pane-stock" aria-label="Rendered with react-markdown">
            <h2 className="pg-label">react-markdown, typical chat styles</h2>
            <div className="pg-col stock" style={{ width: `min(100%, ${width}px)` }}>
              {isAgent ? <StockTurn parts={parts} /> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/** How many chat UIs show an agent turn today: raw tool calls and plain markdown. */
function StockTurn({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "text") return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown>;
        if (p.type === "reasoning") return <p key={i} className="stock-reasoning">{p.text}</p>;
        if (p.type === "tool")
          return (
            <pre key={i} className="stock-tool">
              {`${p.name}(${JSON.stringify(p.input)})${p.state === "done" ? " ✓" : " …"}`}
            </pre>
          );
        return null;
      })}
    </>
  );
}
