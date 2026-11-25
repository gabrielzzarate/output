import { describe, expect, it } from "vitest";
import { diffStats, isPatch, toPatch } from "../src/diff/patch";
import { renderPlainDiff } from "../src/diff/plain";

const patch = `--- a/src/retry.ts
+++ b/src/retry.ts
@@ -1,3 +1,3 @@
 export function retry() {
-  const delay = state.backoff * 2;
+  const delay = nextBackoff(state);
 }
`;

describe("patch helpers", () => {
  it("recognises unified patches but not ordinary code", () => {
    expect(isPatch(patch)).toBe(true);
    expect(isPatch("@@ -1 +1 @@\n-a\n+b")).toBe(true);
    expect(isPatch("const a = 1;\n- not a diff")).toBe(false);
  });

  it("counts changes and finds the file name", () => {
    expect(diffStats({ patch })).toEqual({ additions: 1, deletions: 1, name: "src/retry.ts" });
  });

  it("builds a patch from two file versions", () => {
    const out = toPatch({
      oldFile: { name: "a.ts", contents: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\n" },
      newFile: { name: "a.ts", contents: "one\ntwo\nTHREE\nfour\nfive\nsix\nseven\neight\nNINE\n" },
    }, 1);
    expect(out).toContain("--- a/a.ts\n+++ b/a.ts");
    expect(out).toContain("@@ -2,3 +2,3 @@\n two\n-three\n+THREE\n four");
    expect(out).toContain("@@ -8,2 +8,2 @@\n eight\n-nine\n+NINE");
  });

  it("treats a new file as all additions", () => {
    const stats = diffStats({ oldFile: null, newFile: { name: "n.ts", contents: "a\nb" } });
    expect(stats).toEqual({ additions: 2, deletions: 0, name: "n.ts" });
    expect(toPatch({ oldFile: null, newFile: { name: "n.ts", contents: "a\nb" } })).toContain("@@ -0,0 +1,2 @@\n+a\n+b");
  });

  it("renders a plain diff with line numbers and escaped text", () => {
    const html = renderPlainDiff({ patch: patch.replace("state)", "state) < 1") });
    expect(html).toContain('class="ov-diff-del"');
    expect(html).toContain('class="ov-diff-add"');
    expect(html).toContain("&lt; 1");
    expect(html).not.toContain("+++");
  });
});
