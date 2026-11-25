export interface DiffFile {
  name: string;
  contents: string;
}

/** A diff to show: a unified patch, or the old and new versions of one file. */
export type DiffInput = { patch: string } | { oldFile: DiffFile | null; newFile: DiffFile | null };

export interface DiffRenderContext {
  /** "light", "dark", or "system" to follow the color scheme. */
  scheme: "light" | "dark" | "system";
}

/**
 * Draws a finished diff into a container and returns a cleanup function.
 * `@output/core/diffs` provides one built on Pierre's diffs library.
 */
export interface DiffRenderer {
  render(container: HTMLElement, input: DiffInput, context: DiffRenderContext): () => void;
}
