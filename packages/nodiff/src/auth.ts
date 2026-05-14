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
  persist?: boolean;
  allowRefreshTokenPersistence?: boolean;
};

export function createAuth<TUser = unknown, TToken extends AuthToken = AuthToken>(
  options: AuthOptions<TToken> = {},
) {
  const storageKey = options.storageKey ?? "nodiff:auth";
  const schema = options.tokenSchema ?? (AuthTokenSchema as z.ZodType<TToken>);
  const cache = createLocalCache("");
  const persist = options.persist ?? false;

  function tokenExpired(token: TToken, skewMs = 0): boolean {
    if (!token.expiresAt) return false;
    return token.expiresAt - skewMs <= Date.now();
  }

  function readSavedToken(): TToken | null {
    const savedToken = cache.get<TToken>(storageKey, schema)?.value ?? null;
    if (!savedToken) return null;
    if (savedToken.refreshToken && !options.allowRefreshTokenPersistence) {
      cache.remove(storageKey);
      return null;
    }
    if (tokenExpired(savedToken)) {
      cache.remove(storageKey);
      return null;
    }
    return savedToken;
  }

  const savedToken = persist ? readSavedToken() : null;

  const store = createStore<AuthState<TUser, TToken>>((set) => ({
    token: savedToken,
    user: null,
    status: savedToken ? "authenticated" : "anonymous",
    setToken: (token, user) => {
      if (persist && token.refreshToken && !options.allowRefreshTokenPersistence) {
        throw new Error("Refusing to persist a refresh token without explicit opt-in.");
      }
      if (tokenExpired(token)) {
        set({ token: null, user: null, status: "anonymous" });
        return;
      }
      set((state) => ({
        token,
        user: user === undefined ? state.user : user,
        status: "authenticated",
      }));
    },
    setUser: (user) => set({ user }),
    clear: () => set({ token: null, user: null, status: "anonymous" }),
  }));

  if (persist) {
    store.subscribe((state, previous) => {
      if (state.token === previous.token) return;
      if (!state.token || tokenExpired(state.token)) {
        cache.remove(storageKey);
        return;
      }
      const ttl = state.token.expiresAt ? state.token.expiresAt - Date.now() : undefined;
      if (ttl !== undefined && ttl <= 0) {
        cache.remove(storageKey);
        return;
      }
      cache.set(storageKey, state.token, ttl === undefined ? {} : { ttl });
    });
  }

  function activeToken(): TToken | null {
    const token = store.getState().token;
    if (!token?.accessToken || tokenExpired(token)) return null;
    return token;
  }

  function getToken(): string | null {
    return activeToken()?.accessToken ?? null;
  }

  function requireToken(): TToken {
    const token = activeToken();
    if (!token) throw new Error("Authentication token is required.");
    return token;
  }

  function authHeaders(): HeadersInit {
    const token = activeToken();
    if (!token) return {};
    return {
      Authorization: `${token.tokenType ?? "Bearer"} ${token.accessToken}`,
    };
  }

  function requiredHeaders(): HeadersInit {
    const token = requireToken();
    return {
      Authorization: `${token.tokenType ?? "Bearer"} ${token.accessToken}`,
    };
  }

  function isExpired(skewMs = 30_000): boolean {
    const token = store.getState().token;
    if (!token) return false;
    return tokenExpired(token, skewMs);
  }

  function isAuthenticated(): boolean {
    return Boolean(store.getState().token?.accessToken) && !isExpired();
  }

  return {
    store,
    getToken,
    requireToken,
    authHeaders,
    requiredHeaders,
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

export function cookieSessionRequest() {
  return {
    auth: "required" as const,
    credentials: "include" as const,
    csrf: true as const,
  };
}
