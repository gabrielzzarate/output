import { describe, expect, it } from "vitest";
import { BlockStream } from "../src/stream/blocks";

const doc = `# Title

First paragraph with **bold** text.

- one
- two

\`\`\`ts
const x = 1;
\`\`\`

Last paragraph.`;

function streamInChunks(text: string, size: number) {
  const s = new BlockStream();
  const settled: string[] = [];
  const lives: (string | null)[] = [];
  for (let i = 0; i < text.length; i += size) {
    const u = s.append(text.slice(i, i + size));
    settled.push(...u.settled.map((b) => b.type));
    lives.push(u.live?.type ?? null);
  }
  const final = s.end();
  settled.push(...final.settled.map((b) => b.type));
  return { settled, lives, final };
}

describe("BlockStream", () => {
  it.each([1, 3, 7, 50, 1000])("settles every block exactly once with chunk size %i", (size) => {
    const { settled, final } = streamInChunks(doc, size);
    expect(settled).toEqual(["heading", "paragraph", "list", "code", "paragraph"]);
    expect(final.live).toBeNull();
  });

  it("keeps the last block live until something follows it", () => {
    const s = new BlockStream();
    let u = s.append("Hello there.\n\n");
    expect(u.settled).toHaveLength(0);
    expect(u.live?.raw).toContain("Hello there.");
    u = s.append("Next");
    expect(u.settled.map((b) => b.raw.trim())).toEqual(["Hello there."]);
    expect(u.live?.raw).toBe("Next");
  });

  it("keeps an unclosed code fence live", () => {
    const s = new BlockStream();
    const u = s.append("```js\nconst a = 1;\n\nconst b = 2;\n");
    expect(u.settled).toHaveLength(0);
    expect(u.live?.type).toBe("code");
  });

  it("gives a settling block the id it had while live", () => {
    const s = new BlockStream();
    const liveId = s.append("Para one").live!.id;
    const u = s.append("\n\nPara two");
    expect(u.settled[0]!.id).toBe(liveId);
    expect(u.live!.id).toBe(liveId + 1);
  });

  it("does not split a loose list while it streams", () => {
    const s = new BlockStream();
    s.append("- a\n\n");
    const u = s.append("- b\n\n");
    expect(u.settled).toHaveLength(0);
    expect(u.live?.type).toBe("list");
  });

  it("normalises Windows line endings", () => {
    const s = new BlockStream();
    s.append("A\r\n\r\nB");
    expect(s.source).toBe("A\n\nB");
  });
});
