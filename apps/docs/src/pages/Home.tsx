import { Diff, Output, Turn } from "@output/react";
import { useState } from "react";
import { Code, Md, Seg } from "../components/doc";
import { useAgentReplay, useReplay } from "../components/replay";
import { readingAnswer, skyAnswer } from "../content/samples";
import { agentPrompt } from "../content/agent";
import { useRuntime } from "../runtime";
import { GITHUB } from "../site";

const justifyParagraph = readingAnswer.slice(readingAnswer.indexOf("Justified text gives"), readingAnswer.indexOf("\n\n## Typeface"));

const samplePatch = `--- a/src/net/retry.ts
+++ b/src/net/retry.ts
@@ -1,10 +1,14 @@
+function nextBackoff(state: RetryState): number {
+  state.backoff = Math.min(state.backoff * 2, state.maxBackoff);
+  return state.backoff + Math.random() * state.jitter;
+}
+
 export async function retry<T>(fn: () => Promise<T>, state: RetryState): Promise<T> {
   try {
     return await fn();
   } catch (error) {
-    const delay = state.backoff * 2;
-    await sleep(delay);
-    state.backoff = delay;
+    if (++state.attempts > state.maxAttempts) throw error;
+    await sleep(nextBackoff(state));
     return retry(fn, state);
   }
 }
`;

export function Home() {
  return (
    <main className="home">
      <Hero />
      <Features />
      <QuickStart />
    </main>
  );
}

function Hero() {
  const { scheme, highlight, diff } = useRuntime();
  const agent = useAgentReplay(90);
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="doc-eyebrow">A renderer for LLM and agent output</p>
        <h1 className="hero-title">
          Make model output read like a <em>well‑set book.</em>
        </h1>
        <p className="hero-lede">
          <code>output</code> renders what a model streams (prose, code, diffs, reasoning, and tool calls) with real text faces, a
          comfortable measure, and paragraphs justified by the Knuth‑Plass algorithm that TeX uses. Text that is still arriving
          never jumps. The moment a paragraph is done, it settles into shape.
        </p>
        <div className="hero-actions">
          <a className="doc-btn doc-btn-primary" href="/docs/getting-started">
            Get started
          </a>
          <a className="doc-btn" href="/examples">
            See examples
          </a>
          <CopyCommand command="pnpm add @output/react @output/core" />
        </div>
      </div>

      <figure className="hero-demo">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window-title">Agent turn</span>
          <button type="button" className="doc-btn doc-btn-small" onClick={agent.streaming ? agent.stop : agent.play}>
            {agent.streaming ? "Stop" : "Replay"}
          </button>
        </div>
        <div className="hero-demo-body">
          <p className="hero-prompt">{agentPrompt}</p>
          <Turn parts={agent.parts} streaming={agent.streaming} scheme={scheme} highlight={highlight} diff={diff} />
        </div>
      </figure>
    </section>
  );
}

function Features() {
  return (
    <div className="features">
      <StreamFeature />
      <JustifyFeature />
      <DiffFeature />
      <section className="feature feature-grid">
        <FeatureCard title="Safe by default" text="Model output is untrusted. Raw HTML shows as text, and links and images are limited to safe protocols." />
        <FeatureCard title="Selection stays honest" text="Line ends and hyphens are generated content, so copy, find-in-page, and screen readers see the original words." />
        <FeatureCard title="React or not" text="A framework-free core with createOutput and createTurn, and thin React components on top." />
        <FeatureCard title="Themes are CSS" text="Every decision is a custom property. Reader and compact ship in the box, and yours is a dozen lines." />
      </section>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function StreamFeature() {
  const { scheme, highlight } = useRuntime();
  const replay = useReplay(skyAnswer, 90);
  return (
    <section className="feature">
      <div className="feature-copy">
        <p className="feature-num">01</p>
        <h2>Streams without jumping</h2>
        <p>
          The growing message is split into blocks. Finished blocks render once and are never touched again, so cost stays flat
          however long the answer gets. Half-typed <code>**bold</code>, links, and code spans are repaired as they arrive, so raw
          markdown never flashes.
        </p>
        <button type="button" className="doc-btn" onClick={replay.streaming ? replay.stop : replay.play}>
          {replay.streaming ? "Stop" : "Stream it"}
        </button>
      </div>
      <div className="feature-stage feature-stage-scroll">
        <Output source={replay.text} streaming={replay.streaming} scheme={scheme} highlight={highlight} />
      </div>
    </section>
  );
}

function JustifyFeature() {
  const { scheme } = useRuntime();
  const [mode, setMode] = useState<"kp" | "ragged">("kp");
  const [width, setWidth] = useState(440);
  return (
    <section className="feature">
      <div className="feature-copy">
        <p className="feature-num">02</p>
        <h2>Typeset like a book</h2>
        <p>
          Browsers justify one line at a time and leave rivers. Here each settled paragraph is measured in its real font, given
          hyphenation points from Liang's patterns, and broken where spacing stays most even across the whole paragraph.
        </p>
        <div className="feature-controls">
          <Seg
            label="Line breaking"
            value={mode}
            onChange={setMode}
            options={[
              { value: "kp", label: "Knuth-Plass" },
              { value: "ragged", label: "Ragged" },
            ]}
          />
          <label className="doc-range">
            <span>Column</span>
            <input type="range" min={280} max={560} step={10} value={width} onChange={(e) => setWidth(+e.target.value)} />
            <output>{width}px</output>
          </label>
        </div>
      </div>
      <div className="feature-stage">
        <div style={{ width: `min(100%, ${width}px)`, margin: "0 auto" }}>
          <Output source={justifyParagraph} justify={mode === "kp" ? true : false} scheme={scheme} />
        </div>
      </div>
    </section>
  );
}

function DiffFeature() {
  const { diff, scheme } = useRuntime();
  return (
    <section className="feature">
      <div className="feature-copy">
        <p className="feature-num">03</p>
        <h2>Diffs by Pierre</h2>
        <p>
          Edits inside tool calls and fenced <code>diff</code> blocks are shown as diffs, with Shiki highlighting and word-level
          change marks from <a href="https://diffs.com">Pierre's renderer</a>. While a diff is still streaming, a light built-in
          view stands in.
        </p>
      </div>
      <div className="feature-stage">
        <div className="ov-turn" data-ov-theme="reader" data-ov-scheme={scheme}>
          <Diff diff={{ patch: samplePatch }} renderer={diff} />
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className="quickstart">
      <div className="quickstart-copy">
        <h2>Three lines to a better answer</h2>
        <Md>
          {`
            Load the faces, import the styles, and hand \`<Output>\` the message as it grows. Everything else (streaming, settling,
            and typesetting) happens for you. [Read the guide](/docs/getting-started) or [browse the source](${GITHUB}).
          `}
        </Md>
      </div>
      <div className="quickstart-code">
        <Code>{`
          import "@output/core/styles.css";
          import "@output/core/themes/reader.css";
          import { Output } from "@output/react";

          <Output source={message.text} streaming={status === "streaming"} />;
        `}</Code>
      </div>
    </section>
  );
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-command"
      onClick={() =>
        navigator.clipboard?.writeText(command).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      <span aria-hidden="true">$</span> {command}
      <span className="copy-command-hint">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
