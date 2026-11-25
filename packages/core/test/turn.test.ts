// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createTurn } from "../src/turn";
import { createOutput } from "../src/output";
import { normalizeParts } from "../src/parts/types";
import { diffFromToolCall, summarizeToolInput } from "../src/views/tool-diff";
import { humanize, formatDuration } from "../src/views/tool-call";
import type { DiffRenderer } from "../src/diff/types";

const tick = () => new Promise((r) => setTimeout(r, 30));

describe("normalizeParts", () => {
  it("maps AI SDK UI message parts", () => {
    const parts = normalizeParts([
      { type: "step-start" },
      { type: "reasoning", text: "hmm", state: "done" },
      { type: "tool-read_file", toolCallId: "t1", state: "output-available", input: { path: "a.ts" }, output: "x" },
      { type: "dynamic-tool", toolName: "search", toolCallId: "t2", state: "input-streaming" },
      { type: "tool-bash", toolCallId: "t3", state: "output-error", errorText: "boom" },
      { type: "text", text: "Done.", state: "streaming" },
    ]);
    expect(parts.map((p) => p.type)).toEqual(["reasoning", "tool", "tool", "tool", "text"]);
    expect(parts[1]).toMatchObject({ name: "read_file", state: "done", id: "t1" });
    expect(parts[2]).toMatchObject({ name: "search", state: "pending" });
    expect(parts[3]).toMatchObject({ state: "error", error: "boom" });
  });
});

describe("tool helpers", () => {
  it("finds edits in common tool shapes", () => {
    expect(diffFromToolCall({ type: "tool", id: "1", name: "Edit", state: "done", input: { file_path: "a.ts", old_string: "a", new_string: "b" } })).toEqual({
      oldFile: { name: "a.ts", contents: "a" },
      newFile: { name: "a.ts", contents: "b" },
    });
    expect(diffFromToolCall({ type: "tool", id: "2", name: "write_file", state: "done", input: { path: "n.ts", content: "x" } })).toEqual({
      oldFile: null,
      newFile: { name: "n.ts", contents: "x" },
    });
    expect(diffFromToolCall({ type: "tool", id: "3", name: "apply", state: "done", input: { patch: "@@ -1 +1 @@\n-a\n+b\n" } })).toEqual({ patch: "@@ -1 +1 @@\n-a\n+b\n" });
    expect(diffFromToolCall({ type: "tool", id: "4", name: "read_file", state: "done", input: { path: "a.ts" }, output: "hello" })).toBeNull();
  });

  it("summarises inputs and names", () => {
    expect(summarizeToolInput({ command: "pnpm test\n--watch" })).toBe("pnpm test");
    expect(summarizeToolInput({ limit: 3, path: "src/a.ts" })).toBe("src/a.ts");
    expect(humanize("read_file")).toBe("Read file");
    expect(humanize("webSearch")).toBe("Web search");
    expect(humanize("mcp__github__create_issue")).toBe("Create issue");
    expect(formatDuration(420)).toBe("0.4s");
    expect(formatDuration(75_000)).toBe("1m 15s");
  });
});

