import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { LocalCache } from "../src/cache";
import { installDom } from "./test-dom";

describe("LocalCache", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("stores, reads, and lists prefixed cache entries", () => {
    const cache = new LocalCache("test:");

    cache.set("one", { count: 1 }, { tags: ["numbers"] });
    window.localStorage.setItem("other:two", "ignored");

    expect(cache.get("one", z.object({ count: z.number() }))?.value).toEqual({ count: 1 });
    expect(cache.keys()).toEqual(["one"]);
  });

  test("removes stale, corrupt, and schema-invalid entries on read", () => {
    const cache = new LocalCache("test:");
    const schema = z.object({ count: z.number() });

    cache.set("stale", { count: 1 }, { ttl: -1 });
    window.localStorage.setItem(cache.fullKey("corrupt"), "{");
    window.localStorage.setItem(
      cache.fullKey("invalid"),
      JSON.stringify({ value: { count: "one" }, updatedAt: Date.now(), expiresAt: null, tags: [] }),
    );

    expect(cache.get("stale", schema)).toBeUndefined();
    expect(cache.get("corrupt", schema)).toBeUndefined();
    expect(cache.get("invalid", schema)).toBeUndefined();
    expect(window.localStorage.getItem(cache.fullKey("stale"))).toBeNull();
    expect(window.localStorage.getItem(cache.fullKey("corrupt"))).toBeNull();
    expect(window.localStorage.getItem(cache.fullKey("invalid"))).toBeNull();
  });

  test("treats inaccessible localStorage as an empty best-effort cache", () => {
    const cache = new LocalCache("test:");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    expect(cache.get("missing")).toBeUndefined();
    expect(() => cache.set("one", { ok: true })).not.toThrow();
    expect(() => cache.remove("one")).not.toThrow();
    expect(() => cache.clear()).not.toThrow();
    expect(() => cache.clearTag("tag")).not.toThrow();
    expect(cache.keys()).toEqual([]);
  });

  test("ignores write and serialization failures", () => {
    const cache = new LocalCache("test:");
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => cache.set("circular", circular)).not.toThrow();
    expect(cache.get("circular")).toBeUndefined();

    Object.defineProperty(window.localStorage, "setItem", {
      configurable: true,
      value() {
        throw new DOMException("Full", "QuotaExceededError");
      },
    });

    expect(() => cache.set("quota", { ok: true })).not.toThrow();
    expect(cache.get("quota")).toBeUndefined();
  });
});
