import { describe, expect, it } from "vitest";
import { renderMarkdown, safeUrl } from "../src/render/markdown";
import { englishHyphenator } from "../src/linebreak/hyphenate";

describe("renderMarkdown", () => {
  it("escapes raw HTML from the model", () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror="y">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops unsafe link protocols but keeps the text", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("opens external links safely", () => {
    expect(renderMarkdown("[a](https://example.com)")).toContain('rel="noopener noreferrer"');
  });

  it("renders code blocks with a language label and copy button", () => {
    const html = renderMarkdown("```ts\nconst a = 1 < 2;\n```");
    expect(html).toContain('data-ov-lang="ts"');
    expect(html).toContain("data-ov-copy");
    expect(html).toContain("1 &lt; 2");
  });

  it("wraps tables for horizontal scrolling", () => {
    expect(renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |")).toContain('class="ov-table"');
  });

  it("accepts relative and http URLs", () => {
    expect(safeUrl("/docs")).toBe("/docs");
    expect(safeUrl("https://x.dev")).toBe("https://x.dev");
    expect(safeUrl("data:text/html,hi")).toBeNull();
  });
});

describe("englishHyphenator", () => {
  it("splits words using TeX patterns and minimums", () => {
    expect(englishHyphenator("hyphenation")).toEqual(["hy", "phen", "ation"]);
    expect(englishHyphenator("beautiful,").join("")).toBe("beautiful,");
  });

  it("leaves short words, identifiers, URLs, and acronyms whole", () => {
    for (const w of ["cat", "useEffect", "https://example.com", "NASA", "v1.2.3", "snake_case"]) {
      expect(englishHyphenator(w)).toEqual([w]);
    }
  });
});
