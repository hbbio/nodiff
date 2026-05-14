import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { ApiError, createApi } from "../src/api";
import { createLocalCache } from "../src/cache";
import { installDom } from "./test-dom";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function inputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("createApi", () => {
  let cleanupDom: (() => void) | undefined;
  let previousFetch: typeof fetch;
  let calls: FetchCall[];

  beforeEach(() => {
    cleanupDom = installDom();
    window.location.href = "https://example.test/app";
    previousFetch = globalThis.fetch;
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = previousFetch;
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("resolves relative base URLs against the current origin", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ ok: true });
    };

    const api = createApi({ baseUrl: "/api" });
    await api.get("/users", {
      query: { page: 2, active: true, empty: null },
    });

    expect(calls[0]?.url).toBe("https://example.test/api/users?page=2&active=true");
    expect(calls[0]?.init?.method).toBe("GET");
  });

  test("joins non-slash paths to a configured API root", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ ok: true });
    };

    const api = createApi({ baseUrl: "api/v1" });
    await api.get("users");

    expect(calls[0]?.url).toBe("https://example.test/api/v1/users");
  });

  test("leaves absolute request URLs outside the configured base URL", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ ok: true });
    };

    const api = createApi({ baseUrl: "/api" });
    await api.get("https://other.test/public", { query: { q: "search" } });

    expect(calls[0]?.url).toBe("https://other.test/public?q=search");
  });

  test("does not send managed auth headers to other origins", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ ok: true });
    };

    const api = createApi({
      baseUrl: "/api",
      headers: { "X-App-Token": "app-secret" },
      getToken: () => "user-secret",
    });

    await api.get("https://other.test/public");

    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-app-token")).toBeNull();
  });

  test("keeps managed auth headers on the configured API origin", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ ok: true });
    };

    const api = createApi({
      baseUrl: "https://api.example.test/v1",
      getToken: () => "token",
    });

    await api.get("https://api.example.test/v1/me");

    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer token");
  });

  test("requires explicit auth headers for required auth on other origins", async () => {
    const api = createApi({
      baseUrl: "/api",
      getToken: () => "token",
    });

    await expect(api.get("https://other.test/secret", { auth: "required" })).rejects.toThrow(
      "Authentication token is required",
    );
  });

  test("serializes JSON bodies and parses schemas", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ id: 1, name: "Ada" });
    };

    const api = createApi({ baseUrl: "/api" });
    const user = await api.post(
      "/users",
      { name: "Ada" },
      { schema: z.object({ id: z.number(), name: z.string() }) },
    );

    expect(user).toEqual({ id: 1, name: "Ada" });
    expect(calls[0]?.init?.body).toBe('{"name":"Ada"}');
    expect(new Headers(calls[0]?.init?.headers).get("content-type")).toBe("application/json");
  });

  test("handles 204 and text responses", async () => {
    const responses = [new Response(null, { status: 204 }), new Response("plain text")];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return responses.shift() ?? new Response(null, { status: 500 });
    };

    const api = createApi({ baseUrl: "/api" });

    await expect(api.delete("/users/1")).resolves.toBeUndefined();
    await expect(api.get<string>("/status")).resolves.toBe("plain text");
  });

  test("applies auth headers and retries once after refresh on 401", async () => {
    let refreshes = 0;
    const responses = [
      jsonResponse({ error: "expired" }, { status: 401, statusText: "Unauthorized" }),
      jsonResponse({ ok: true }),
    ];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return responses.shift() ?? new Response(null, { status: 500 });
    };

    const api = createApi({
      baseUrl: "/api",
      getToken: () => "token",
      refreshAuth: async () => {
        refreshes += 1;
      },
    });

    await expect(api.get("/me", { auth: "required" })).resolves.toEqual({ ok: true });
    expect(refreshes).toBe(1);
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer token");
  });

  test("partitions cached GET responses by authorization header", async () => {
    let token = "alice";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({
        user: new Headers(init?.headers).get("authorization"),
      });
    };

    const cache = createLocalCache("api-test:");
    const api = createApi({
      baseUrl: "/api",
      cache,
      getToken: () => token,
    });

    await expect(api.get("/me", { auth: "required", cache: { ttl: 60_000 } })).resolves.toEqual({
      user: "Bearer alice",
    });
    token = "bob";
    await expect(api.get("/me", { auth: "required", cache: { ttl: 60_000 } })).resolves.toEqual({
      user: "Bearer bob",
    });

    expect(calls).toHaveLength(2);
    expect(cache.keys()).toHaveLength(2);
    expect(cache.keys().some((key) => key.includes("alice") || key.includes("bob"))).toBe(false);
  });

  test("checks required auth before reading GET cache entries", async () => {
    const cache = createLocalCache("api-test:");
    cache.set("GET:https://example.test/api/me", { ok: true });

    const api = createApi({ baseUrl: "/api", cache });

    await expect(
      api.get("/me", {
        auth: "required",
        cache: { ttl: 60_000 },
      }),
    ).rejects.toThrow("Authentication token is required");
    expect(calls).toHaveLength(0);
  });

  test("throws ApiError for failed responses after retry", async () => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: inputUrl(url), init });
      return jsonResponse({ error: "nope" }, { status: 403, statusText: "Forbidden" });
    };

    const api = createApi({ baseUrl: "/api" });
    const error = await api.get("/secret").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).payload).toEqual({ error: "nope" });
  });
});
