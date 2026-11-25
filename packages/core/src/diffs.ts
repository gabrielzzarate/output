import { FileDiff, getSingularPatch, parseDiffFromFile, parsePatchFiles, type FileDiffMetadata, type FileDiffOptions } from "@pierre/diffs";
import type { DiffInput, DiffRenderer } from "./diff/types";

export interface PierreDiffOptions {
  /** "unified" (default) reads best in a chat column; "split" suits wide panes. */
  diffStyle?: "unified" | "split";
  /** Shiki or Pierre theme names for light and dark. */
  theme?: { light: string; dark: string };
  /** Wrap long lines instead of scrolling. Defaults to false. */
  wrap?: boolean;
  /** Any other Pierre `FileDiff` options. */
  pierre?: FileDiffOptions<undefined, undefined>;
}

/**
 * A diff renderer built on Pierre's diffs library (https://diffs.com):
 * Shiki highlighting, word-level change marks, and collapsible context.
 * Load it lazily to keep it out of your main bundle:
 *
 * ```ts
 * const { createPierreDiffRenderer } = await import("@output/core/diffs");
 * out.update({ diff: createPierreDiffRenderer() });
 * ```
 */
export function createPierreDiffRenderer(options: PierreDiffOptions = {}): DiffRenderer {
  return {
    render(container, input, { scheme }) {
      const instances: FileDiff<undefined, undefined>[] = [];
      for (const fileDiff of toFileDiffs(input)) {
        const host = document.createElement("div");
        host.className = "ov-pierre";
        container.appendChild(host);
        const instance = new FileDiff<undefined, undefined>({
          theme: options.theme ?? { light: "pierre-light", dark: "pierre-dark" },
          themeType: scheme,
          diffStyle: options.diffStyle ?? "unified",
          overflow: options.wrap ? "wrap" : "scroll",
          diffIndicators: "bars",
          lineDiffType: "word",
          hunkSeparators: "line-info",
          disableFileHeader: true,
          ...options.pierre,
          // Match the surrounding output's colors and type.
          unsafeCSS:
            `:host { --diffs-light-bg: var(--ov-diff-bg, #fff); --diffs-dark-bg: var(--ov-diff-bg, #0a0a0a); }` +
            (options.pierre?.unsafeCSS ?? ""),
        });
        instance.render({ fileDiff, containerWrapper: host });
        instances.push(instance);
      }
      return () => {
        for (const instance of instances) instance.cleanUp();
        container.replaceChildren();
      };
    },
  };
}

function toFileDiffs(input: DiffInput): FileDiffMetadata[] {
  if ("patch" in input) {
    const files = parsePatchFiles(input.patch).flatMap((p) => p.files);
    if (files.length) return files;
    return [getSingularPatch(input.patch)];
  }
  // Snippets from edit tools usually lack a final newline; adding one to both
  // sides avoids a spurious "No newline at end of file" marker.
  const withNewline = (f: { name: string; contents: string } | null) =>
    f && !f.contents.endsWith("\n") ? { ...f, contents: f.contents + "\n" } : f;
  return [parseDiffFromFile(withNewline(input.oldFile), withNewline(input.newFile))];
}
