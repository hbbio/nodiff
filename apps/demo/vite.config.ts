import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  resolve: {
    alias: [
      {
        find: "@mini-ria/core/jsx-runtime",
        replacement: fileURLToPath(
          new URL("../../packages/ria/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: "@mini-ria/core/jsx-dev-runtime",
        replacement: fileURLToPath(
          new URL("../../packages/ria/src/jsx-dev-runtime.ts", import.meta.url),
        ),
      },
      {
        find: "@mini-ria/core",
        replacement: fileURLToPath(new URL("../../packages/ria/src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
