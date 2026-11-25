# output

Make LLM output read like a well-set book.

`output` renders the stream a model produces (prose, code, diffs, reasoning, and tool calls) with the care of a good reading app: real text faces, a comfortable measure, consistent rhythm, and justified paragraphs set with the Knuth-Plass algorithm that TeX uses, instead of the browser's line-by-line justification that leaves rivers.

It is built for streaming. Text that is still arriving stays ragged-right and never jumps under the reader's eye. The moment a paragraph is finished it settles into its typeset shape.

## Packages

| Package | What it is |
| --- | --- |
| [`@output/core`](packages/core) | Framework-free renderer: streaming block parser, markdown rendering, themes, optimal line breaking. |
| [`@output/react`](packages/react) | `<Output>` component for React 18+. |
| [`playground`](apps/playground) | Replays recorded answers side by side against plain react-markdown. |

## Quick start

```bash
pnpm add @output/react @output/core
pnpm add @fontsource-variable/literata @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

```tsx
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@output/core/styles.css";
import "@output/core/themes/reader.css";
import { Output } from "@output/react";

<Output source={message.text} streaming={status === "streaming"} />;
```

`source` can be a string that grows as the message streams (how the AI SDK and most chat state work), an async iterable of chunks, or a `ReadableStream<string>`.

Without React:

```ts
import { createOutput } from "@output/core";

const out = createOutput(element, { theme: "reader" });
for await (const chunk of stream) out.append(chunk);
out.end();
```

### Whole agent turns

`<Turn>` renders every part of an assistant message: reasoning, tool calls, diffs, and text. Pass AI SDK UI message parts as they are, or this library's own parts.

```tsx
import { Turn } from "@output/react";

<Turn parts={message.parts} streaming={status === "streaming"} />;
```

- **Reasoning** stays open while the model thinks, then folds into a "Thought for 6.4s" line. If the reader opens or closes it, that choice sticks.
- **Tool calls** are compact rows with status, a readable name, what they acted on, and how long they took. Each row expands to show input and output. Edits are recognised (`old_string`/`new_string`, whole-file writes, and patches) and shown as a diff under the row.
- **Diffs** use Pierre's renderer once they're complete, and a light built-in view while they stream.

Replace any part's component, or relabel tools:

```tsx
<Turn
  parts={message.parts}
  components={{ ToolCall: MyToolCall }}
  tools={{ label: (call) => (call.name === "web_search" ? "Searched the web" : undefined) }}
/>
```

Without React, `createTurn(element, options).setParts(parts, { streaming })` does the same.

### Diffs

Fenced ` ```diff ` blocks that hold a real patch are shown as diffs, and so are edits inside tool calls. For full highlighting and word-level change marks, add Pierre's renderer ([diffs.com](https://diffs.com)). Load it lazily:

```ts
const { createPierreDiffRenderer } = await import("@output/core/diffs"); // needs @pierre/diffs
const diff = createPierreDiffRenderer({ diffStyle: "unified" });
// <Turn diff={diff} ... />  or  <Output diff={diff} ... />
```

Without it, diffs fall back to a built-in plain view.

### Code highlighting

Highlighting uses Shiki and is optional. Load it lazily so it never blocks text:

```ts
const { createShikiHighlighter } = await import("@output/core/shiki");
const highlight = await createShikiHighlighter();
// <Output highlight={highlight} ... />  or  out.update({ highlight })
```

Only settled code blocks are highlighted. Code that is still streaming shows as plain text.

## Options

| Option | Default | |
| --- | --- | --- |
| `theme` | `"reader"` | `"reader"` (serif, book-like) or `"compact"` (sans, for narrow panes). Themes are CSS custom properties, so you can write your own. |
| `justify` | `"auto"` | `"auto"` justifies when the column is at least `minJustifyWidth` ems wide. `true` always, `false` never. |
| `hyphenate` | English | A function that splits a word into hyphenation fragments, or `false`. `createHyphenator()` wraps any [`hyphen`](https://www.npmjs.com/package/hyphen) language. |
| `highlight` | none | `(code, lang) => html`, sync or async. |
| `diff` | plain view | A diff renderer, such as `createPierreDiffRenderer()`. |
| `lang` | `"en"` | Sets `lang` on the root for browser hyphenation and screen readers. |
| `minJustifyWidth` | `22` | Narrowest column, in ems, that `"auto"` will justify. |
| `scheme` (React) | `"auto"` | `"light"`, `"dark"`, or follow the system. |

## How it works

**Streaming.** `BlockStream` splits the growing markdown into blocks. Every block except the last is *settled*: it is final, rendered once, and never touched again. Only the text after the last settled block is re-lexed on each update, so cost stays flat however long the answer gets. The live block's unfinished inline syntax (`**bold`, half-typed links, open code spans) is repaired before rendering so raw markdown never flashes.

**Line breaking.** When a paragraph settles, it is queued for idle time. Its words are measured in place with DOM ranges (so the real font, optical size, kerning, and inline styles are all accounted for), hyphenation points come from Liang's patterns, and Knuth-Plass picks the breaks that keep spacing most even across the whole paragraph. The result is applied without rewriting the text: line ends and hyphens are generated content and spacing is set per space, so selection, copy, find-in-page, and screen readers see the original words. Paragraphs re-set on resize and font load.

**Safety.** Model output is untrusted. Raw HTML is shown as text, and links and images are limited to safe protocols.

## Development

```bash
pnpm install
pnpm dev          # playground at http://localhost:5173
pnpm test
pnpm typecheck
pnpm build
```

## Roadmap

- **Milestone 1:** prose and code, streaming, reader and compact themes, optimal justification, playground.
- **Milestone 2:** diffs built on [`@pierre/diffs`](https://diffs.com), tool-call rows, reasoning blocks, `<Turn>` with `components` overrides.
- **Next:** citations and source cards.
- **Later:** subtle letter-spacing and width adjustment to tighten loose lines further (as Justif does), math, more hyphenation languages loaded on demand.
