// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createOutput } from "../src/output";

describe("createOutput", () => {
  it("renders streamed markdown into blocks and settles them on end", async () => {
    const el = document.createElement("div");
    const out = createOutput(el, { justify: false });
    for (const chunk of ["# Hel", "lo\n\nSome **bo", "ld** text.\n\n```js\nconst a", " = 1;\n```\n"]) {
      out.append(chunk);
      await out.flush();
    }
    expect(el.querySelector("[data-ov-live] p")).toBeNull();
    out.end();
    await out.flush();
    expect(el.querySelectorAll(".ov-block[data-ov-settled]")).toHaveLength(3);
    expect(el.querySelector("[data-ov-live]")).toBeNull();
    expect(el.querySelector("h1")?.textContent).toBe("Hello");
    expect(el.querySelector("strong")?.textContent).toBe("bold");
    expect(el.querySelector("code")?.textContent).toBe("const a = 1;");
  });

  it("repairs the live block so raw markdown never shows", async () => {
    const el = document.createElement("div");
    const out = createOutput(el);
    out.append("Some **bold");
    await out.flush();
    expect(el.textContent?.trim()).toBe("Some bold");
    expect(el.querySelector("[data-ov-live] strong")?.textContent).toBe("bold");
  });

  it("does not re-render settled blocks", async () => {
    const el = document.createElement("div");
    const out = createOutput(el);
    out.append("First.\n\nSecond");
    await out.flush();
    const first = el.querySelector(".ov-block[data-ov-settled]")!;
    out.append(" grows and grows.\n\nThird");
    await out.flush();
    expect(el.querySelector(".ov-block[data-ov-settled]")).toBe(first);
  });

  it("setText appends only the new part, and restarts when text diverges", async () => {
    const el = document.createElement("div");
    const out = createOutput(el);
    out.setText("Hello");
    out.setText("Hello world");
    await out.flush();
    expect(out.text).toBe("Hello world");
    out.setText("Different", { done: true });
    await out.flush();
    expect(el.textContent?.trim()).toBe("Different");
    expect(out.ended).toBe(true);
  });

  it("runs the highlighter on settled code only", async () => {
    const el = document.createElement("div");
    const calls: string[] = [];
    const out = createOutput(el, {
      highlight: async (code, lang) => {
        calls.push(lang);
        return `<span class="hl">${code}</span>`;
      },
    });
    out.append("```py\nprint(1)");
    await out.flush();
    expect(calls).toEqual([]);
    out.append("\n```\n");
    out.end();
    await out.flush();
    expect(calls).toEqual(["py"]);
    expect(el.querySelector(".hl")).not.toBeNull();
  });

  it("sets theme and justification attributes", () => {
    const el = document.createElement("div");
    const out = createOutput(el, { theme: "compact" });
    expect(el.dataset.ovTheme).toBe("compact");
    expect(el.dataset.ovJustify).toBe("auto");
    out.update({ theme: "reader", justify: false });
    expect(el.dataset.ovTheme).toBe("reader");
    expect(el.dataset.ovJustify).toBe("false");
    out.destroy();
    expect(el.classList.contains("ov-output")).toBe(false);
  });
});
