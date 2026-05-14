import type { z } from "zod";
import { createLocalCache, type LocalCache, type CacheWriteOptions } from "./cache";
import { csrfHeaderName, defaultCookieCsrf, readCsrfToken, type CsrfRequestOptions } from "./csrf";
import { resolveSecurityPolicy, type SecurityPolicy, type SecurityPolicyOptions } from "./security";

export type ApiSchema<T> = z.ZodType<T>;

export type QueryValue = string | number | boolean | null | undefined;

export type ApiCacheOptions = CacheWriteOptions & {
  key?: string;
  swr?: boolean;
};

export type ApiRequestOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  schema?: ApiSchema<T>;
  cache?: ApiCacheOptions | false;
  auth?: false | "optional" | "required";
  csrf?: boolean | CsrfRequestOptions;
  external?: boolean;
  timeout?: number;
  credentials?: RequestCredentials;
};

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: HeadersInit;
  cache?: LocalCache;
  security?: SecurityPolicy | SecurityPolicyOptions;
  getToken?: () => string | null | undefined;
  getAuthHeaders?: () => HeadersInit | null | undefined;
  csrf?: CsrfRequestOptions;
  timeout?: number;
  refreshAuth?: () => Promise<void>;
  onUnauthorized?: (error: ApiError) => void;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly payload: unknown,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

function appendQuery(url: URL, query: Record<string, QueryValue> | undefined): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
}

function resolveUrl(
  baseUrl: string | undefined,
  path: string,
  query: Record<string, QueryValue> | undefined,
): URL {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    appendQuery(url, query);
    return url;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const base = baseUrl ? new URL(baseUrl, origin).toString() : origin;
  const url = baseUrl
    ? new URL(path.replace(/^\/+/, ""), base.endsWith("/") ? base : `${base}/`)
    : new URL(path.startsWith("/") ? path : `/${path}`, base);

  appendQuery(url, query);
  return url;
}

function authOrigin(baseUrl: string | undefined): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  return new URL(baseUrl ?? origin, origin).origin;
}

function applyHeaders(target: Headers, source: HeadersInit | null | undefined): void {
  if (!source) return;
  new Headers(source).forEach((value, key) => target.set(key, value));
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isJsonBody(body: unknown): boolean {
  if (body === null || body === undefined) return false;
  if (typeof body === "string") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return false;
  return true;
}

function isStateChanging(method: string): boolean {
  return method !== "GET";
}

function isLocalhost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}

function timeoutSignal(
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (timeout === undefined) return { signal, cleanup: () => undefined };

  const controller = new AbortController();
  const abortFromSignal = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromSignal();
  else signal?.addEventListener("abort", abortFromSignal, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new DOMException("Request timed out.", "TimeoutError"));
  }, timeout);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromSignal);
    },
  };
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

