import { bundledLanguages, createHighlighter, type BundledLanguage, type BundledTheme } from "shiki";
import type { Highlighter } from "./types";

export interface ShikiOptions {
  /** Light and dark themes. Output switches between them with the color scheme. */
  themes?: { light: BundledTheme; dark: BundledTheme };
  /** Languages to load up front. Others load the first time they appear. */
  langs?: BundledLanguage[];
}

const ALIASES: Record<string, string> = { sh: "bash", shell: "bash", zsh: "bash", ts: "typescript", js: "javascript", py: "python", rb: "ruby", yml: "yaml", md: "markdown", rs: "rust" };

/**
 * Creates a highlighter backed by Shiki. Load it lazily so Shiki stays out of
 * your main bundle:
 *
 * ```ts
 * const { createShikiHighlighter } = await import("@output/core/shiki");
 * out.update({ highlight: await createShikiHighlighter() });
 * ```
 */
export async function createShikiHighlighter(options: ShikiOptions = {}): Promise<Highlighter> {
  const themes = options.themes ?? { light: "github-light", dark: "github-dark-dimmed" };
  const highlighter = await createHighlighter({
    themes: [themes.light, themes.dark],
    langs: options.langs ?? ["typescript", "javascript", "tsx", "python", "bash", "json", "css", "html", "diff"],
  });

  return async (code, rawLang) => {
    const requested = (ALIASES[rawLang] ?? rawLang).toLowerCase();
    let lang = "text";
    if (highlighter.getLoadedLanguages().includes(requested)) {
      lang = requested;
    } else if (requested in bundledLanguages) {
      await highlighter.loadLanguage(requested as BundledLanguage);
      lang = requested;
    }
    const html = highlighter.codeToHtml(code, {
      lang,
      themes,
      defaultColor: false,
    });
    // Keep only the token spans: the surrounding <pre> belongs to Output.
    const match = /<code[^>]*>([\s\S]*)<\/code>/.exec(html);
    return match ? match[1]! : html;
  };
}
