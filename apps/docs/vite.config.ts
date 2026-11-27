import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (p: string) => new URL(p, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Work against package sources so the docs always describe the code in this repo.
    alias: [
      { find: /^@output\/core$/, replacement: src("../../packages/core/src/index.ts") },
      { find: /^@output\/core\/shiki$/, replacement: src("../../packages/core/src/shiki.ts") },
      { find: /^@output\/core\/diffs$/, replacement: src("../../packages/core/src/diffs.ts") },
      { find: /^@output\/react$/, replacement: src("../../packages/react/src/index.tsx") },
    ],
  },
});
