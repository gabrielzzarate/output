import { Marked, type Token, type Tokens } from "marked";

const SAFE_PROTOCOL = /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the URL if it is safe to put in a link, otherwise null. */
export function safeUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  // Anything without a scheme is relative, which is safe.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return SAFE_PROTOCOL.test(trimmed) ? trimmed : null;
}

/**
 * Markdown to HTML for one block. Model output is untrusted, so raw HTML is
 * shown as text and links are limited to safe protocols.
 */
export const markdown = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const url = safeUrl(href);
      if (!url) return inner;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(url)}"${titleAttr}${external}>${inner}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      const url = safeUrl(href);
      if (!url || !/^https?:/i.test(url)) return escapeHtml(text);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" decoding="async">`;
    },
    code({ text, lang }: Tokens.Code) {
      const language = (lang ?? "").trim().split(/\s+/)[0] ?? "";
      const label = language ? escapeHtml(language) : "text";
      return (
        `<figure class="ov-code" data-ov-lang="${label}">` +
        `<figcaption class="ov-code-bar"><span class="ov-code-lang">${label}</span>` +
        `<button type="button" class="ov-copy" data-ov-copy aria-label="Copy code">Copy</button></figcaption>` +
        `<pre><code>${escapeHtml(text.replace(/\n$/, ""))}</code></pre></figure>`
      );
    },
    table(token: Tokens.Table) {
      // Let wide tables scroll inside their own box instead of the page.
      const header = token.header
        .map((cell, i) => `<th${align(token.align[i])}>${this.parser.parseInline(cell.tokens)}</th>`)
        .join("");
      const rows = token.rows
        .map(
          (row) =>
            "<tr>" +
            row.map((cell, i) => `<td${align(token.align[i])}>${this.parser.parseInline(cell.tokens)}</td>`).join("") +
            "</tr>",
        )
        .join("");
      return `<div class="ov-table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  },
});

function align(value: "center" | "left" | "right" | null | undefined): string {
  return value ? ` style="text-align:${value}"` : "";
}

export function renderTokens(tokens: Token[]): string {
  return markdown.parser(tokens);
}

export function renderMarkdown(src: string): string {
  return markdown.parse(src, { async: false }) as string;
}
