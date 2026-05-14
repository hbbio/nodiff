import {
  bind,
  createApi,
  createAuth,
  createLocalCache,
  createResource,
  createRouter,
  For,
  mount,
  Show,
  text,
  view,
  zodSubmit,
} from "@nodiffjs/core";
import { createStore } from "zustand/vanilla";
import { z } from "zod";
import "./styles.css";

const appCache = createLocalCache("demo:");
const apiCache = createLocalCache("demo:http:");

const PreferencesSchema = z.object({
  count: z.number().int().nonnegative(),
  search: z.string(),
  theme: z.enum(["system", "light", "dark"]),
});

type PreferencesData = z.infer<typeof PreferencesSchema>;
type PreferencesState = PreferencesData & {
  increment(): void;
  resetCount(): void;
  setSearch(search: string): void;
  setTheme(theme: PreferencesData["theme"]): void;
};

const defaultPreferences: PreferencesData = {
  count: 0,
  search: "",
  theme: "system",
};

const savedPreferences =
  appCache.get("preferences", PreferencesSchema, { allowStale: true })?.value ?? defaultPreferences;

const preferences = createStore<PreferencesState>((set) => ({
  ...savedPreferences,
  increment: () => set((state) => ({ count: state.count + 1 })),
  resetCount: () => set({ count: 0 }),
  setSearch: (search) => set({ search }),
  setTheme: (theme) => set({ theme }),
}));

function preferenceSnapshot(state: PreferencesState): PreferencesData {
  return {
    count: state.count,
    search: state.search,
    theme: state.theme,
  };
}

preferences.subscribe((state) => {
  appCache.set("preferences", preferenceSnapshot(state), { tags: ["preferences"] });
  document.documentElement.dataset.theme = state.theme;
});

document.documentElement.dataset.theme = preferences.getState().theme;

const auth = createAuth<{ email: string; name: string }>({ storageKey: "demo:auth" });

const api = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
  cache: apiCache,
  getAuthHeaders: auth.authHeaders,
  onUnauthorized: () => auth.logout(),
});

const PostSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});
const PostsSchema = z.array(PostSchema);
type Post = z.infer<typeof PostSchema>;

const posts = createResource<Post[]>({
  immediate: true,
  load: (_args, { signal }) =>
    api.get("/posts", {
      signal,
      schema: PostsSchema,
      cache: {
        key: "posts",
        ttl: 5 * 60 * 1000,
        swr: true,
        tags: ["posts"],
      },
    }),
});

type PostsVm = {
  status: string;
  loading: boolean;
  stale: boolean;
  updatedAt: number | null;
  error: string | null;
  total: number;
  search: string;
  visible: Post[];
};

function readPostsVm(): PostsVm {
  const resource = posts.store.getState();
  const search = preferences.getState().search.trim().toLowerCase();
  const all = resource.data ?? [];
  const visible = search
    ? all.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(search)).slice(0, 16)
    : all.slice(0, 8);

  return {
    status: resource.status,
    loading: resource.loading,
    stale: resource.stale,
    updatedAt: resource.updatedAt,
    error: resource.error?.message ?? null,
    total: all.length,
    search,
    visible,
  };
}

const postsVm = createStore<PostsVm>(() => readPostsVm());
const syncPostsVm = () => postsVm.setState(readPostsVm(), true);
posts.store.subscribe(syncPostsVm);
preferences.subscribe(syncPostsVm);

const cacheInspector = createStore<{ version: number }>(() => ({ version: 0 }));
const refreshCacheInspector = () =>
  cacheInspector.setState((state) => ({ version: state.version + 1 }));

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

type LoginValues = z.infer<typeof LoginSchema>;

