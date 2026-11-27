import { Output } from "@output/react";
import { useState, type ReactNode } from "react";
import { useRuntime } from "../runtime";

/** Strips the shared indent from a template literal so content can be indented with the code. */
export function dedent(text: string): string {
  const lines = text.replace(/^\n/, "").replace(/\n\s*$/, "").split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
}

/** Markdown, rendered by the library itself: the docs are set the way your users' answers will be. */
export function Md({ children, className }: { children: string; className?: string }) {
  const { scheme, highlight, diff } = useRuntime();
  return (
    <Output
      className={["doc-md", className].filter(Boolean).join(" ")}
      source={dedent(children)}
      scheme={scheme}
      highlight={highlight}
      diff={diff}
    />
  );
}

export function Code({ lang = "tsx", children }: { lang?: string; children: string }) {
  return <Md className="doc-code">{"```" + lang + "\n" + dedent(children) + "\n```"}</Md>;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function H2({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slug(children);
  return (
    <h2 className="doc-h2" id={anchor} data-toc="2">
      <a href={`#${anchor}`} className="doc-anchor">
        {children}
      </a>
    </h2>
  );
}

export function PageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <header className="doc-header">
      <p className="doc-eyebrow">{eyebrow}</p>
      <h1 className="doc-title">{title}</h1>
      <p className="doc-lede">{lede}</p>
    </header>
  );
}

export function Callout({ title, children }: { title?: string; children: string }) {
  return (
    <aside className="doc-callout">
      {title && <p className="doc-callout-title">{title}</p>}
      <Md>{children}</Md>
    </aside>
  );
}

export interface PropRow {
  name: string;
  type: string;
  default?: string;
  description: string;
}

/** A reference table: one row per prop or option. */
export function Props({ rows }: { rows: PropRow[] }) {
  return (
    <div className="doc-props" role="table">
      <div className="doc-props-row doc-props-head" role="row">
        <span role="columnheader">Name</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Default</span>
      </div>
      {rows.map((r) => (
        <div className="doc-props-row" role="row" key={r.name}>
          <code className="doc-props-name" role="cell">
            {r.name}
          </code>
          <code className="doc-props-type" role="cell">
            {r.type}
          </code>
          <code className="doc-props-default" role="cell">
            {r.default ?? "—"}
          </code>
          <p className="doc-props-desc" role="cell">
            {r.description}
          </p>
        </div>
      ))}
    </div>
  );
}

/** One API entry: a name, its signature, and what it does. */
export function Entry({ name, signature, children }: { name: string; signature: string; children?: ReactNode }) {
  const id = slug(name);
  return (
    <section className="doc-entry">
      <h3 className="doc-h3" id={id} data-toc="3">
        <a href={`#${id}`} className="doc-anchor">
          <code>{name}</code>
        </a>
      </h3>
      <pre className="doc-signature">
        <code>{signature}</code>
      </pre>
      {children}
    </section>
  );
}

/** A live example: the running thing on top, the code that makes it below. */
export function Example({
  label,
  title,
  code,
  actions,
  children,
  wide,
}: {
  label: string;
  title: string;
  code: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <figure className={wide ? "doc-example doc-example-wide" : "doc-example"}>
      <figcaption className="doc-example-bar">
        <span className="doc-example-label">{label}</span>
        <span className="doc-example-title">{title}</span>
        <span className="doc-example-actions">
          {actions}
          <button type="button" className="doc-btn doc-btn-ghost" aria-expanded={showCode} onClick={() => setShowCode((s) => !s)}>
            {showCode ? "Hide code" : "Code"}
          </button>
        </span>
      </figcaption>
      <div className="doc-example-stage">{children}</div>
      {showCode && (
        <div className="doc-example-code">
          <Code>{code}</Code>
        </div>
      )}
    </figure>
  );
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="doc-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
