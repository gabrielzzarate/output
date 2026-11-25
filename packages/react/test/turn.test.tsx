// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Turn } from "../src/index";

const tick = () => act(() => new Promise((r) => setTimeout(r, 30)));

describe("<Turn>", () => {
  it("renders AI SDK parts as reasoning, tool calls, diffs, and text", async () => {
    const parts = [
      { type: "reasoning", text: "Checking the helper", state: "done" },
      { type: "tool-read_file", toolCallId: "1", state: "output-available", input: { path: "src/retry.ts" }, output: "…" },
      { type: "tool-edit", toolCallId: "2", state: "output-available", input: { file_path: "src/retry.ts", old_string: "a", new_string: "b" } },
      { type: "text", text: "Fixed **it**." },
    ];
    const { container } = render(<Turn parts={parts} scheme="dark" />);
    await tick();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("ov-turn");
    expect(root.dataset.ovScheme).toBe("dark");
    expect(container.querySelectorAll(".ov-tool")).toHaveLength(2);
    expect(container.querySelector(".ov-tool-name")!.textContent).toBe("Read file");
    expect(container.querySelector(".ov-diff-name")!.textContent).toBe("src/retry.ts");
    expect(container.querySelector(".ov-reasoning")).not.toBeNull();
    expect(container.querySelector(".ov-output strong")?.textContent).toBe("it");
  });

  it("updates a tool call as it progresses", async () => {
    const call = (state: string) => [{ type: "tool-bash", toolCallId: "1", state, input: { command: "pnpm test" } }];
    const { container, rerender } = render(<Turn parts={call("input-available")} streaming />);
    expect(container.querySelector(".ov-tool")!.getAttribute("data-ov-state")).toBe("running");
    rerender(<Turn parts={call("output-available")} streaming={false} />);
    expect(container.querySelector(".ov-tool")!.getAttribute("data-ov-state")).toBe("done");
  });

  it("lets apps replace a part's component", () => {
    const { container } = render(
      <Turn
        parts={[{ type: "tool", id: "x", name: "search", state: "done", input: { q: "fonts" } }]}
        components={{ ToolCall: ({ call }) => <p className="mine">{call.name}</p> }}
      />,
    );
    expect(container.querySelector(".mine")!.textContent).toBe("search");
    expect(container.querySelector(".ov-tool")).toBeNull();
  });

  it("applies custom tool labels", () => {
    const { container } = render(
      <Turn parts={[{ type: "tool", id: "x", name: "search", state: "done", input: { q: "fonts" } }]} tools={{ label: () => "Searched the web" }} />,
    );
    expect(container.querySelector(".ov-tool-name")!.textContent).toBe("Searched the web");
  });
});