async function fakeLogin(values: LoginValues): Promise<void> {
  const name = values.email.split("@")[0] || "demo-user";
  auth.setToken(
    {
      accessToken: btoa(`${values.email}:${Date.now()}`),
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
    { email: values.email, name },
  );
}

function StatCard(props: { label: string; value: string | number | Node; hint?: string }) {
  return (
    <article class="stat-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}

function HomePage() {
  return (
    <section class="stack">
      <header class="hero panel">
        <p class="eyebrow">No React, no axios, no virtual DOM</p>
        <h1>Direct DOM TSX for rich-client apps.</h1>
        <p>
          TSX compiles through Vite into calls to <code>@nodiffjs/core/jsx-runtime</code>.
          Components create real DOM nodes, actions attach behavior, and zustand stores drive
          explicit updates.
        </p>
        <div class="actions">
          <button onClick={() => preferences.getState().increment()}>
            Increment local counter
          </button>
          <button class="ghost" onClick={() => preferences.getState().resetCount()}>
            Reset
          </button>
        </div>
      </header>

      <div class="grid stats">
        <StatCard
          label="Counter"
          value={text(preferences, (state) => state.count)}
          hint="Persisted in localStorage"
        />
        <StatCard
          label="Auth"
          value={text(auth.store, (state) => state.status)}
          hint="Bearer token helper"
        />
        <StatCard
          label="Posts"
          value={text(postsVm, (state) => state.total)}
          hint="Zod-validated API data"
        />
      </div>

      <section class="panel stack compact">
        <h2>Theme preference</h2>
        <label class="field inline">
          <span>Theme</span>
          <select
            use={bind.value(
              preferences,
              (state) => state.theme,
              (theme) => ({ theme: theme as PreferencesData["theme"] }),
              { event: "change" },
            )}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section class="grid">
        <article class="panel">
          <h3>Framework surface</h3>
          <ul>
            <li>Direct DOM JSX runtime</li>
            <li>Lifecycle cleanup through actions</li>
            <li>Store bindings for text, attrs, classes, inputs</li>
            <li>Hash or history router</li>
          </ul>
        </article>
        <article class="panel">
          <h3>Data surface</h3>
          <ul>
            <li>Zod response validation</li>
            <li>Token auth headers and logout on 401</li>
            <li>localStorage cache with TTL and stale reads</li>
            <li>Resource state for loading, stale, error, success</li>
          </ul>
        </article>
      </section>
    </section>
  );
}

function PostsPage() {
  return (
    <section class="stack">
      <header class="panel split">
        <div>
          <p class="eyebrow">API data</p>
          <h1>Posts</h1>
          <p>Fetched from JSONPlaceholder, parsed by zod, then cached in localStorage.</p>
        </div>
        <div class="actions">
          <button
            use={bind.attr("disabled", postsVm, (state) => state.loading)}
            onClick={() => void posts.refresh()}
          >
            Refresh
          </button>
          <button
            class="ghost"
            onClick={() => {
              apiCache.remove("posts");
              refreshCacheInspector();
              void posts.refresh();
            }}
          >
            Bust cache
          </button>
        </div>
      </header>

      <section class="panel stack compact">
        <label class="field">
          <span>Filter posts</span>
          <input
            placeholder="Try album, photo, dolorem..."
            use={bind.value(
              preferences,
              (state) => state.search,
              (search) => ({ search }),
            )}
          />
        </label>
        {view(
          postsVm,
          (state) => state,
          (state) => (
            <StatusLine state={state} />
          ),
        )}
      </section>

      <div class="post-list">
        <For
          store={postsVm}
          each={(state) => state.visible}
          by={(post) => post.id}
          fallback={(state) => {
            if (state.loading && state.total === 0) return <p class="panel">Loading posts...</p>;
            if (state.error && state.total === 0)
              return <pre class="panel error">{state.error}</pre>;
            return <p class="panel">No posts match this filter.</p>;
          }}
        >
          {(post) => (
            <article class="panel post-card" data-id={post.id}>
              <span>#{post.id}</span>
              <h2>{post.title}</h2>
              <p>{post.body}</p>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}

function StatusLine(props: { state: PostsVm }) {
  const state = props.state;
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "never";
  const filter = state.search
    ? `, ${state.visible.length} visible for “${state.search}”`
    : `, showing ${state.visible.length}`;
  const stale = state.stale ? ", stale data visible" : "";

  return (
    <p class="muted">
      Status: <strong>{state.loading ? "loading" : state.status}</strong>, total {state.total}
      {filter}. Last updated: {updated}
      {stale}.{state.error ? <span class="error-text"> Error: {state.error}</span> : null}
    </p>
  );
}

function AuthPage() {
  return (
    <section class="stack">
      <header class="panel">
        <p class="eyebrow">Token auth</p>
        <h1>Authentication</h1>
        <p>
          The demo uses a fake login, stores the token, and attaches an Authorization header to API
          requests.
        </p>
      </header>

      <Show store={auth.store} when={(state) => state.token} fallback={() => <LoginPanel />}>
        {() => <AuthenticatedPanel />}
      </Show>
    </section>
  );
}

function LoginPanel() {
  return (
    <form class="panel stack compact" use={zodSubmit(LoginSchema, fakeLogin)}>
      <label class="field">
        <span>Email</span>
        <input name="email" type="email" value="demo@example.com" autocomplete="email" />
      </label>
      <label class="field">
        <span>Password</span>
        <input name="password" type="password" value="demo" autocomplete="current-password" />
      </label>
      <button type="submit">Create demo token</button>
    </form>
  );
}

function AuthenticatedPanel() {
  const token = auth.store.getState().token;
  const tokenPreview = token?.accessToken ? `${token.accessToken.slice(0, 18)}...` : "none";
  const expiresAt = token?.expiresAt ? new Date(token.expiresAt).toLocaleString() : "session";

  return (
    <section class="panel stack compact">
      <div class="split">
        <div>
          <h2>Authenticated</h2>
          <p class="muted">Token preview: {tokenPreview}</p>
          <p class="muted">Expires: {expiresAt}</p>
        </div>
        <button class="ghost" onClick={() => auth.logout()}>
          Logout
        </button>
      </div>
      <pre>{JSON.stringify(auth.authHeaders(), null, 2)}</pre>
    </section>
  );
}

function CachePage() {
  return (
    <section class="stack">
      <header class="panel split">
        <div>
          <p class="eyebrow">localStorage</p>
          <h1>Cache inspector</h1>
          <p>Shows demo-prefixed keys written by preferences, auth, and API cache helpers.</p>
        </div>
        <div class="actions">
          <button class="ghost" onClick={refreshCacheInspector}>
            Refresh list
          </button>
          <button
            onClick={() => {
              appCache.clear();
              auth.logout();
              refreshCacheInspector();
            }}
          >
            Clear demo cache
          </button>
        </div>
      </header>

      {view(
        cacheInspector,
        (state) => state.version,
        () => {
          const keys = appCache.keys().sort();
          if (keys.length === 0) return <p class="panel">No demo cache keys.</p>;

          return (
            <section class="panel stack compact">
              <h2>Keys</h2>
              <ul class="cache-list">
                {keys.map((key) => (
                  <li>
                    <code>demo:{key}</code>
                    <button
                      class="ghost small"
                      onClick={() => {
                        appCache.remove(key);
                        refreshCacheInspector();
                      }}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        },
      )}
    </section>
  );
}

function NotFound() {
  return (
    <section class="panel">
      <h1>Not found</h1>
      <p>The current route is not registered.</p>
    </section>
  );
}

const router = createRouter(
  [
    { path: "/", title: "NoDiff", component: HomePage },
    { path: "/posts", title: "Posts | NoDiff", component: PostsPage },
    { path: "/auth", title: "Auth | NoDiff", component: AuthPage },
    { path: "/cache", title: "Cache | NoDiff", component: CachePage },
  ],
  {
    mode: "hash",
    fallback: NotFound,
  },
);

function App() {
  const Link = (props: Parameters<typeof router.Link>[0]) => router.Link(props);

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <a
          class="brand"
          href={router.href("/")}
          onClick={(event) => {
            event.preventDefault();
            router.navigate("/");
          }}
        >
          <span class="brand-mark">m</span>
          <span>NoDiff</span>
        </a>
        <nav>
          <Link to="/" exact activeClass="active">
            Home
          </Link>
          <Link to="/posts" activeClass="active">
            Posts
          </Link>
          <Link to="/auth" activeClass="active">
            Auth
          </Link>
          <Link to="/cache" activeClass="active">
            Cache
          </Link>
        </nav>
        <footer>
          <small>Vite 8 + Bun + TSX runtime</small>
        </footer>
      </aside>
      <main>{router.outlet()}</main>
    </div>
  );
}

router.start();
mount("#app", App);