describe("createTurn", () => {
  it("renders reasoning, tool calls, edits as diffs, and text in order", async () => {
    const el = document.createElement("div");
    const turn = createTurn(el, { justify: false });
    turn.setParts(
      [
        { type: "reasoning", text: "Looking at the **retry** helper", state: "streaming" },
      ],
      { streaming: true },
    );
    await tick();
    const reasoning = el.querySelector<HTMLDetailsElement>(".ov-reasoning")!;
    expect(reasoning.open).toBe(true);
    expect(reasoning.textContent).toContain("Thinking");

    turn.setParts(
      [
        { type: "reasoning", text: "Looking at the **retry** helper", state: "done", durationMs: 4200 },
        { type: "tool", id: "a", name: "read_file", state: "done", input: { path: "src/retry.ts" }, output: "…", durationMs: 380 },
        { type: "tool", id: "b", name: "Edit", state: "running", input: { file_path: "src/retry.ts", old_string: "a\nb", new_string: "a\nc" } },
        { type: "text", text: "Fixed the **race**." },
      ],
      { streaming: true },
    );
    await tick();
    expect(reasoning.open).toBe(false);
    expect(reasoning.textContent).toContain("Thought for 4.2s");
    const kids = [...el.children].map((c) => c.className.split(" ")[0]);
    expect(kids).toEqual(["ov-reasoning", "ov-tool", "ov-tool", "ov-output"]);
    const [read, edit] = el.querySelectorAll(".ov-tool");
    expect(read!.querySelector(".ov-tool-name")!.textContent).toBe("Read file");
    expect(read!.querySelector(".ov-tool-arg")!.textContent).toBe("src/retry.ts");
    expect(read!.querySelector(".ov-tool-meta")!.textContent).toBe("0.4s");
    expect(edit!.querySelector(".ov-diff .ov-diff-add-n")!.textContent).toBe("+1");
    expect(edit!.querySelector(".ov-diff-plain")).not.toBeNull();
    expect(el.querySelector(":scope > .ov-output strong")!.textContent).toBe("race");
  });

  it("keeps a reader's choice to reopen reasoning", async () => {
    const el = document.createElement("div");
    const turn = createTurn(el);
    turn.setParts([{ type: "reasoning", text: "a", state: "streaming" }]);
    turn.setParts([{ type: "reasoning", text: "ab", state: "done" }]);
    const details = el.querySelector<HTMLDetailsElement>(".ov-reasoning")!;
    expect(details.open).toBe(false);
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    turn.setParts([{ type: "reasoning", text: "abc", state: "done" }]);
    expect(details.open).toBe(true);
  });

  it("shows input and output when a tool row is expanded", () => {
    const el = document.createElement("div");
    const turn = createTurn(el);
    turn.setParts([{ type: "tool", id: "x", name: "bash", state: "error", input: { command: "ls" }, error: "denied" }]);
    const details = el.querySelector<HTMLDetailsElement>(".ov-tool-details")!;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(el.querySelector(".ov-tool-section code")!.textContent).toContain('"command": "ls"');
    expect(el.querySelector(".ov-tool-error pre")!.textContent).toBe("denied");
    expect(el.querySelector(".ov-tool-meta")!.textContent).toBe("Failed");
  });

  it("removes parts that disappear and reorders the rest", () => {
    const el = document.createElement("div");
    const turn = createTurn(el);
    turn.setParts([{ type: "text", id: "1", text: "one" }, { type: "text", id: "2", text: "two" }]);
    const second = el.children[1];
    turn.setParts([{ type: "text", id: "2", text: "two" }]);
    expect(el.children).toHaveLength(1);
    expect(el.children[0]).toBe(second);
  });
});

describe("diff fences", () => {
  const fence = "Here is the change:\n\n```diff\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n```\n";

  it("hands settled patches to the diff renderer and uses the plain view while live", async () => {
    const render = vi.fn<DiffRenderer["render"]>((container) => {
      container.innerHTML = "<div class='fake-diff'></div>";
      return () => container.replaceChildren();
    });
    const el = document.createElement("div");
    const out = createOutput(el, { diff: { render } });
    out.append(fence.slice(0, fence.indexOf("+new")));
    await out.flush();
    expect(el.querySelector("[data-ov-live] .ov-diff .ov-diff-plain")).not.toBeNull();
    expect(render).not.toHaveBeenCalled();
    out.append(fence.slice(fence.indexOf("+new")));
    out.end();
    await out.flush();
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0]![1]).toEqual({ patch: "--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n" });
    expect(el.querySelector(".ov-diff-name")!.textContent).toBe("x.ts");
    expect(el.querySelector(".fake-diff")).not.toBeNull();
    expect(el.querySelectorAll(".ov-diff")).toHaveLength(1);
  });

  it("leaves ordinary diff-labelled code as code", async () => {
    const el = document.createElement("div");
    const out = createOutput(el);
    out.setText("```diff\njust some text\n```\n", { done: true });
    await out.flush();
    expect(el.querySelector(".ov-code")).not.toBeNull();
    expect(el.querySelector(".ov-diff")).toBeNull();
  });
});
