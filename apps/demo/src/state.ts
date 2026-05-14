import { createApi, createAuth, createLocalCache, createResource } from "@nodiffjs/core";
import { createStore } from "zustand/vanilla";
import { z } from "zod";

export const appCache = createLocalCache("demo:");
export const apiCache = createLocalCache("demo:http:");

export const themeOptions = [
  "system",
  "light",
  "dark",
  "cupcake",
  "corporate",
  "emerald",
  "synthwave",
  "retro",
  "cyberpunk",
  "night",
  "nord",
  "sunset",
  "silk",
] as const;

export const PreferencesSchema = z.object({
  count: z.number().int().nonnegative(),
  search: z.string(),
  postPage: z.number().int().min(1).default(1),
  theme: z.enum(themeOptions),
  step: z.number().int().min(1).max(10).default(1),
});

export type PreferencesData = z.infer<typeof PreferencesSchema>;
export type PreferencesState = PreferencesData & {
  increment(): void;
  resetCount(): void;
  setSearch(search: string): void;
  setPostPage(page: number): void;
  setTheme(theme: PreferencesData["theme"]): void;
  setStep(step: number): void;
};

const defaultPreferences: PreferencesData = {
  count: 0,
  search: "",
  postPage: 1,
  theme: "system",
  step: 1,
};

const savedPreferences =
  appCache.get("preferences", PreferencesSchema, { allowStale: true })?.value ?? defaultPreferences;

export const preferences = createStore<PreferencesState>((set) => ({
  ...savedPreferences,
  increment: () => set((state) => ({ count: state.count + state.step })),
  resetCount: () => set({ count: 0 }),
  setSearch: (search) => set({ search, postPage: 1 }),
  setPostPage: (postPage) => set({ postPage: Math.max(1, Math.trunc(postPage)) }),
  setTheme: (theme) => set({ theme }),
  setStep: (step) => set({ step }),
}));

function preferenceSnapshot(state: PreferencesState): PreferencesData {
  return {
    count: state.count,
    search: state.search,
    postPage: state.postPage,
    theme: state.theme,
    step: state.step,
  };
}

preferences.subscribe((state) => {
  appCache.set("preferences", preferenceSnapshot(state), { tags: ["preferences"] });
  applyTheme(state.theme);
});

function applyTheme(theme: PreferencesData["theme"]): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = theme;
}

applyTheme(preferences.getState().theme);

export const auth = createAuth<{ email: string; name: string }>();

export const api = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
  cache: apiCache,
  getAuthHeaders: auth.authHeaders,
  onUnauthorized: () => auth.logout(),
});

export const PostSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});
export const PostsSchema = z.array(PostSchema);
export type Post = z.infer<typeof PostSchema>;

export const posts = createResource<Post[]>({
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

export type PostsVm = {
  status: string;
  loading: boolean;
  stale: boolean;
  updatedAt: number | null;
  error: string | null;
  total: number;
  filtered: number;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  pageStart: number;
  pageEnd: number;
  visible: Post[];
};

export function readPostsVm(): PostsVm {
  const resource = posts.store.getState();
  const prefs = preferences.getState();
  const search = prefs.search.trim().toLowerCase();
  const all = resource.data ?? [];
  const filtered = search
    ? all.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(search))
    : all;
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(prefs.postPage, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filtered.length);
  const visible = filtered.slice(pageStart === 0 ? 0 : pageStart - 1, pageEnd);

  return {
    status: resource.status,
    loading: resource.loading,
    stale: resource.stale,
    updatedAt: resource.updatedAt,
    error: resource.error?.message ?? null,
    total: all.length,
    filtered: filtered.length,
    search,
    page,
    pageSize,
    pageCount,
    pageStart,
    pageEnd,
    visible,
  };
}

export const postsVm = createStore<PostsVm>(() => readPostsVm());
export const syncPostsVm = () => postsVm.setState(readPostsVm(), true);

posts.store.subscribe(syncPostsVm);
preferences.subscribe(syncPostsVm);

export const cacheInspector = createStore<{ version: number }>(() => ({ version: 0 }));
export const refreshCacheInspector = () =>
  cacheInspector.setState((state) => ({ version: state.version + 1 }));

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export type LoginValues = z.infer<typeof LoginSchema>;

export async function fakeLogin(values: LoginValues): Promise<void> {
  const name = values.email.split("@")[0] || "demo-user";
  auth.setToken(
    {
      accessToken: btoa(`${values.email}:${Date.now()}`),
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
    { email: values.email, name },
  );
}
