import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createResource } from "../src/resource";
import { installDom } from "./test-dom";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createResource", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("ignores stale results from superseded loads", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls: Array<{ args: string; signal: AbortSignal }> = [];

    const resource = createResource<string, string>({
      load: (args, context) => {
        calls.push({ args, signal: context.signal });
        return calls.length === 1 ? first.promise : second.promise;
      },
    });

    const firstLoad = resource.load("first");
    const secondLoad = resource.load("second");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(resource.store.getState().loading).toBe(true);

    second.resolve("fresh");
    await expect(secondLoad).resolves.toBe("fresh");
    expect(resource.store.getState()).toMatchObject({
      data: "fresh",
      loading: false,
      stale: false,
      status: "success",
    });

    first.resolve("stale");
    await expect(firstLoad).resolves.toBeUndefined();
    expect(resource.store.getState().data).toBe("fresh");
  });

  test("abort clears loading state and ignores late success", async () => {
    const pending = deferred<string>();
    const resource = createResource<string>({
      load: () => pending.promise,
    });

    const loading = resource.load();
    expect(resource.store.getState()).toMatchObject({
      data: null,
      loading: true,
      status: "loading",
    });

    resource.abort();
    expect(resource.store.getState()).toMatchObject({
      data: null,
      loading: false,
      stale: false,
      status: "idle",
    });

    pending.resolve("late");
    await expect(loading).resolves.toBeUndefined();
    expect(resource.store.getState().data).toBeNull();
  });

  test("abort-aware loaders settle without leaving loading state behind", async () => {
    const resource = createResource<string>({
      load: (_args, context) =>
        new Promise((resolve, reject) => {
          context.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          setTimeout(() => resolve("done"), 10);
        }),
    });

    const loading = resource.load();
    resource.abort();

    await expect(loading).resolves.toBeUndefined();
    expect(resource.store.getState()).toMatchObject({
      data: null,
      loading: false,
      stale: false,
      status: "idle",
    });
  });

  test("treats abort-like loader errors as canceled loads", async () => {
    const resource = createResource<string>({
      load: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    });

    await expect(resource.load()).resolves.toBeUndefined();

    expect(resource.store.getState()).toMatchObject({
      data: null,
      loading: false,
      stale: false,
      status: "idle",
    });
  });

  test("handles failures, refreshes last args, mutates, and resets to initial data", async () => {
    const calls: string[] = [];
    const resource = createResource<string, string>({
      initialData: "cached",
      load: async (args) => {
        calls.push(args);
        throw "denied";
      },
    });

    await expect(resource.load("first")).resolves.toBeUndefined();
    expect(resource.store.getState()).toMatchObject({
      data: "cached",
      loading: false,
      stale: true,
      status: "error",
    });
    expect(resource.store.getState().error?.message).toBe("denied");

    await expect(resource.refresh()).resolves.toBeUndefined();
    expect(calls).toEqual(["first", "first"]);

    resource.mutate((current) => `${current}:local`);
    expect(resource.store.getState()).toMatchObject({
      data: "cached:local",
      status: "success",
      stale: false,
    });

    resource.reset();
    expect(resource.store.getState()).toMatchObject({
      data: "cached",
      error: null,
      loading: false,
      stale: false,
      status: "success",
    });
  });

  test("can start loading immediately", async () => {
    const resource = createResource<string>({
      immediate: true,
      load: async () => "ready",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resource.store.getState()).toMatchObject({
      data: "ready",
      loading: false,
      status: "success",
    });
  });
});
