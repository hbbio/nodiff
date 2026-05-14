import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createAuth } from "../src/auth";
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
});
