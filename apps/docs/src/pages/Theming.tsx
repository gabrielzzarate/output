import { Output } from "@output/react";
import { useState, type CSSProperties } from "react";
import { Code, Example, H2, Md, PageHeader, Seg } from "../components/doc";
import { skyAnswer } from "../content/samples";
import { useRuntime } from "../runtime";

const excerpt = skyAnswer.slice(0, skyAnswer.indexOf("\n\n- The sun"));

const variables: [string, string, string][] = [
  ["--ov-font-prose", "Literata, then book faces", "Body text."],
  ["--ov-font-ui", "Inter, then system sans", "Tool rows, labels, table headers."],
  ["--ov-font-heading", "var(--ov-font-ui)", "Headings inside the output."],
  ["--ov-font-mono", "JetBrains Mono, then system mono", "Code and diffs."],
  ["--ov-size", "1.0625rem", "Base font size."],
  ["--ov-leading", "1.65", "Line height for prose."],
  ["--ov-measure", "40rem", "Maximum line length."],
  ["--ov-paragraph-gap", "0.9em", "Space between paragraphs."],
  ["--ov-block-gap", "1.1em", "Space around code, quotes, lists, tables."],
  ["--ov-code-size", "0.84em", "Code size relative to prose."],
  ["--ov-radius", "8px", "Corner radius for code and diffs."],
  ["--ov-ink, --ov-ink-soft, --ov-ink-faint", "", "Text, secondary text, and hints."],
  ["--ov-rule, --ov-accent", "", "Hairlines; links and focus."],
  ["--ov-surface, --ov-surface-strong", "", "Code backgrounds and hover states."],
  ["--ov-add, --ov-add-wash, --ov-del, --ov-del-wash", "", "Diff colors."],
  ["--ov-running, --ov-mark, --ov-diff-bg", "", "Running tools, highlights, and the diff background."],
];

export function Theming() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="Theming"
        lede="Every visual decision is a CSS custom property. A theme is a short list of overrides."
      />

      <H2>Built-in themes</H2>
      <Md>{`
        **Reader** is book-like: a serif with optical sizes, generous leading, and a 40rem measure. It is the default. **Compact**
        swaps in the interface sans at a smaller size, for chat sidebars and coding harnesses. Import the CSS for each theme you use,
        then choose one with \`theme\`.
      `}</Md>
      <Code>{`
        import "@output/core/themes/compact.css";

        <Output source={text} theme="compact" />;
      `}</Code>

      <H2>Writing a theme</H2>
      <Md>{`
        A theme is a selector on the \`data-ov-theme\` attribute that \`<Output>\` and \`<Turn>\` set. Override only what you need, and
        everything else keeps the base values.
      `}</Md>
      <Code lang="css">{`
        :is(.ov-output, .ov-turn)[data-ov-theme="journal"] {
          --ov-font-prose: "Newsreader", Georgia, serif;
          --ov-size: 1.125rem;
          --ov-leading: 1.7;
          --ov-measure: 34rem;
          --ov-accent: #9a3b1b;
        }
      `}</Code>
      <ThemeExample />

      <H2>Dark mode</H2>
      <Md>{`
        Colors follow \`prefers-color-scheme\` by default. To follow your app's own toggle instead, pass \`scheme="light"\` or
        \`scheme="dark"\`, which sets \`data-ov-scheme\` on the root. Shiki tokens and Pierre's diffs switch with it. To adjust the dark
        palette, override the color properties under that attribute:
      `}</Md>
      <Code lang="css">{`
        .ov-output[data-ov-scheme="dark"],
        .ov-turn[data-ov-scheme="dark"] {
          --ov-ink: #ece8e1;
          --ov-surface: #1c1d20;
        }
      `}</Code>

      <H2>Variables</H2>
      <div className="doc-props" role="table">
        <div className="doc-props-row doc-props-head" role="row">
          <span role="columnheader">Property</span>
          <span role="columnheader">Default</span>
          <span role="columnheader" />
        </div>
        {variables.map(([name, value, description]) => (
          <div className="doc-props-row" role="row" key={name}>
            <code className="doc-props-name" role="cell" style={{ gridColumn: value ? undefined : "1 / -1" }}>
              {name}
            </code>
            {value && (
              <code className="doc-props-type" role="cell" style={{ gridColumn: "2 / -1" }}>
                {value}
              </code>
            )}
            <p className="doc-props-desc" role="cell">
              {description}
            </p>
          </div>
        ))}
      </div>

      <H2>Fonts</H2>
      <Md>{`
        No typeface is bundled. The stacks fall back to good system faces (Iowan Old Style and Palatino for prose, the system sans
        for interface text), so output looks deliberate even before any web font loads. When a web font does load, settled
        paragraphs are typeset again so line breaks match the real glyphs.
      `}</Md>
    </>
  );
}

const presets = {
  reader: { label: "Reader", theme: "reader", style: {} },
  compact: { label: "Compact", theme: "compact", style: {} },
  journal: {
    label: "Custom",
    theme: "reader",
    style: {
      "--ov-font-prose": `"Literata Variable", Georgia, serif`,
      "--ov-size": "1.18rem",
      "--ov-leading": "1.72",
      "--ov-measure": "32rem",
      "--ov-accent": "#9a3b1b",
      "--ov-font-heading": `"Literata Variable", Georgia, serif`,
    },
  },
} as const;

function ThemeExample() {
  const { scheme } = useRuntime();
  const [preset, setPreset] = useState<keyof typeof presets>("reader");
  const p = presets[preset];
  return (
    <Example
      label="Live"
      title="Same answer, three themes"
      code={`
        <Output source={text} theme="reader" />
        <Output source={text} theme="compact" />
        <Output source={text} theme="journal" />
      `}
      actions={
        <Seg
          label="Theme"
          value={preset}
          onChange={setPreset}
          options={Object.entries(presets).map(([value, { label }]) => ({ value: value as keyof typeof presets, label }))}
        />
      }
    >
      <Output className="keep-measure" source={excerpt} theme={p.theme} scheme={scheme} style={{ ...(p.style as CSSProperties), margin: "0 auto" }} />
    </Example>
  );
}
