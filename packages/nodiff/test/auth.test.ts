import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cookieSessionRequest, createAuth } from "../src/auth";
import { createLocalCache } from "../src/cache";
import { installDom } from "./test-dom";

describe("createAuth", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("keeps tokens in memory by default", () => {
    const storageKey = "auth-test:default";
    const auth = createAuth({ storageKey });

    auth.setToken({ accessToken: "in-memory" });

    expect(auth.getToken()).toBe("in-memory");
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(createAuth({ storageKey }).getToken()).toBeNull();
  });

  test("persists and restores tokens only when persistence is enabled", () => {
    const storageKey = "auth-test:persist";
    const auth = createAuth({ storageKey, persist: true });

    auth.setToken({
      accessToken: "saved",
      expiresAt: Date.now() + 60_000,
    });

    expect(createAuth({ storageKey, persist: true }).getToken()).toBe("saved");
    expect(createAuth({ storageKey }).getToken()).toBeNull();
  });

  test("refuses to persist refresh tokens unless explicitly allowed", () => {
    const storageKey = "auth-test:refresh-token";
    const auth = createAuth({ storageKey, persist: true });

    expect(() =>
      auth.setToken({
        accessToken: "access",
        refreshToken: "refresh",
      }),
    ).toThrow("refresh token");
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    const allowed = createAuth({
      storageKey,
      persist: true,
      allowRefreshTokenPersistence: true,
    });
    allowed.setToken({
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(
      createAuth({ storageKey, persist: true, allowRefreshTokenPersistence: true }).getToken(),
    ).toBe("access");
  });

  test("drops saved refresh tokens when restore is not opted in", () => {
    const storageKey = "auth-test:saved-refresh-token";
    const cache = createLocalCache("");
    cache.set(storageKey, {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: Date.now() + 60_000,
    });

    const auth = createAuth({ storageKey, persist: true });

    expect(auth.getToken()).toBeNull();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  test("drops expired saved tokens before authenticating", () => {
    const storageKey = "auth-test:expired-saved";
    const cache = createLocalCache("");
    cache.set(
      storageKey,
      {
        accessToken: "expired",
        expiresAt: Date.now() - 1_000,
      },
      { ttl: 60_000 },
    );

    const auth = createAuth({ storageKey, persist: true });

    expect(auth.store.getState().status).toBe("anonymous");
    expect(auth.getToken()).toBeNull();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  test("removes persisted tokens on logout and expired subscription writes", () => {
    const storageKey = "auth-test:persisted-clear";
    const auth = createAuth({ storageKey, persist: true });

    auth.setToken({
      accessToken: "saved",
      expiresAt: Date.now() + 60_000,
    });
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();

    auth.logout();
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    const originalNow = Date.now;
    const times = [1_000, 1_000, 1_002];
    Date.now = () => times.shift() ?? 1_002;
    try {
      const racingAuth = createAuth({ storageKey: "auth-test:ttl-race", persist: true });
      racingAuth.setToken({
        accessToken: "race",
        expiresAt: 1_001,
      });
      expect(window.localStorage.getItem("auth-test:ttl-race")).toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });

  test("does not expose expired current tokens through auth helpers", () => {
    const auth = createAuth();

    auth.setToken({
      accessToken: "expired",
      expiresAt: Date.now() - 1_000,
    });

    expect(auth.store.getState().status).toBe("anonymous");
    expect(auth.getToken()).toBeNull();
    expect(new Headers(auth.authHeaders()).get("authorization")).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  test("formats optional auth headers and expiry helpers", () => {
    const auth = createAuth<{ name: string }>();

    expect(auth.isExpired()).toBe(false);
    auth.setUser({ name: "Ada" });
    expect(auth.store.getState().user).toEqual({ name: "Ada" });

    auth.setToken({
      accessToken: "custom",
      tokenType: "Token",
      expiresAt: Date.now() + 20_000,
    });

    expect(new Headers(auth.authHeaders()).get("authorization")).toBe("Token custom");
    expect(auth.isExpired()).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);

    auth.setToken({
      accessToken: "fresh",
      expiresAt: Date.now() + 60_000,
    });
    expect(auth.isExpired()).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
  });

  test("exposes required auth helpers and cookie-session request options", () => {
    const auth = createAuth();

    expect(() => auth.requireToken()).toThrow("Authentication token is required");
    expect(() => auth.requiredHeaders()).toThrow("Authentication token is required");

    auth.setToken({ accessToken: "required" });
    expect(auth.requireToken().accessToken).toBe("required");
    expect(new Headers(auth.requiredHeaders()).get("authorization")).toBe("Bearer required");
    expect(cookieSessionRequest()).toEqual({
      auth: "required",
      credentials: "include",
      csrf: true,
    });
  });
});
