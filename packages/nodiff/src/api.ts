import type { z } from "zod";
import { createLocalCache, type LocalCache, type CacheWriteOptions } from "./cache";

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
  credentials?: RequestCredentials;
};

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: HeadersInit;
  cache?: LocalCache;
  getToken?: () => string | null | undefined;
  getAuthHeaders?: () => HeadersInit | null | undefined;
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
): string {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    appendQuery(url, query);
    return url.toString();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const base = baseUrl ? new URL(baseUrl, origin).toString() : origin;
  const url = baseUrl
    ? new URL(path.replace(/^\/+/, ""), base.endsWith("/") ? base : `${base}/`)
    : new URL(path.startsWith("/") ? path : `/${path}`, base);

  appendQuery(url, query);
  return url.toString();
}

function applyHeaders(target: Headers, source: HeadersInit | null | undefined): void {
  if (!source) return;
  new Headers(source).forEach((value, key) => target.set(key, value));
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

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

export function createApi(options: ApiClientOptions = {}) {
  const cache = options.cache ?? createLocalCache("nodiff:http:");

  async function runFetch<T>(
    url: string,
    request: ApiRequestOptions<T>,
    retry: boolean,
  ): Promise<T> {
    const headers = new Headers();
    applyHeaders(headers, options.headers);
    applyHeaders(headers, request.headers);

    if (request.auth !== false) {
      const authHeaders = options.getAuthHeaders?.();
      if (authHeaders) {
        applyHeaders(headers, authHeaders);
      } else {
        const token = options.getToken?.();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }

      if (request.auth === "required" && !headers.has("Authorization")) {
        throw new Error("Authentication token is required for this request.");
      }
    }

    const body = request.body;
    const init: RequestInit = {
      method: request.method ?? (body === undefined ? "GET" : "POST"),
      headers,
    };
    if (request.signal) init.signal = request.signal;
    if (request.credentials) init.credentials = request.credentials;

    if (body !== undefined) {
      if (isJsonBody(body)) {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(body);
      } else {
        init.body = body as BodyInit;
      }
    }

    const response = await fetch(url, init);
    const payload = await readPayload(response);

    if (response.status === 401 && retry && options.refreshAuth) {
      await options.refreshAuth();
      return runFetch(url, request, false);
    }

    if (!response.ok) {
      const error = new ApiError(response.status, response.statusText, url, payload);
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
    const cacheOptions = requestOptions.cache;
    const canCache = method === "GET" && cacheOptions !== false && cacheOptions !== undefined;
    const cacheKey = canCache ? (cacheOptions.key ?? `${method}:${url}`) : "";

    if (canCache) {
      const hit = cache.get<T>(cacheKey, requestOptions.schema, {
        allowStale: Boolean(cacheOptions.swr),
      });
      if (hit && !hit.stale) return hit.value;
      if (hit && hit.stale && cacheOptions.swr) {
        void runFetch<T>(url, requestOptions, true)
          .then((value) => cache.set(cacheKey, value, cacheOptions))
          .catch(() => undefined);
        return hit.value;
      }
    }

    const value = await runFetch<T>(url, requestOptions, true);
    if (canCache) cache.set(cacheKey, value, cacheOptions);
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
