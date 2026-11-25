import { Output } from "@output/react";
import { useState } from "react";
import { Callout, Code, Example, H2, Md, PageHeader } from "../components/doc";
import { readingAnswer } from "../content/samples";
import { useRuntime } from "../runtime";

const paragraph = readingAnswer.slice(readingAnswer.indexOf("Justified text gives"), readingAnswer.indexOf("\n\n## Typeface"));

export function Typesetting() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="How typesetting works"
        lede="Why browser justification leaves rivers, and how settled paragraphs are set the way TeX sets them."
      />

      <H2>The problem with text-align: justify</H2>
      <Md>{`
        Browsers break lines greedily: each line takes as many words as fit, and then its spaces stretch to fill whatever room is
        left. One line's choice never considers the next, so a long word that just misses a line leaves that line's spaces wide
        open, and wide gaps on neighbouring lines line up into rivers of white. That's why most careful sites keep text ragged.

        Knuth and Plass's algorithm, the one TeX has used since 1981, looks at the whole paragraph at once. It weighs every way of
        breaking it and picks the set of breaks with the lowest total cost, where a line costs more the further its spaces stray
        from their natural width, and extra costs apply to hyphens and to a tight line next to a loose one.
      `}</Md>
      <CompareExample />

      <H2>What happens when a paragraph settles</H2>
      <Md>{`
        1. **Measure.** Each word is measured in place with DOM ranges, so the real font, optical size, kerning, and inline
           styles such as bold, italics, and code spans are all accounted for.
        2. **Hyphenate.** Liang's patterns (the ones TeX uses) mark where each long word may break, with at least two letters
           before a hyphen and three after.
        3. **Break.** Knuth-Plass picks the breaks. Spaces may stretch a little and shrink very little, since squeezed lines read
           worse than loose ones.
        4. **Apply.** Line ends and hyphens are added as generated content, and spacing is set per space. The text itself is not
           rewritten, so selection, copy, find-in-page, and screen readers all see the original words.

        Paragraphs are set again when the column is resized or a web font finishes loading. The work runs in idle time, so it never
        competes with tokens arriving.
      `}</Md>

      <H2>When it justifies</H2>
      <Md>{`
        Justification needs room. In a narrow column there are too few spaces per line to absorb the slack, and ragged text reads
        better. With the default \`justify="auto"\`, a paragraph is justified only when its column is at least \`minJustifyWidth\` ems
        wide (22 by default). \`justify={true}\` always justifies and \`justify={false}\` never does.
      `}</Md>
      <Code>{`
        <Output source={text} justify="auto" minJustifyWidth={26} />
      `}</Code>

      <H2>Other languages</H2>
      <Md>{`
        English hyphenation is the default. \`createHyphenator\` wraps any language from the
        [\`hyphen\`](https://www.npmjs.com/package/hyphen) package, and \`hyphenate={false}\` turns hyphenation off while keeping
        justification. Set \`lang\` too, so screen readers and the browser know the content's language.
      `}</Md>
      <Code>{`
        import { createHyphenator } from "@output/core";
        import { hyphenateSync as german } from "hyphen/de";

        const hyphenate = createHyphenator(german);

        <Output source={text} lang="de" hyphenate={hyphenate} />;
      `}</Code>
      <Callout title="Using the algorithm directly">{`
        The line breaker is exported on its own. \`breakLines\` takes a list of boxes, glue, and penalties in the classic TeX model
        and returns the optimal breaks, so you can use it for canvas text, PDFs, or terminals. See
        [Line breaking](/docs/api/core#line-breaking) in the reference.
      `}</Callout>
    </>
  );
}

function CompareExample() {
  const { scheme } = useRuntime();
  const [width, setWidth] = useState(280);
  const col = { width: `min(100%, ${width}px)` };
  return (
    <Example
      label="Live"
      title="The same paragraph, two ways"
      code={`
        // Left: what text-align: justify does. The library never uses it.
        <Output source={paragraph} justify={false} className="browser-justify" />

        // Right: optimal breaks, set by the library.
        <Output source={paragraph} justify />
      `}
      actions={
        <label className="doc-range">
          <span>Column</span>
          <input type="range" min={220} max={360} step={10} value={width} onChange={(e) => setWidth(+e.target.value)} />
          <output>{width}px</output>
        </label>
      }
    >
      <div className="example-split">
        <div>
          <p className="example-caption">Browser justify</p>
          <div style={col}>
            <Output source={paragraph} justify={false} scheme={scheme} className="browser-justify" />
          </div>
        </div>
        <div>
          <p className="example-caption">Knuth-Plass</p>
          <div style={col}>
            <Output source={paragraph} justify scheme={scheme} />
          </div>
        </div>
      </div>
    </Example>
  );
}
