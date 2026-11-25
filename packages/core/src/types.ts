import type { Hyphenator } from "./linebreak/hyphenate";

/** Turns code into highlighted HTML for the inside of a `<code>` element. */
export type Highlighter = (code: string, lang: string) => string | Promise<string>;

export interface OutputOptions {
  /** Theme name, applied as `data-ov-theme`. Ships with "reader" and "compact". */
  theme?: string;
  /**
   * Optimal (Knuth-Plass) justification for settled paragraphs.
   * "auto" justifies only when the column is wide enough to look good.
   */
  justify?: "auto" | boolean;
  /** Hyphenation for justified text. Defaults to English; false turns it off. */
  hyphenate?: Hyphenator | false;
  /** Code highlighter, for example from `@output/core/shiki`. */
  highlight?: Highlighter;
  /** Content language, used for hyphenation by the browser. Defaults to "en". */
  lang?: string;
  /** Narrowest column, in ems, that "auto" will justify. Defaults to 22. */
  minJustifyWidth?: number;
}
