import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (p: string) => new URL(p, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Work against package sources so edits show up instantly.
    alias: [
      { find: /^@output\/core$/, replacement: src("../../packages/core/src/index.ts") },
      { find: /^@output\/core\/shiki$/, replacement: src("../../packages/core/src/shiki.ts") },
      { find: /^@output\/react$/, replacement: src("../../packages/react/src/index.tsx") },
    ],
  },
});
