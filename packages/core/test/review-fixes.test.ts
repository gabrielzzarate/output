// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createOutput } from "../src/output";
import { createTurn } from "../src/turn";
import { diffStats } from "../src/diff/patch";
import { renderPlainDiff } from "../src/diff/plain";
import { formatDuration } from "../src/views/tool-call";
import type { DiffRenderer } from "../src/diff/types";

const fake = (tag: string) =>
  ({
    render: vi.fn<DiffRenderer["render"]>((container) => {
      container.innerHTML = `<div class='${tag}'></div>`;
      return () => container.replaceChildren();
    }),
  }) satisfies DiffRenderer;

const patchFence = (n: string) => `\`\`\`diff\n--- a/${n}\n+++ b/${n}\n@@ -1 +1 @@\n-old\n+new\n\`\`\``;

describe("diff option changes", () => {
  it("swaps renderers on settled diffs without looping", async () => {
    const el = document.createElement("div");
    const out = createOutput(el, { diff: fake("one") });
    out.append(`Intro\n\n${patchFence("x.ts")}\n`);
    out.end();
    await out.flush();
    expect(el.querySelector(".one")).not.toBeNull();
    out.update({ diff: fake("two") });
    await out.flush();
    expect(el.querySelector(".one")).toBeNull();
    expect(el.querySelectorAll(".two")).toHaveLength(1);
  });
});

describe("blocks with several fences", () => {
  it("upgrades every diff fence and still treats the paragraphs", async () => {
    const el = document.createElement("div");
    const r = fake("d");
    const out = createOutput(el, { diff: r, justify: false });
    // A list item holding two fences and a paragraph is one block.
    out.append(`- first\n\n  ${patchFence("a.ts").replace(/\n/g, "\n  ")}\n\n  ${patchFence("b.ts").replace(/\n/g, "\n  ")}\n\n  after text\n`);
    out.end();
    await out.flush();
    expect(el.querySelectorAll(".ov-diff")).toHaveLength(2);
    expect(r.render).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain("after text");
  });

  it("keeps the surrounding text of a live block with a diff fence", async () => {
    const el = document.createElement("div");
    const out = createOutput(el, { diff: fake("d") });
    out.append(`- item one\n- item two\n\n  ${patchFence("a.ts").replace(/\n/g, "\n  ")}`);
    await out.flush();
    const live = el.querySelector("[data-ov-live]")!;
    expect(live.textContent).toContain("item one");
    expect(live.querySelector(".ov-diff")).not.toBeNull();
  });
});

describe("patch parsing", () => {
  it("reads '-- ' and '++ ' content lines inside a hunk as changes", () => {
    const patch = "--- a/q.sql\n+++ b/q.sql\n@@ -1,2 +1,2 @@\n--- old comment\n+++ new comment\n select 1;\n";
    expect(diffStats({ patch })).toEqual({ additions: 1, deletions: 1, name: "q.sql" });
    const box = document.createElement("div");
    box.innerHTML = renderPlainDiff({ patch });
    expect(box.querySelectorAll(".ov-diff-del")).toHaveLength(1);
    expect(box.querySelectorAll(".ov-diff-add")).toHaveLength(1);
  });

  it("ignores the trailing newline when counting file lines", () => {
    expect(diffStats({ oldFile: null, newFile: { name: "n.ts", contents: "a\nb\n" } })).toEqual({ additions: 2, deletions: 0, name: "n.ts" });
  });
});

describe("formatDuration", () => {
  it("never shows 0.0s or 60s", () => {
    expect(formatDuration(10)).toBe("<0.1s");
    expect(formatDuration(60)).toBe("0.1s");
    expect(formatDuration(9_960)).toBe("10s");
    expect(formatDuration(59_600)).toBe("1m 0s");
    expect(formatDuration(119_500)).toBe("2m 0s");
  });
});

describe("Turn.update", () => {
  it("applies a new diff renderer to tool diffs already on screen", () => {
    const el = document.createElement("div");
    const turn = createTurn(el);
    turn.setParts([{ type: "tool", id: "e", name: "edit_file", state: "done", input: { path: "a.ts", old_string: "a", new_string: "b" } }]);
    expect(el.querySelector(".ov-diff-plain")).not.toBeNull();
    const r = fake("pierre");
    turn.update({ diff: r });
    expect(el.querySelector(".pierre")).not.toBeNull();
    expect(el.querySelectorAll(".ov-tool")).toHaveLength(1);
  });
});

describe("diff color scheme", () => {
  it("re-renders a settled diff when the scheme changes", async () => {
    const host = document.createElement("div");
    host.dataset.ovScheme = "light";
    document.body.append(host);
    const r = fake("d");
    const out = createOutput(host, { diff: r });
    out.append(patchFence("x.ts") + "\n");
    out.end();
    await out.flush();
    const calls = r.render.mock.calls.length;
    host.dataset.ovScheme = "dark";
    await new Promise((res) => setTimeout(res, 0));
    expect(r.render.mock.calls.length).toBe(calls + 1);
    expect(r.render.mock.calls.at(-1)![2]).toMatchObject({ scheme: "dark" });
    out.destroy();
    host.remove();
  });
});
