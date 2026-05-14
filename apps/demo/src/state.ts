import { createApi, createAuth, createLocalCache, createResource } from "@nodiffjs/core";
import { createStore } from "zustand/vanilla";
import { z } from "zod";

export const appCache = createLocalCache("demo:");
export const apiCache = createLocalCache("demo:http:");

export const PreferencesSchema = z.object({
  count: z.number().int().nonnegative(),
  search: z.string(),
  theme: z.enum(["system", "light", "dark"]),
  step: z.number().int().min(1).max(10).default(1),
});

export type PreferencesData = z.infer<typeof PreferencesSchema>;
export type PreferencesState = PreferencesData & {
  increment(): void;
  resetCount(): void;
  setSearch(search: string): void;
  setTheme(theme: PreferencesData["theme"]): void;
  setStep(step: number): void;
};

const defaultPreferences: PreferencesData = {
  count: 0,
  search: "",
  theme: "system",
  step: 1,
};

const savedPreferences =
  appCache.get("preferences", PreferencesSchema, { allowStale: true })?.value ?? defaultPreferences;

export const preferences = createStore<PreferencesState>((set) => ({
  ...savedPreferences,
  increment: () => set((state) => ({ count: state.count + state.step })),
  resetCount: () => set({ count: 0 }),
  setSearch: (search) => set({ search }),
  setTheme: (theme) => set({ theme }),
  setStep: (step) => set({ step }),
}));

function preferenceSnapshot(state: PreferencesState): PreferencesData {
  return {
    count: state.count,
    search: state.search,
    theme: state.theme,
    step: state.step,
  };
}

preferences.subscribe((state) => {
  appCache.set("preferences", preferenceSnapshot(state), { tags: ["preferences"] });
  document.documentElement.dataset.theme = state.theme;
});

document.documentElement.dataset.theme = preferences.getState().theme;

export const auth = createAuth<{ email: string; name: string }>({ storageKey: "demo:auth" });

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
  search: string;
  visible: Post[];
};

export function readPostsVm(): PostsVm {
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
