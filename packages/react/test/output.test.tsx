// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Output } from "../src/index";
import type { Output as Handle } from "@output/core";

describe("<Output>", () => {
  it("renders a growing string and settles when streaming stops", async () => {
    const ref = createRef<Handle | null>();
    const { container, rerender } = render(<Output ref={ref} source="Hello **wor" streaming />);
    await act(() => ref.current!.flush());
    expect(container.querySelector("[data-ov-live] strong")?.textContent).toBe("wor");
    rerender(<Output ref={ref} source="Hello **world**." streaming={false} />);
    await act(() => ref.current!.flush());
    expect(container.querySelector("[data-ov-settled] strong")?.textContent).toBe("world");
    expect(container.querySelector("[data-ov-live]")).toBeNull();
  });

  it("pumps an async iterable", async () => {
    async function* chunks() {
      yield "# Ti";
      yield "tle\n\nBody";
    }
    const ref = createRef<Handle | null>();
    let done = false;
    const { container } = render(<Output ref={ref} source={chunks()} onDone={() => (done = true)} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
      await ref.current!.flush();
    });
    expect(done).toBe(true);
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("p")?.textContent).toBe("Body");
  });

  it("applies theme and scheme", () => {
    const { container } = render(<Output source="x" theme="compact" scheme="dark" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.ovTheme).toBe("compact");
    expect(root.dataset.ovScheme).toBe("dark");
  });
});
