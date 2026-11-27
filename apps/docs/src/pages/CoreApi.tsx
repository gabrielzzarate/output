import { Code, Entry, H2, Md, PageHeader, Props } from "../components/doc";
import { optionRows } from "./ReactApi";

export function CoreApi() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="@output/core"
        lede="The framework-free renderer, its views, and the pieces they're built from. Three entry points: the main one, /shiki, and /diffs."
      />

      <H2>Rendering</H2>
      <Entry name="createOutput" signature={`createOutput(element: HTMLElement, options?: OutputOptions): Output`}>
        <Md>{`Renders a stream of model output into \`element\`. The returned handle:`}</Md>
        <Props
          rows={[
            { name: "append(chunk)", type: "(chunk: string) => void", description: "Adds streamed text. Calls within one frame are batched into one render." },
            { name: "end()", type: "() => void", description: "Marks the stream finished, which settles the last block." },
            { name: "setText(text, { done })", type: "(text: string, options?: { done?: boolean }) => void", description: "Sets the full text so far. If it extends the current text, only the new part is appended; otherwise the output starts over." },
            { name: "reset()", type: "() => void", description: "Clears everything and starts a new stream." },
            { name: "update(options)", type: "(options: OutputOptions) => void", description: "Applies new options. Theme and justification changes re-render in place." },
            { name: "flush()", type: "() => Promise<void>", description: "Resolves once pending renders, highlighting, and justification are done." },
            { name: "destroy()", type: "() => void", description: "Removes listeners and observers." },
            { name: "element, text, ended", type: "HTMLElement, string, boolean", description: "The root element, all markdown received so far, and whether end() has been called." },
          ]}
        />
      </Entry>
      <Entry name="OutputOptions" signature={`interface OutputOptions { theme, justify, hyphenate, highlight, diff, lang, minJustifyWidth }`}>
        <Props rows={optionRows} />
      </Entry>
      <Entry
        name="createTurn"
        signature={`createTurn(element: HTMLElement, options?: TurnOptions): Turn
// TurnOptions = OutputOptions & { tools?: { label?, summarize? } }`}
      >
        <Md>{`Renders a whole assistant turn. \`turn.setParts(parts, { streaming })\` takes the full list each time; only parts that changed are updated. Also has \`update(options)\` and \`destroy()\`.`}</Md>
      </Entry>

      <H2>Part types</H2>
      <Md>{`What \`<Turn>\` and \`createTurn\` render. \`normalizeParts\` converts AI SDK UI message parts to these, so you only need them when building parts yourself.`}</Md>
      <Code lang="ts">{`
        type Part = TextPart | ReasoningPart | ToolPart | DiffPart;

        interface TextPart {
          type: "text";
          id?: string;
          text: string;
          state?: "streaming" | "done";
        }

        interface ReasoningPart {
          type: "reasoning";
          id?: string;
          text: string;
          state?: "streaming" | "done";
          durationMs?: number; // measured if left out
        }

        interface ToolPart {
          type: "tool";
          id: string;
          name: string;
          state: "pending" | "running" | "done" | "error";
          input?: unknown;
          output?: unknown;
          error?: string;
          durationMs?: number;
        }

        interface DiffPart {
          type: "diff";
          id?: string;
          diff: DiffInput;
        }
      `}</Code>
      <Entry name="normalizeParts" signature={`normalizeParts(parts: readonly unknown[]): Part[]`}>
        <Md>{`
          Maps \`text\` and \`reasoning\` across as they are, and \`tool-*\` and \`dynamic-tool\` parts to \`ToolPart\`. AI SDK tool states
          map as: \`input-streaming\` to pending; \`input-available\` and approval states to running; \`output-available\` to done;
          \`output-error\` and \`output-denied\` to error. Unknown types are dropped.
        `}</Md>
      </Entry>

      <H2>Highlighting and diffs</H2>
      <Entry name="createShikiHighlighter" signature={`import { createShikiHighlighter } from "@output/core/shiki";

createShikiHighlighter(options?: {
  themes?: { light: BundledTheme; dark: BundledTheme }; // github-light, github-dark-dimmed
  langs?: BundledLanguage[];
}): Promise<Highlighter>`}>
        <Md>{`Needs \`shiki\` installed. Languages outside \`langs\` load the first time they appear; unknown ones fall back to plain text. Common aliases (\`ts\`, \`sh\`, \`py\`, \`yml\`, and so on) are understood.`}</Md>
      </Entry>
      <Entry name="createPierreDiffRenderer" signature={`import { createPierreDiffRenderer } from "@output/core/diffs";

createPierreDiffRenderer(options?: {
  diffStyle?: "unified" | "split"; // "unified"
  theme?: { light: string; dark: string }; // pierre-light, pierre-dark
  wrap?: boolean; // false: long lines scroll
  pierre?: FileDiffOptions; // anything else Pierre's FileDiff accepts
}): DiffRenderer`}>
        <Md>{`Needs \`@pierre/diffs\` installed. Unified reads best in a chat column; split suits wide panes.`}</Md>
      </Entry>
      <Entry
        name="DiffRenderer"
        signature={`interface DiffRenderer {
  render(container: HTMLElement, input: DiffInput, context: { scheme: "light" | "dark" | "system" }): () => void;
}

type DiffInput = { patch: string } | { oldFile: DiffFile | null; newFile: DiffFile | null };
interface DiffFile { name: string; contents: string }`}
      />
      <Entry name="Diff utilities" signature={`isPatch(text: string): boolean
toPatch(input: DiffInput, context = 3): string
diffStats(input: DiffInput): { additions: number; deletions: number; name: string }
renderPlainDiff(input: DiffInput): string // HTML for the built-in view`} />

      <H2>Views</H2>
      <Md>{`The DOM views \`createTurn\` uses, for placing a single tool call, reasoning block, or diff in your own layout. Each returns \`{ element, update, destroy }\`; append \`element\` where you want it.`}</Md>
      <Entry name="createToolCallView" signature={`createToolCallView(options?: { diff?, highlight?, label?, summarize? }): ToolCallView
view.update(call: ToolPart)`} />
      <Entry name="createReasoningView" signature={`createReasoningView(options?: OutputOptions): ReasoningView
view.update(part: ReasoningPart, streaming: boolean)`} />
      <Entry name="createDiffView" signature={`createDiffView(renderer?: DiffRenderer): DiffView
view.update(input: DiffInput, { settled?: boolean })`} />
      <Entry name="Tool helpers" signature={`humanize(name: string): string               // "read_file" → "Read file"
formatDuration(ms: number): string           // 2840 → "2.8s"
summarizeToolInput(input: unknown): string   // the command, path, URL, or query
diffFromToolCall(call: ToolPart): DiffInput | null`} />

      <H2>Streaming and markdown</H2>
      <Entry name="BlockStream" signature={`new BlockStream(options?: MarkedOptions)
stream.append(chunk: string): { settled: Block[]; live: Block | null }
stream.end(): { settled: Block[]; live: Block | null }`}>
        <Md>{`Splits a growing markdown stream into blocks. Every block but the last is settled and never changes. Each \`Block\` has a stable \`id\`, its \`type\`, its \`raw\` source, and the marked \`token\`.`}</Md>
      </Entry>
      <Entry name="Markdown helpers" signature={`repairTail(src: string): string        // closes unfinished inline syntax
renderMarkdown(src: string): string    // safe HTML: raw HTML is escaped
safeUrl(href: string): string | null   // null for unsafe protocols
escapeHtml(text: string): string`} />

      <H2>Line breaking</H2>
      <Md>{`
        The Knuth-Plass implementation stands on its own. Describe a paragraph as boxes (words), glue (stretchable spaces), and
        penalties (possible breaks, such as hyphens), and get back the optimal breaks.
      `}</Md>
      <Entry name="breakLines" signature={`breakLines(items: Item[], lineWidth: number | ((line: number) => number), options?: BreakOptions): Break[] | null`}>
        <Md>{`Returns one \`Break\` per line, with the item \`position\` it ends at and the adjustment \`ratio\` of its glue, or \`null\` when no setting fits within the tolerance. \`breakParagraph\` tries a normal tolerance first, then a loose one.`}</Md>
        <Props
          rows={[
            { name: "tolerance", type: "number", default: "2", description: "The largest adjustment ratio a line may have. TeX uses 1 to 2." },
            { name: "linePenalty", type: "number", description: "Added to every line, so fewer lines are preferred." },
            { name: "flaggedDemerits", type: "number", description: "Charged when two lines in a row end in a hyphen." },
            { name: "fitnessDemerits", type: "number", description: "Charged when a tight line sits next to a loose one." },
            { name: "hyphenate", type: "boolean", default: "true", description: "When false, flagged penalties are not considered as breaks." },
          ]}
        />
        <Code lang="ts">{`
          import { box, glue, penalty, breakParagraph } from "@output/core";

          const space = glue(4, 2, 1);
          const items = [box(30), space, box(52), space, box(18), glue(0, 10000, 0), penalty(0, -10000, true)];
          const breaks = breakParagraph(items, 100);
        `}</Code>
      </Entry>
      <Entry name="justifyParagraph" signature={`justifyParagraph(p: HTMLElement, options: JustifyOptions): boolean
unjustify(p: HTMLElement): void`}>
        <Md>{`Sets one paragraph element in place, the way \`<Output>\` does: \`hyphenate\`, \`minWidthEm\`, \`stretch\` (0.15em), \`shrink\` (0.035em), and \`hyphenPenalty\` (50). Returns false when the paragraph was left ragged.`}</Md>
      </Entry>
      <Entry name="createHyphenator" signature={`createHyphenator(hyphenate?: (word: string) => string, leftMin = 2, rightMin = 3): Hyphenator
englishHyphenator: Hyphenator`}>
        <Md>{`Wraps a function that inserts soft hyphens, such as one from the \`hyphen\` package, with caching and minimum fragment lengths.`}</Md>
      </Entry>
    </>
  );
}
