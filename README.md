# NoDiff

A tiny TypeScript framework for rich-client apps that treats TSX as browser syntax.

In the LLM era, you do not need a fat web framework for every browser app. You often want a lean runtime that lives in the same monorepo as your app and evolves with it. That shape is easier for people and coding agents to integrate, inspect, change, and reason about. Fewer hidden layers means fewer bugs, faster feedback, and less time spent reverse-engineering framework behavior.

NoDiff gives you JSX ergonomics, real DOM nodes, explicit store subscriptions, zod-checked data, localStorage caching, token auth, forms, and routing. It does this without React, axios, a virtual DOM, a scheduler, or a framework runtime that owns your app.

The whole idea is small enough to keep in your head:

```tsx
const counter = createStore(() => ({ count: 0 }));

function App() {
  return (
    <button onClick={() => counter.setState((state) => ({ count: state.count + 1 }))}>
      Count: {text(counter, (state) => state.count)}
    </button>
  );
}

mount("#app", App);
```

TSX compiles through Vite into calls to `@nodiffjs/core/jsx-runtime`. Those calls create real DOM nodes. Stores decide when small regions update. Data enters the app through zod schemas. Cache entries carry expiry. Auth is just a bearer header helper over a persisted token.

This repo contains both the framework package and a demo app.

```txt
nodiff/
  packages/nodiff/   framework package, published name @nodiffjs/core
  apps/demo/         demo rich-client app
```

## Why this exists

Modern front-end apps often begin with a large default stack. A JSX renderer. A request client. A router. A global state tool. A form library. A cache layer. Auth glue. Then the browser shows up at the end.

NoDiff starts from the other side.

The browser already has:

- a mutable DOM tree
- event listeners
- custom validity on forms
- `fetch`
- `AbortController`
- `localStorage`
- `history` and `hashchange`
- native modules

The missing piece is a clean TypeScript surface that makes those primitives pleasant enough for a real app.

NoDiff is that surface. It keeps the familiar parts of a modern app, such as TSX, typed stores, schema-checked data, cached reads, and route components, while making each moving part visible.

## The core bet

TSX is useful even when React is absent.

With this config:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@nodiffjs/core"
  }
}
```

this:

```tsx
<section class="panel">
  <h1>Hello</h1>
  <button onClick={save}>Save</button>
</section>
```

compiles to calls into this package:

```ts
import { jsx, jsxs } from "@nodiffjs/core/jsx-runtime";
```

The runtime creates `HTMLElement` instances directly, applies props, attaches event listeners, runs actions, and appends children. No virtual DOM tree is built. No diff pass runs. No component replay is needed for a button click.

State-driven parts opt in explicitly:

```tsx
<p>{text(session, (state) => state.user?.name ?? "anonymous")}</p>;

