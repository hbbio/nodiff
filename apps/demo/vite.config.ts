import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  resolve: {
    alias: [
      {
        find: "@nodiffjs/core/jsx-runtime",
        replacement: fileURLToPath(
          new URL("../../packages/nodiff/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: "@nodiffjs/core/jsx-dev-runtime",
        replacement: fileURLToPath(
          new URL("../../packages/nodiff/src/jsx-dev-runtime.ts", import.meta.url),
        ),
      },
      {
        find: "@nodiffjs/core",
        replacement: fileURLToPath(new URL("../../packages/nodiff/src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
