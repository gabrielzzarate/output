import { defineConfig } from "vitest/config";
export default defineConfig({ resolve: { alias: { "@output/core": new URL("../core/src/index.ts", import.meta.url).pathname } } });