{
  view(
    posts,
    (state) => state.visible,
    (items) => (
      <ul>
        {items.map((item) => (
          <li>{item.title}</li>
        ))}
      </ul>
    ),
  );
}
```

You can read the code for those pieces in a few files.

## What you get

| Area           | Included                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| TSX runtime    | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, intrinsic element typing                  |
| DOM            | `mount`, `append`, direct node creation, events, refs, actions                 |
| Lifecycle      | cleanup on unmount and region redraw                                           |
| State bindings | `text`, `view`, `when`, `Show`, `list`, `For`, `effect`, `bind.*`              |
| Stores         | works with `zustand/vanilla` and any compatible store shape                    |
| API client     | `fetch`, query params, JSON body handling, zod parsing, auth headers, 401 hook |
| Cache          | localStorage envelopes with TTL, tags, stale reads, schema validation          |
| Auth           | persisted bearer token controller over zustand vanilla                         |
| Resource state | loading, stale, success, error, abort, refresh, mutate                         |
| Router         | hash or history mode, route params, query params, active links                 |
| Forms          | zod-backed submit action, native validity messages                             |
| Tooling        | Bun workspaces, Vite 8, TypeScript 7 native preview, oxlint, oxfmt             |

## Run it

Prerequisite: Bun.

```sh
bun install
bun run dev
```

Open the local Vite URL printed in the terminal.

Useful commands:

```sh
bun run typecheck
bun run lint
bun run format
bun run check
bun run build
```

The root scripts run the framework package first, then the demo app where that ordering matters.

## Current toolchain

The repo is intentionally modern:

- Bun workspaces with dependency versions centralized in the root catalog
- Vite 8 for the demo app
- TypeScript 7 native preview through `@typescript/native-preview` and `tsgo`
- oxlint with type-aware linting through `oxlint-tsgolint`
- oxfmt for formatting
- ES2022 browser target

`bun run check` runs strict typechecking, type-aware linting, and format checking.

## The demo app

The demo is intentionally plain. It shows the framework surface without hiding it behind another abstraction.

| Route    | What it demonstrates                                                         |
| -------- | ---------------------------------------------------------------------------- |
| `/`      | direct DOM TSX, persisted zustand state, live text binding, theme preference |
| `/posts` | zod-validated API data, cached GET request, resource state, search binding   |
| `/auth`  | fake token login, persisted bearer token, auth headers, zod form submit      |
| `/cache` | cache key inspection, localStorage clearing, auth reset                      |

The API data comes from JSONPlaceholder. The app parses every post through zod before it enters UI state.

## Tutorial: build the mental model

This section walks through the app from zero to a useful screen.

### 1. Create a store

NoDiff does not ship its own state container. It expects a simple vanilla store shape:

```ts
interface ReadableStore<T> {
  getState(): T;
  subscribe(listener: (state: T, previous: T) => void): () => void;
}
```

That is the shape exposed by `zustand/vanilla`.

```ts
import { createStore } from "zustand/vanilla";

const preferences = createStore(() => ({
  count: 0,
  search: "",
  theme: "system" as "system" | "light" | "dark",
}));
```

### 2. Render real DOM with TSX

A component is just a function that returns a child value. A child can be a node, text, a fragment, an array, `null`, or another component result.

```tsx
function HomePage() {
  return (
    <section class="panel">
      <h1>Direct DOM TSX</h1>
      <button onClick={() => preferences.setState((state) => ({ count: state.count + 1 }))}>
        Increment
      </button>
    </section>
  );
}
```

`onClick` becomes `addEventListener("click", ...)`. When the node is removed by `mount`, `view`, or another cleanup-aware path, the listener is removed too.

### 3. Bind text to state

Use `text` when only a text node needs to change.

```tsx
<p>Count: {text(preferences, (state) => state.count)}</p>
```

This creates one `Text` node and subscribes it to the store. When `count` changes, the node data changes. The surrounding paragraph stays in place.

### 4. Bind form controls

`bind.value` keeps an input and a store field in sync.

```tsx
<input
  placeholder="Search"
  use={bind.value(
    preferences,
    (state) => state.search,
    (search) => ({ search }),
  )}
/>
```

The `use` prop accepts an action. An action receives an element and may return cleanup.

```ts
const focusOnMount: Action<HTMLInputElement> = (input) => {
  input.focus();
};
```

```tsx
<input use={focusOnMount} />
```

Actions are the main escape hatch. Use them for observers, subscriptions, custom events, animations, third-party widgets, and anything else that attaches behavior to a node.

### 5. Redraw a region

Use `view` when a region depends on state.

```tsx
{
  view(
    postsVm,
    (state) => state.visible,
    (posts) => (
      <div class="post-list">
        {posts.map((post) => (
          <article class="post-card">
            <h2>{post.title}</h2>
            <p>{post.body}</p>
          </article>
        ))}
      </div>
    ),
  );
}
```

`view` places two comment markers in the DOM. When the selected value changes, it removes the nodes between those markers, runs cleanup for them, and inserts freshly rendered nodes.

This is intentionally simple. For small and medium regions it is easy to reason about. For keyed lists that should preserve stable rows across insertions, removals, and reorders, use `For`.

```tsx
{
  For({
    store: postsVm,
    each: (state) => state.visible,
    by: (post) => post.id,
    fallback: <p>No posts match this filter.</p>,
    children: (post) => (
      <article class="post-card">
        <h2>{post.title}</h2>
        <p>{post.body}</p>
      </article>
    ),
  });
}
```

The `by` function is used instead of a `key` prop because JSX treats `key` as special metadata. Rows with the same key and the same item identity are moved in place. Rows with changed item identity are redrawn and cleaned up.

### 6. Parse API data at the edge

The API client wraps `fetch` and accepts a zod schema.

```ts
import { z } from "zod";

const PostSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});

const PostsSchema = z.array(PostSchema);

const api = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
});

const posts = await api.get("/posts", {
  schema: PostsSchema,
});
```

Parsed data is typed. Bad data fails before it reaches your UI.

### 7. Add cache with TTL

Create a cache once:

```ts
const apiCache = createLocalCache("demo:http:");

const api = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
  cache: apiCache,
});
```

Then cache a request:

```ts
const posts = await api.get("/posts", {
  schema: PostsSchema,
  cache: {
    key: "posts",
    ttl: 5 * 60 * 1000,
    swr: true,
    tags: ["posts"],
  },
});
```

Cache entries look like this:

```ts
type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
  expiresAt: number | null;
  tags: string[];
};
```

When a schema is passed on read, cached data is parsed again. Corrupt or outdated cache shapes are removed.

### 8. Wrap loading and errors in a resource

`createResource` gives you a zustand store around an async function.

```ts
const posts = createResource({
  immediate: true,
  load: (_args, { signal }) =>
    api.get("/posts", {
      signal,
      schema: PostsSchema,
      cache: { key: "posts", ttl: 300_000, swr: true },
    }),
});
```

The resource state is explicit:

```ts
type ResourceState<T> = {
  status: "idle" | "loading" | "success" | "error";
  data: T | null;
  error: Error | null;
  updatedAt: number | null;
  loading: boolean;
  stale: boolean;
};
```

Render it with `view`:

```tsx
{
  view(
    posts.store,
    (state) => state,
    (state) => {
      if (state.loading && !state.data) return <p>Loading...</p>;
      if (state.error && !state.data) return <pre>{state.error.message}</pre>;
      return <PostList posts={state.data ?? []} />;
    },
  );
}
```

### 9. Add token auth

`createAuth` stores a token in localStorage and exposes helpers for the API client.

```ts
const auth = createAuth<{ email: string; name: string }>({
  storageKey: "demo:auth",
});

const api = createApi({
  baseUrl: "/api",
  getAuthHeaders: auth.authHeaders,
  onUnauthorized: () => auth.logout(),
});
```

Set a token after login:

```ts
auth.setToken(
  {
    accessToken: "token-from-server",
    expiresAt: Date.now() + 60 * 60 * 1000,
  },
  { email: "demo@example.com", name: "demo" },
);
```

Make a protected request:

```ts
await api.get("/me", {
  auth: "required",
  schema: UserSchema,
});
```

The auth helper is intentionally narrow. It handles bearer token storage and headers. Your app still owns login, refresh policy, CSRF posture, secure cookie decisions, and server protocol.

### 10. Add a router

Routes are data:

```tsx
const router = createRouter(
  [
    { path: "/", title: "Home", component: HomePage },
    { path: "/posts", title: "Posts", component: PostsPage },
    { path: "/posts/:id", title: "Post", component: PostPage },
  ],
  { mode: "hash" },
);
```

Render the outlet:

```tsx
function App() {
  const Link = (props: Parameters<typeof router.Link>[0]) => router.Link(props);

  return (
    <main>
      <nav>
        <Link to="/" exact activeClass="active">
          Home
        </Link>
        <Link to="/posts" activeClass="active">
          Posts
        </Link>
      </nav>
      {router.outlet()}
    </main>
  );
}

