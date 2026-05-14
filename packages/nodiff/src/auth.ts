import { createStore } from "zustand/vanilla";
import { z } from "zod";
import { createLocalCache } from "./cache";

export type AuthToken = {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
  tokenType?: string | undefined;
};

export const AuthTokenSchema: z.ZodType<AuthToken> = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    tokenType: z.string().optional(),
  })
  .passthrough();

export type AuthState<TUser = unknown, TToken extends AuthToken = AuthToken> = {
  token: TToken | null;
  user: TUser | null;
  status: "anonymous" | "authenticated";
  setToken(token: TToken, user?: TUser | null): void;
  setUser(user: TUser | null): void;
  clear(): void;
};

export type AuthOptions<TToken extends AuthToken> = {
  storageKey?: string;
  tokenSchema?: z.ZodType<TToken>;
};

export function createAuth<TUser = unknown, TToken extends AuthToken = AuthToken>(
  options: AuthOptions<TToken> = {},
) {
  const storageKey = options.storageKey ?? "nodiff:auth";
  const schema = options.tokenSchema ?? (AuthTokenSchema as z.ZodType<TToken>);
  const cache = createLocalCache("");
  const savedToken = cache.get<TToken>(storageKey, schema, { allowStale: true })?.value ?? null;

  const store = createStore<AuthState<TUser, TToken>>((set) => ({
    token: savedToken,
    user: null,
    status: savedToken ? "authenticated" : "anonymous",
    setToken: (token, user) => {
      set((state) => ({
        token,
        user: user === undefined ? state.user : user,
        status: "authenticated",
      }));
    },
    setUser: (user) => set({ user }),
    clear: () => set({ token: null, user: null, status: "anonymous" }),
  }));

  store.subscribe((state, previous) => {
    if (state.token === previous.token) return;
    if (state.token) cache.set(storageKey, state.token);
    else cache.remove(storageKey);
  });

  function getToken(): string | null {
    return store.getState().token?.accessToken ?? null;
  }

  function authHeaders(): HeadersInit {
    const token = store.getState().token;
    if (!token?.accessToken) return {};
    return {
      Authorization: `${token.tokenType ?? "Bearer"} ${token.accessToken}`,
    };
  }

  function isExpired(skewMs = 30_000): boolean {
    const expiresAt = store.getState().token?.expiresAt;
    if (!expiresAt) return false;
    return expiresAt - skewMs <= Date.now();
  }

  function isAuthenticated(): boolean {
    return Boolean(store.getState().token?.accessToken) && !isExpired();
  }

  return {
    store,
    getToken,
    authHeaders,
    isExpired,
    isAuthenticated,
    setToken: (token: TToken, user?: TUser | null) => store.getState().setToken(token, user),
    setUser: (user: TUser | null) => store.getState().setUser(user),
    logout: () => store.getState().clear(),
  };
}

export type AuthController<TUser = unknown, TToken extends AuthToken = AuthToken> = ReturnType<
  typeof createAuth<TUser, TToken>
>;
