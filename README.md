# mini-ria

A tiny no-VDOM TypeScript UI framework plus a demo rich-client app. The demo uses Vite 8, Bun workspaces, TSX automatic JSX runtime, zod, and zustand/vanilla.

## Run

```sh
bun install
bun run dev
```

Open the Vite URL printed by the dev server.

## Build

```sh
bun run build
```

## Typecheck

Uses TypeScript 7 native preview through `tsgo`.

```sh
bun run typecheck
```

## Lint

```sh
bun run lint
```

## Format

```sh
bun run format
```

## Check

```sh
bun run check
```

## What is included

- `@mini-ria/core`: direct DOM TSX runtime, mount/unmount lifecycle, actions, store bindings, localStorage cache, zod-backed fetch client, token auth, resource store, router, and zod form helpers.
- `@mini-ria/demo`: modern browser app using only Vite, Bun, zod, zustand/vanilla, and this framework.

## TSX without React

The app configures TypeScript with:

```json
{
  "jsx": "react-jsx",
  "jsxImportSource": "@mini-ria/core"
}
```

That makes TSX compile to imports from `@mini-ria/core/jsx-runtime`. Those functions create real DOM nodes immediately. There is no virtual DOM layer.

## Monorepo

```txt
mini-ria/
  packages/ria/     framework package
  apps/demo/        rich-client demo app
```

## Framework features

- TSX runtime: `jsx`, `jsxs`, `Fragment`.
- DOM primitives: `mount`, `append`, `fragment`, cleanup-aware actions.
- Store bindings: `text`, `view`, `when`, `list`, `bind.text`, `bind.attr`, `bind.class`, `bind.value`, `bind.checked`.
- Data: `createApi`, `ApiError`, zod response parsing, JSON body handling, query strings, auth headers, 401 hook, refresh hook.
- Cache: localStorage envelopes with TTL, tags, stale reads, schema validation.
- Auth: localStorage-backed bearer token store using zustand/vanilla.
- Resource: loading, success, error, stale, abort, refresh, mutate.
- Router: hash or history mode, typed route context, link component, active link class.
- Forms: zod-backed form submit action with native validity messages.

## Demo routes

- Home: direct DOM TSX, persisted counter, theme preference.
- Posts: zod-validated API fetch, localStorage cache, search, stale status.
- Auth: fake token login, persisted bearer header support.
- Cache: inspect and clear localStorage keys.
