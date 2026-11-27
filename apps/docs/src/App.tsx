import { useEffect, useLayoutEffect, useState, type ComponentType } from "react";
import { usePath, useLinkInterception } from "./router";
import { useRuntime } from "./runtime";
import { Home } from "./pages/Home";
import { GettingStarted } from "./pages/GettingStarted";
import { Streaming } from "./pages/Streaming";
import { AgentTurns } from "./pages/AgentTurns";
import { DiffsAndCode } from "./pages/DiffsAndCode";
import { Theming } from "./pages/Theming";
import { Typesetting } from "./pages/Typesetting";
import { ReactApi } from "./pages/ReactApi";
import { CoreApi } from "./pages/CoreApi";
import { Examples } from "./pages/Examples";
import { NotFound } from "./pages/NotFound";

import { GITHUB } from "./site";

interface Page {
  path: string;
  title: string;
  component: ComponentType;
}

const sections: { heading: string; pages: Page[] }[] = [
  {
    heading: "Start",
    pages: [
      { path: "/docs/getting-started", title: "Getting started", component: GettingStarted },
      { path: "/examples", title: "Examples", component: Examples },
    ],
  },
  {
    heading: "Guides",
    pages: [
      { path: "/docs/streaming", title: "Streaming", component: Streaming },
      { path: "/docs/agent-turns", title: "Agent turns", component: AgentTurns },
      { path: "/docs/diffs-and-code", title: "Diffs and code", component: DiffsAndCode },
      { path: "/docs/theming", title: "Theming", component: Theming },
      { path: "/docs/typesetting", title: "How typesetting works", component: Typesetting },
    ],
  },
  {
    heading: "Reference",
    pages: [
      { path: "/docs/api/react", title: "@output/react", component: ReactApi },
      { path: "/docs/api/core", title: "@output/core", component: CoreApi },
    ],
  },
];

const allPages = sections.flatMap((s) => s.pages);

export function App() {
  useLinkInterception();
  const path = usePath();
  const page = allPages.find((p) => p.path === path);
  const isHome = path === "/";

  useEffect(() => {
    document.title = isHome ? "output: typeset LLM output" : `${page?.title ?? "Not found"} · output`;
    if (location.hash) {
      // Wait for the page to lay out before jumping to an anchor.
      requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
    } else {
      window.scrollTo(0, 0);
    }
  }, [path, isHome, page]);

  return (
    <div className="site">
      <TopBar path={path} />
      {isHome ? (
        <Home />
      ) : (
        <DocsLayout path={path}>{page ? <page.component /> : <NotFound />}</DocsLayout>
      )}
      <Footer />
    </div>
  );
}

function TopBar({ path }: { path: string }) {
  const { scheme, setScheme } = useRuntime();
  const inDocs = path.startsWith("/docs");
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a href="/" className="brand" aria-label="output home">
          <span className="brand-mark" aria-hidden="true">
            ¶
          </span>
          <span className="brand-name">output</span>
        </a>
        <nav className="topnav" aria-label="Main">
          <a href="/docs/getting-started" aria-current={inDocs ? "page" : undefined}>
            Docs
          </a>
          <a href="/examples" aria-current={path === "/examples" ? "page" : undefined}>
            Examples
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button
            type="button"
            className="scheme-toggle"
            aria-label={scheme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
          >
            {scheme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </div>
    </header>
  );
}

function DocsLayout({ path, children }: { path: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);
  const index = allPages.findIndex((p) => p.path === path);
  const prev = index > 0 ? allPages[index - 1] : undefined;
  const next = index >= 0 ? allPages[index + 1] : undefined;
  const wide = path === "/examples";

  return (
    <div className={wide ? "docs docs-wide" : "docs"}>
      <button type="button" className="menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
        <span>{allPages[index]?.title ?? "Menu"}</span>
        <ChevronIcon />
      </button>
      <nav className={menuOpen ? "sidebar sidebar-open" : "sidebar"} aria-label="Documentation">
        {sections.map((s) => (
          <div key={s.heading} className="sidebar-group">
            <p className="sidebar-heading">{s.heading}</p>
            {s.pages.map((p) => (
              <a key={p.path} href={p.path} aria-current={p.path === path ? "page" : undefined}>
                {p.title}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <main className="docs-main" key={path}>
        <article className="doc">{children}</article>
        {(prev || next) && (
          <nav className="pager" aria-label="Pages">
            {prev ? (
              <a href={prev.path} className="pager-prev">
                <span>Previous</span>
                {prev.title}
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a href={next.path} className="pager-next">
                <span>Next</span>
                {next.title}
              </a>
            )}
          </nav>
        )}
      </main>
      {!wide && <Toc path={path} />}
    </div>
  );
}

/** "On this page", built from the headings the page rendered. */
function Toc({ path }: { path: string }) {
  const [items, setItems] = useState<{ id: string; text: string; level: string }[]>([]);
  const [active, setActive] = useState<string>();

  useLayoutEffect(() => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>(".doc [data-toc]"));
    setItems(headings.map((h) => ({ id: h.id, text: h.textContent ?? "", level: h.dataset.toc! })));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [path]);

  if (items.length < 2) return <aside className="toc" />;
  return (
    <aside className="toc" aria-label="On this page">
      <p className="sidebar-heading">On this page</p>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={`toc-l${i.level}`} aria-current={active === i.id ? "location" : undefined}>
          {i.text}
        </a>
      ))}
    </aside>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>
          <span className="brand-mark" aria-hidden="true">
            ¶
          </span>{" "}
          output. MIT licensed.
        </span>
        <span>
          Set in Literata, Inter, and JetBrains Mono. Every paragraph on this site is typeset by the library it documents.
        </span>
      </div>
    </footer>
  );
}

const MoonIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
    <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
