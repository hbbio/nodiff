import type { z } from "zod";

export type CacheSchema<T> = z.ZodType<T>;

export type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
  expiresAt: number | null;
  tags: string[];
};

export type CacheEntry<T> = CacheEnvelope<T> & {
  key: string;
  stale: boolean;
};

export type CacheReadOptions = {
  allowStale?: boolean;
};

export type CacheWriteOptions = {
  ttl?: number;
  tags?: string[];
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export class LocalCache {
  constructor(public readonly prefix = "ria:") {}

  fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get<T>(key: string, schema?: CacheSchema<T>, options: CacheReadOptions = {}): CacheEntry<T> | undefined {
    if (!canUseLocalStorage()) return undefined;
    const raw = window.localStorage.getItem(this.fullKey(key));
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
      if (!parsed || typeof parsed !== "object" || !("value" in parsed)) {
        this.remove(key);
        return undefined;
      }

      const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : null;
      const stale = expiresAt !== null && expiresAt <= Date.now();
      if (stale && !options.allowStale) {
        this.remove(key);
        return undefined;
      }

      const value = schema ? schema.safeParse(parsed.value) : { success: true, data: parsed.value as T };
      if (!value.success) {
        this.remove(key);
        return undefined;
      }

      return {
        key,
        value: value.data,
        updatedAt: Number(parsed.updatedAt) || 0,
        expiresAt,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        stale
      };
    } catch {
      this.remove(key);
      return undefined;
    }
  }

  set<T>(key: string, value: T, options: CacheWriteOptions = {}): void {
    if (!canUseLocalStorage()) return;
    const envelope: CacheEnvelope<T> = {
      value,
      updatedAt: Date.now(),
      expiresAt: typeof options.ttl === "number" ? Date.now() + options.ttl : null,
      tags: options.tags ?? []
    };
    window.localStorage.setItem(this.fullKey(key), JSON.stringify(envelope));
  }

  remove(key: string): void {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(this.fullKey(key));
  }

  keys(): string[] {
    if (!canUseLocalStorage()) return [];
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(this.prefix)) keys.push(key.slice(this.prefix.length));
    }
    return keys;
  }

  clear(): void {
    for (const key of this.keys()) this.remove(key);
  }

  clearTag(tag: string): void {
    for (const key of this.keys()) {
      const entry = this.get<unknown>(key, undefined, { allowStale: true });
      if (entry?.tags.includes(tag)) this.remove(key);
    }
  }
}

export function createLocalCache(prefix = "ria:"): LocalCache {
  return new LocalCache(prefix);
}
