import { Diff, Output } from "@output/react";
import { useState } from "react";
import { Callout, Code, Example, H2, Md, PageHeader, Seg } from "../components/doc";
import { useRuntime } from "../runtime";

const before = `export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}`;

const after = `export function formatDuration(ms: number): string {
  if (ms < 1000) return \`\${Math.round(ms)}ms\`;
  const s = ms / 1000;
  if (s < 60) return \`\${s.toFixed(1)}s\`;
  return \`\${Math.floor(s / 60)}m \${Math.round(s % 60)}s\`;
}`;

const codeAnswer = [
  "Use a `Map` keyed by part id, so each view survives re-renders:",
  "",
  "```ts",
  "const views = new Map<string, View>();",
  "",
  "for (const part of parts) {",
  "  let view = views.get(part.id);",
  "  if (!view) views.set(part.id, (view = createView(part)));",
  "  view.update(part);",
  "}",
  "```",
].join("\n");

export function DiffsAndCode() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="Diffs and code"
        lede="Shiki for code blocks and Pierre's renderer for diffs. Both are optional, and both load after the text."
      />

      <H2>Code highlighting</H2>
      <Md>{`
        Highlighting is a function from code and language to HTML: \`(code, lang) => html\`, sync or async. The \`@output/core/shiki\`
        entry builds one from Shiki, with light and dark themes that follow the color scheme. Load it lazily, so Shiki's grammars
        never sit between the reader and the first words.
      `}</Md>
      <Code>{`
        const [highlight, setHighlight] = useState<Highlighter>();

        useEffect(() => {
          import("@output/core/shiki")
            .then(({ createShikiHighlighter }) => createShikiHighlighter())
            .then((h) => setHighlight(() => h));
        }, []);

        <Output source={text} highlight={highlight} />;
      `}</Code>
      <Md>{`
        Only settled code blocks are highlighted. A block that is still streaming shows as plain text, so tokens never re-color
        mid-word. Languages beyond the preloaded set load the first time they appear. Choose your own with \`langs\` and \`themes\`:
      `}</Md>
      <Code lang="ts">{`
        createShikiHighlighter({
          themes: { light: "github-light", dark: "github-dark-dimmed" },
          langs: ["tsx", "python", "bash"],
        });
      `}</Code>
      <HighlightExample />

      <H2>Diffs</H2>
      <Md>{`
        Three things are shown as diffs: fenced \`diff\` blocks that hold a real unified patch, \`diff\` parts in a turn, and edits
        recognised inside tool calls. Each gets a file header with change counts.

        Without a renderer, diffs use a light built-in view. Add Pierre's renderer ([diffs.com](https://diffs.com)) for Shiki
        highlighting, word-level change marks, and collapsible context. It needs \`@pierre/diffs\` installed, and like Shiki it should
        load lazily.
      `}</Md>
      <Code lang="bash">{`pnpm add @pierre/diffs`}</Code>
      <Code>{`
        const [diff, setDiff] = useState<DiffRenderer>();

        useEffect(() => {
          import("@output/core/diffs").then(({ createPierreDiffRenderer }) =>
            setDiff(() => createPierreDiffRenderer({ diffStyle: "unified" })),
          );
        }, []);

        <Turn parts={parts} diff={diff} />;
      `}</Code>
      <DiffExample />
      <Callout title="Streaming diffs">{`
        A diff that is still arriving can't be parsed reliably, so it shows in the built-in view and hands off to Pierre once it
        settles. Highlighting runs once, not on every token.
      `}</Callout>

      <H2>Your own diff renderer</H2>
      <Md>{`
        A renderer is an object with one method. It draws into a container and returns a cleanup function. The input is either a
        unified \`patch\` or an \`oldFile\` and \`newFile\` pair.
      `}</Md>
      <Code lang="ts">{`
        import type { DiffRenderer } from "@output/core";
        import { toPatch } from "@output/core";

        const myRenderer: DiffRenderer = {
          render(container, input, { scheme }) {
            const pre = document.createElement("pre");
            pre.textContent = toPatch(input);
            container.append(pre);
            return () => pre.remove();
          },
        };
      `}</Code>
    </>
  );
}

function HighlightExample() {
  const { scheme, highlight } = useRuntime();
  return (
    <Example label="Live" title="A highlighted code block, with copy" code={`<Output source={answer} highlight={highlight} />`}>
      <Output source={codeAnswer} scheme={scheme} highlight={highlight} />
    </Example>
  );
}

function DiffExample() {
  const { scheme, diff } = useRuntime();
  const [which, setWhich] = useState<"pierre" | "plain">("pierre");
  return (
    <Example
      label="Live"
      title="An edit, from old and new text"
      code={`
        <Diff
          diff={{
            oldFile: { name: "src/format.ts", contents: before },
            newFile: { name: "src/format.ts", contents: after },
          }}
          renderer={diff}
        />
      `}
      actions={
        <Seg
          label="Renderer"
          value={which}
          onChange={setWhich}
          options={[
            { value: "pierre", label: "Pierre" },
            { value: "plain", label: "Built-in" },
          ]}
        />
      }
    >
      <div className="ov-turn" data-ov-theme="reader" data-ov-scheme={scheme}>
        <Diff
          key={which}
          diff={{ oldFile: { name: "src/format.ts", contents: before }, newFile: { name: "src/format.ts", contents: after } }}
          renderer={which === "pierre" ? diff : undefined}
        />
      </div>
    </Example>
  );
}