export function createApi(options: ApiClientOptions = {}) {
  const cache = options.cache ?? createLocalCache("nodiff:http:");
  const security = resolveSecurityPolicy(options.security);
  if (security.isStrict() && !options.baseUrl) {
    throw security.report({
      type: "unsafe-config",
      message: "Strict API clients require a baseUrl.",
    });
  }
  const managedAuthOrigin = authOrigin(options.baseUrl);

  function assertRequestUrl(url: URL, path: string, request: ApiRequestOptions<unknown>): void {
    security.assertSafeUrl(url, "api.request");

    if (security.enforceHttps && url.protocol === "http:" && !isLocalhost(url)) {
      throw security.report({
        type: "blocked-origin",
        message: `Blocked insecure HTTP request: ${url.origin}`,
        value: url.toString(),
      });
    }

    if (!security.isStrict()) return;

    const absolute = /^https?:\/\//i.test(path);
    if (absolute && !request.external && url.origin !== managedAuthOrigin) {
      throw security.report({
        type: "blocked-origin",
        message: "Absolute API request URLs require external: true in strict mode.",
        value: url.toString(),
      });
    }

    if (!request.external) security.assertAllowedOrigin(url, "api.request");
  }

  function buildHeaders(url: URL, request: ApiRequestOptions<unknown>): Headers {
    const method = request.method ?? (request.body === undefined ? "GET" : "POST");
    const canUseClientHeaders = url.origin === managedAuthOrigin;
    const headers = new Headers();
    if (canUseClientHeaders) applyHeaders(headers, options.headers);
    applyHeaders(headers, request.headers);

    if (request.auth !== false && canUseClientHeaders) {
      const authHeaders = options.getAuthHeaders?.();
      if (authHeaders) {
        applyHeaders(headers, authHeaders);
      } else {
        const token = options.getToken?.();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const policyRequiresCsrf = security.csrf === "double-submit-cookie" && isStateChanging(method);
    const clientCsrf =
      options.csrf || policyRequiresCsrf ? defaultCookieCsrf(options.csrf) : undefined;
    const requestCsrf =
      request.csrf === true
        ? defaultCookieCsrf(clientCsrf)
        : typeof request.csrf === "object"
          ? defaultCookieCsrf({ ...clientCsrf, ...request.csrf })
          : clientCsrf;
    const requestWantsCsrf = request.csrf === true || typeof request.csrf === "object";
    const clientWantsCsrf = Boolean(options.csrf) && isStateChanging(method);
    const csrfRequired =
      request.csrf === true ||
      requestCsrf?.required === true ||
      (requestCsrf?.required === "state-changing" && isStateChanging(method)) ||
      policyRequiresCsrf;

    if (request.csrf !== false && (requestWantsCsrf || clientWantsCsrf || policyRequiresCsrf)) {
      const token = readCsrfToken(requestCsrf);
      if (token) headers.set(csrfHeaderName(requestCsrf), token);
      else if (csrfRequired) throw new Error("CSRF token is required for this request.");
    }

    return headers;
  }

  function assertRequiredAuth(request: ApiRequestOptions<unknown>, headers: Headers): void {
    if (request.auth === "required" && !headers.has("Authorization")) {
      throw new Error("Authentication token is required for this request.");
    }
  }

  function cacheKeyFor(
    url: URL,
    method: string,
    cacheOptions: ApiCacheOptions,
    headers: Headers,
  ): string {
    const baseKey = cacheOptions.key ?? `${method}:${url.toString()}`;
    const authorization = headers.get("Authorization");
    if (!authorization) return baseKey;
    return `auth:${hashString(authorization)}:${baseKey}`;
  }

  async function runFetch<T>(
    url: URL,
    request: ApiRequestOptions<T>,
    retry: boolean,
    preparedHeaders?: Headers,
  ): Promise<T> {
    const headers = new Headers(preparedHeaders ?? buildHeaders(url, request));
    assertRequiredAuth(request, headers);
    const body = request.body;
    const init: RequestInit = {
      method: request.method ?? (body === undefined ? "GET" : "POST"),
      headers,
    };
    if (request.credentials) init.credentials = request.credentials;

    if (body !== undefined) {
      if (isJsonBody(body)) {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(body);
      } else {
        init.body = body as BodyInit;
      }
    }

    const timeout = request.timeout ?? options.timeout;
    const timed = timeoutSignal(request.signal, timeout);
    if (timed.signal) init.signal = timed.signal;

    const href = url.toString();
    let response: Response;
    let payload: unknown;
    try {
      response = await fetch(href, init);
      payload = await readPayload(response);
    } finally {
      timed.cleanup();
    }

    if (response.status === 401 && retry && options.refreshAuth) {
      await options.refreshAuth();
      return runFetch(url, request, false);
    }

    if (!response.ok) {
      const error = new ApiError(response.status, response.statusText, href, payload);
      if (response.status === 401) options.onUnauthorized?.(error);
      throw error;
    }

    return request.schema ? request.schema.parse(payload) : (payload as T);
  }

  async function request<T = unknown>(
    path: string,
    requestOptions: ApiRequestOptions<T> = {},
  ): Promise<T> {
    const method = requestOptions.method ?? (requestOptions.body === undefined ? "GET" : "POST");
    const url = resolveUrl(options.baseUrl, path, requestOptions.query);
    assertRequestUrl(url, path, requestOptions);
    const headers = buildHeaders(url, requestOptions);
    assertRequiredAuth(requestOptions, headers);
    const cacheOptions = requestOptions.cache;
    const canCache = method === "GET" && cacheOptions !== false && cacheOptions !== undefined;
    const cacheRequiresSchema = security.isStrict() || security.cache.requireSchema === true;
    if (canCache && cacheRequiresSchema && !requestOptions.schema) {
      throw security.report({
        type: "blocked-cache",
        message: "Cached API requests require a response schema.",
      });
    }
    if (
      canCache &&
      cacheOptions.ttl !== undefined &&
      security.cache.maxTtl !== undefined &&
      cacheOptions.ttl > security.cache.maxTtl
    ) {
      throw security.report({
        type: "blocked-cache",
        message: `Cache TTL exceeds policy maxTtl: ${cacheOptions.ttl}`,
      });
    }
    const cacheKey = canCache ? cacheKeyFor(url, method, cacheOptions, headers) : "";

    if (canCache) {
      const hit = cache.get<T>(cacheKey, requestOptions.schema, {
        allowStale: Boolean(cacheOptions.swr),
      });
      if (hit && !hit.stale) return hit.value;
      if (hit && hit.stale && cacheOptions.swr) {
        void runFetch<T>(url, requestOptions, true, headers)
          .then((value) => {
            const refreshedHeaders = buildHeaders(url, requestOptions);
            cache.set(
              cacheKeyFor(url, method, cacheOptions, refreshedHeaders),
              value,
              cacheOptions,
            );
          })
          .catch(() => undefined);
        return hit.value;
      }
    }

    const value = await runFetch<T>(url, requestOptions, true, headers);
    if (canCache) {
      const refreshedHeaders = buildHeaders(url, requestOptions);
      cache.set(cacheKeyFor(url, method, cacheOptions, refreshedHeaders), value, cacheOptions);
    }
    return value;
  }

  return {
    request,
    get<T = unknown>(path: string, options?: Omit<ApiRequestOptions<T>, "method" | "body">) {
      return request<T>(path, { ...options, method: "GET" });
    },
    post<T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<ApiRequestOptions<T>, "method" | "body">,
    ) {
      return request<T>(path, { ...options, method: "POST", body });
    },
    put<T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<ApiRequestOptions<T>, "method" | "body">,
    ) {
      return request<T>(path, { ...options, method: "PUT", body });
    },
    patch<T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<ApiRequestOptions<T>, "method" | "body">,
    ) {
      return request<T>(path, { ...options, method: "PATCH", body });
    },
    delete<T = unknown>(path: string, options?: Omit<ApiRequestOptions<T>, "method" | "body">) {
      return request<T>(path, { ...options, method: "DELETE" });
    },
    cache,
  };
}

export type ApiClient = ReturnType<typeof createApi>;