router.start();
mount("#app", App);
```

Route params and query params arrive in the component context:

```tsx
function PostPage(ctx: RouteContext) {
  return <h1>Post {ctx.params.id}</h1>;
}
```

### 11. Handle forms with zod

`zodSubmit` converts `FormData` to an object, parses it, and sends zod issues into native form validity where possible.

```tsx
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  return (
    <form use={zodSubmit(LoginSchema, login)}>
      <input name="email" type="email" autocomplete="email" />
      <input name="password" type="password" autocomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

For numeric fields, use zod coercion because browser form values are strings:

```ts
const ProfileSchema = z.object({
  age: z.coerce.number().int().min(13),
});
```

## The framework API

### DOM and JSX

```ts
jsx(type, props);
jsxs(type, props);
jsxDEV(type, props);
Fragment(props);
mount(host, componentOrNode, props?);
append(parent, child);
fragment(children?);
on(type, handler, options?);
setText(value);
```

Common props:

```tsx
<div
  class={{ active: true, muted: false }}
  style={{ display: "grid", gap: "1rem" }}
  dataset={{ id: 123 }}
  aria={{ busy: false }}
  unsafeHTML={"<strong>trusted markup only</strong>"}
  ref={(node) => console.log(node)}
  use={(node) => () => console.log("cleanup", node)}
  onClick={(event) => console.log(event.currentTarget)}
/>
```

Raw HTML must use `unsafeHTML`. The ordinary `innerHTML` prop is rejected so HTML injection is
visible at the call site.

Events are inferred from `onX` prop names. `onClick` maps to `click`, `onInput` maps to `input`, and so on.

### Store bindings

```ts
text(store, selector, format?, equality?);
view(store, selector, render, options?);
when(store, predicate, yes, no?);
Show({ store, when, children, fallback?, equality? });
list(store, selector, render, options?);
For({ store, each, by, children, fallback?, equality? });
effect(store, selector, run, equality?);
subscribeSelector(store, selector, listener, equality?);
```

`bind` helpers:

```ts
bind.text(store, selector, format?, equality?);
bind.attr(name, store, selector, equality?);
bind.class(name, store, selector, equality?);
bind.value(store, selector, commit, options?);
bind.checked(store, selector, commit, equality?);
```

Use `text` for inline text nodes. Use `bind.text` when the element already exists and should receive `textContent`. Use `view` for regions. Use `effect` for side effects tied to a node lifecycle.

### Cache

```ts
const cache = createLocalCache("app:");

cache.set("preferences", value, {
  ttl: 24 * 60 * 60 * 1000,
  tags: ["preferences"],
});

const entry = cache.get("preferences", PreferencesSchema, {
  allowStale: true,
});

cache.remove("preferences");
cache.clearTag("preferences");
cache.clear();
cache.keys();
```

The cache is for client-side convenience, not durable storage. It is best for preferences, response snapshots, and quick reloads.

### API

```ts
const api = createApi({
  baseUrl: "/api",
  headers: { "X-App": "demo" },
  cache,
  getAuthHeaders: auth.authHeaders,
  refreshAuth: refreshToken,
  onUnauthorized: () => auth.logout(),
});
```

Request helpers:

```ts
api.get(path, options);
api.post(path, body, options);
api.put(path, body, options);
api.patch(path, body, options);
api.delete(path, options);
api.request(path, options);
```

Request options:

```ts
type ApiRequestOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  schema?: z.ZodType<T>;
  cache?:
    | false
    | {
        key?: string;
        ttl?: number;
        tags?: string[];
        swr?: boolean;
      };
  auth?: false | "optional" | "required";
  credentials?: RequestCredentials;
};
```

The client serializes plain bodies as JSON, leaves `FormData`, `URLSearchParams`, `Blob`, and buffers intact, parses JSON responses by content type, and throws `ApiError` for failed HTTP responses.

### Auth

```ts
const auth = createAuth<User>({ storageKey: "auth" });

auth.setToken(token, user);
auth.setUser(user);
auth.logout();
auth.getToken();
auth.authHeaders();
auth.isExpired();
auth.isAuthenticated();
```

The auth store is a zustand vanilla store:

```ts
auth.store.getState();
auth.store.subscribe((state) => {
  console.log(state.status);
});
```

### Resources

```ts
const users = createResource<User[], { search: string }>({
  initialData: [],
  load: ({ search }, { signal }) =>
    api.get("/users", {
      query: { search },
      signal,
      schema: UsersSchema,
    }),
});

users.load({ search: "ada" });
users.refresh();
users.mutate((current) => [...(current ?? []), newUser]);
users.abort();
users.reset();
```

### Router

```ts
const router = createRouter(routes, {
  mode: "history",
  fallback: () => <NotFound />,
});

router.href("/posts");
router.navigate("/posts", { replace: true });
router.start();
router.stop();
router.outlet();
router.Link({ to: "/posts", children: "Posts" });
```

Route paths support static segments, params, and a wildcard:

```txt
/
/posts
/posts/:id
/docs/*
```

### Forms

```ts
formValues(form);
clearFormValidity(form);
applyZodValidity(form, error);
zodSubmit(schema, handler, options?);
```

Use `zodSubmit` as a form action:

```tsx
<form use={zodSubmit(Schema, save, { resetOnSuccess: true })}>...</form>
```

## Recipes

### Persist a zustand store

```ts
const cache = createLocalCache("app:");

const PreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  sidebarOpen: z.boolean(),
});

const saved = cache.get("preferences", PreferencesSchema, { allowStale: true })?.value;

const preferences = createStore(() => ({
  theme: saved?.theme ?? "system",
  sidebarOpen: saved?.sidebarOpen ?? true,
}));

preferences.subscribe((state) => {
  cache.set("preferences", state, { tags: ["preferences"] });
});
```

### Add an active class from state

```tsx
<button use={bind.class("selected", tabs, (state) => state.current === "settings")}>
  Settings
</button>
```

### Disable a button while saving

```tsx
<button use={bind.attr("disabled", saveState, (state) => state.loading)}>Save</button>
```

### Run a custom subscription for one element

```ts
const pageTitle = effect(
  session,
  (state) => state.user?.name ?? "anonymous",
  (name) => {
    document.title = `${name} | Admin`;
  },
);
```

```tsx
<div use={pageTitle} />
```

The subscription is removed when the element is cleaned up.

### Read stale cache manually

```ts
const hit = cache.get("posts", PostsSchema, { allowStale: true });

if (hit?.stale) {
  console.log("show old data, refresh soon");
}
```

### Clear every cached response for a tag

```ts
api.cache.clearTag("posts");
```

### Use request auth only for selected calls

```ts
await api.get("/public", { auth: false });
await api.get("/me", { auth: "required", schema: UserSchema });
```

### Use history mode

```ts
const router = createRouter(routes, { mode: "history" });
```

For production history mode, configure your server to return `index.html` for app routes.

## Design notes

### TSX is only syntax

There is no component instance model. A component call creates nodes. Persistent updates live in stores, actions, and resources.

### DOM ownership is explicit

If code creates a node, code can also clean it. The lifecycle module stores cleanup callbacks in a `WeakMap<Node, Cleanup[]>`. Redrawing a `view` or unmounting a root walks the nodes and runs those callbacks.

### Reactivity is opt-in

A static subtree remains static. A text node subscribed with `text` updates itself. A `view` redraws only its own marker-bounded region. An action may subscribe to anything and return cleanup.

### Data is trusted after parsing

The API client and cache both accept zod schemas. The goal is to reject bad network data and stale cache shapes at the boundary.

### localStorage is treated as a cache

Every write stores an envelope with `updatedAt`, `expiresAt`, and `tags`. A read can reject stale entries, allow stale entries, or remove invalid entries after schema parsing fails.

### The router is a store

Routing state is a zustand vanilla store. The outlet is a `view` over the current path. Links are anchors with click handling and optional active class binding.

## What this deliberately skips

This project is small by choice. Some things are better added per app than baked into the core.

| Skipped                   | Reason                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Virtual DOM diffing       | The runtime creates DOM nodes directly and updates explicit regions.                  |
| Keyed list reconciliation | Useful for very large lists, but not needed for the demo. Add it as a focused helper. |
| SSR and hydration         | The target is a modern browser rich client.                                           |
| Server components         | Outside the scope of this client runtime.                                             |
| Suspense semantics        | Resource state is explicit and ordinary.                                              |
| Built-in OAuth flow       | Servers and threat models vary too much.                                              |
| IndexedDB cache           | localStorage keeps the example small. Use IndexedDB for larger payloads.              |
| Component context system  | Plain modules and stores cover the current app.                                       |

## When to use this shape

This architecture fits apps where:

- the browser is the main runtime
- TSX syntax is desired
- the app wants strong network parsing without a large UI runtime
- data and auth flows are custom
- the team prefers direct ownership of DOM behavior
- the codebase should be readable from top to bottom
- coding agents should be able to reason across app and framework code in one repository

Choose a larger UI framework when you need a mature component ecosystem, server rendering, hydration, a11y component kits, animation systems, or many third-party UI widgets with framework adapters.

## Reading path

To understand the framework, read these files in order:

1. `packages/nodiff/src/dom.ts` for TSX, props, events, refs, actions, and mount
2. `packages/nodiff/src/lifecycle.ts` for cleanup
3. `packages/nodiff/src/store.ts` for text, view, list, and form control bindings
4. `packages/nodiff/src/cache.ts` for localStorage envelopes
5. `packages/nodiff/src/api.ts` for zod-backed fetch and auth headers
6. `packages/nodiff/src/resource.ts` for async state
7. `packages/nodiff/src/router.ts` for navigation
8. `apps/demo/src/main.tsx` for the whole app in one place

## Package layout

```txt
packages/nodiff/src/
  api.ts              fetch client with zod, auth, cache
  auth.ts             persisted bearer token store
  cache.ts            localStorage cache with TTL and tags
  dom.ts              direct DOM TSX runtime
  forms.ts            zod form action and validity helpers
  index.ts            public exports
  jsx-dev-runtime.ts  Vite/dev automatic JSX runtime entry
  jsx-runtime.ts      TypeScript automatic JSX runtime entry
  lifecycle.ts        cleanup registry
  resource.ts         async resource store
  router.ts           hash/history router
  store.ts            zustand-compatible bindings
```

## Modern browser target

The repo targets modern browsers only:

```json
{
  "target": "ES2022",
  "lib": ["ES2022", "DOM", "DOM.Iterable"],
  "moduleResolution": "Bundler",
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

The demo Vite build target is also `es2022`.

## Publishing notes

`@nodiffjs/core` has package exports for the framework and JSX runtimes:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./jsx-runtime": {
      "types": "./dist/jsx-runtime.d.ts",
      "import": "./dist/jsx-runtime.js"
    },
    "./jsx-dev-runtime": {
      "types": "./dist/jsx-dev-runtime.d.ts",
      "import": "./dist/jsx-dev-runtime.js"
    }
  }
}
```

Before publishing, add a license, project metadata, tests, and the package ownership you want.

## The one-file promise

Open `apps/demo/src/main.tsx` and you can see the whole client app: preferences, auth, cache, API client, resource state, routes, pages, and mount call.

That is the point of the project. A rich-client app should be possible to understand without following a renderer through a black box.
