# @nodiffjs/core

NoDiff is a small TypeScript package for rich-client apps that use TSX as browser syntax. It creates real DOM nodes, keeps updates explicit through store bindings, and includes helpers for zod-checked API data, localStorage caching, token auth, forms, routing, and security defaults.

This package is designed for a fork-first monorepo workflow. In this repository, the demo app aliases `@nodiffjs/core` directly to `packages/nodiff/src`, so framework and app edits update together during Vite development. The package build still emits a clean `dist` artifact for consumers, fixtures, and optional publishing.

## TSX Setup

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@nodiffjs/core"
  }
}
```

```tsx
import { catchRender, mount, text } from "@nodiffjs/core";
import { createStore } from "zustand/vanilla";

const counter = createStore(() => ({ count: 0 }));

function App() {
  return (
    <button onClick={() => counter.setState((state) => ({ count: state.count + 1 }))}>
      Count: {text(counter, (state) => state.count)}
    </button>
  );
}

mount("#app", catchRender({ render: App }));
```

## Package Entries

The root entry exports the public surface:

```ts
import { createApi, createRouter, mount, view } from "@nodiffjs/core";
```

Focused subpath entries are also available:

```ts
import { mount } from "@nodiffjs/core/dom";
import { createApi } from "@nodiffjs/core/api";
```

Automatic JSX runtime entries are exported at `@nodiffjs/core/jsx-runtime` and `@nodiffjs/core/jsx-dev-runtime`.

## Local Development

From the repository root:

```sh
bun install
bun run dev
```

The demo consumes source through Vite aliases. Edit `packages/nodiff/src` and `apps/demo/src` together; HMR stays on the TypeScript source path.

For package verification:

```sh
bun run build
cd packages/nodiff
npm --cache /private/tmp/npm-cache pack --dry-run
```
