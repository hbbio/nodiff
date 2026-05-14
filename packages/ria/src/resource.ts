import { createStore } from "zustand/vanilla";

export type ResourceStatus = "idle" | "loading" | "success" | "error";

export type ResourceState<T> = {
  status: ResourceStatus;
  data: T | null;
  error: Error | null;
  updatedAt: number | null;
  loading: boolean;
  stale: boolean;
};

export type ResourceContext = {
  signal: AbortSignal;
};

export type ResourceOptions<T, TArgs> = {
  initialData?: T | null;
  immediate?: boolean;
  load(args: TArgs, context: ResourceContext): Promise<T>;
};

export function createResource<T, TArgs = void>(options: ResourceOptions<T, TArgs>) {
  const initialData = options.initialData ?? null;
  const store = createStore<ResourceState<T>>(() => ({
    status: initialData === null ? "idle" : "success",
    data: initialData,
    error: null,
    updatedAt: initialData === null ? null : Date.now(),
    loading: false,
    stale: false
  }));

  let lastArgs: TArgs | undefined;
  let controller: AbortController | null = null;

  async function load(args?: TArgs): Promise<T | undefined> {
    lastArgs = args as TArgs;
    controller?.abort();
    controller = new AbortController();

    const current = store.getState();
    store.setState({
      status: current.data === null ? "loading" : "success",
      loading: true,
      stale: current.data !== null,
      error: null
    });

    try {
      const data = await options.load(lastArgs as TArgs, { signal: controller.signal });
      store.setState({
        status: "success",
        data,
        error: null,
        updatedAt: Date.now(),
        loading: false,
        stale: false
      });
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return undefined;
      store.setState({
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
        stale: store.getState().data !== null
      });
      return undefined;
    }
  }

  function refresh(): Promise<T | undefined> {
    return load(lastArgs as TArgs);
  }

  function mutate(next: T | ((current: T | null) => T)): void {
    const value = typeof next === "function" ? (next as (current: T | null) => T)(store.getState().data) : next;
    store.setState({
      data: value,
      status: "success",
      updatedAt: Date.now(),
      stale: false
    });
  }

  function reset(): void {
    controller?.abort();
    store.setState({
      status: initialData === null ? "idle" : "success",
      data: initialData,
      error: null,
      updatedAt: initialData === null ? null : Date.now(),
      loading: false,
      stale: false
    });
  }

  if (options.immediate) void load(undefined as TArgs);

  return {
    store,
    load,
    refresh,
    mutate,
    reset,
    abort: () => controller?.abort()
  };
}

export type Resource<T, TArgs = void> = ReturnType<typeof createResource<T, TArgs>>;
