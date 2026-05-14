import { createStore, type StoreApi } from "zustand/vanilla";

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

type ResourceOptionsBase<T> = {
  initialData?: T | null;
};

type OptionalArgsResourceOptions<T, TArgs> = ResourceOptionsBase<T> & {
  initialArgs?: TArgs;
  immediate?: boolean;
  load(args: TArgs, context: ResourceContext): Promise<T>;
};

type RequiredArgsResourceOptions<T, TArgs> = ResourceOptionsBase<T> & {
  load(args: TArgs, context: ResourceContext): Promise<T>;
} & (
    | {
        initialArgs: TArgs;
        immediate?: boolean;
      }
    | {
        initialArgs?: TArgs;
        immediate?: false;
      }
  );

export type ResourceOptions<T, TArgs = void> = [undefined] extends [TArgs]
  ? OptionalArgsResourceOptions<T, TArgs>
  : RequiredArgsResourceOptions<T, TArgs>;

type ResourceLoad<T, TArgs> = [undefined] extends [TArgs]
  ? (args?: TArgs) => Promise<T | undefined>
  : (args: TArgs) => Promise<T | undefined>;

export type Resource<T, TArgs = void> = {
  store: StoreApi<ResourceState<T>>;
  load: ResourceLoad<T, TArgs>;
  refresh(): Promise<T | undefined>;
  mutate(next: T | ((current: T | null) => T)): void;
  reset(): void;
  abort(): void;
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export function createResource<T>(options: ResourceOptions<T, void>): Resource<T, void>;
export function createResource<T, TArgs>(options: ResourceOptions<T, TArgs>): Resource<T, TArgs>;
export function createResource<T, TArgs = void>(
  options: ResourceOptions<T, TArgs>,
): Resource<T, TArgs> {
  const initialData = options.initialData ?? null;
  const store = createStore<ResourceState<T>>(() => ({
    status: initialData === null ? "idle" : "success",
    data: initialData,
    error: null,
    updatedAt: initialData === null ? null : Date.now(),
    loading: false,
    stale: false,
  }));

  const hasInitialArgs = hasOwn(options, "initialArgs");
  const initialArgs = hasInitialArgs ? (options as { initialArgs: TArgs }).initialArgs : undefined;
  let lastArgs = initialArgs;
  let hasLastArgs = hasInitialArgs;
  let controller: AbortController | null = null;
  let requestId = 0;

  function isAbortError(error: unknown): boolean {
    return (
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    );
  }

  function finishAbort(requestController: AbortController): void {
    if (controller === requestController) controller = null;
    const current = store.getState();
    store.setState({
      status: current.data === null ? "idle" : "success",
      loading: false,
      stale: false,
    });
  }

  async function load(args?: TArgs): Promise<T | undefined> {
    lastArgs = args as TArgs;
    hasLastArgs = true;
    const currentRequestId = ++requestId;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;

    const current = store.getState();
    store.setState({
      status: current.data === null ? "loading" : "success",
      loading: true,
      stale: current.data !== null,
      error: null,
    });

    try {
      const data = await options.load(lastArgs as TArgs, { signal: requestController.signal });
      if (currentRequestId !== requestId || requestController.signal.aborted) return undefined;
      if (controller === requestController) controller = null;
      store.setState({
        status: "success",
        data,
        error: null,
        updatedAt: Date.now(),
        loading: false,
        stale: false,
      });
      return data;
    } catch (error) {
      if (currentRequestId !== requestId) return undefined;
      if (requestController.signal.aborted || isAbortError(error)) {
        finishAbort(requestController);
        return undefined;
      }
      if (controller === requestController) controller = null;
      store.setState({
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
        stale: store.getState().data !== null,
      });
      return undefined;
    }
  }

  function refresh(): Promise<T | undefined> {
    if (!hasLastArgs) return Promise.resolve(undefined);
    return load(lastArgs);
  }

  function mutate(next: T | ((current: T | null) => T)): void {
    const value =
      typeof next === "function" ? (next as (current: T | null) => T)(store.getState().data) : next;
    store.setState({
      data: value,
      status: "success",
      updatedAt: Date.now(),
      stale: false,
    });
  }

  function reset(): void {
    requestId += 1;
    controller?.abort();
    controller = null;
    lastArgs = initialArgs;
    hasLastArgs = hasInitialArgs;
    store.setState({
      status: initialData === null ? "idle" : "success",
      data: initialData,
      error: null,
      updatedAt: initialData === null ? null : Date.now(),
      loading: false,
      stale: false,
    });
  }

  if (options.immediate) void load(lastArgs);

  return {
    store,
    load: load as ResourceLoad<T, TArgs>,
    refresh,
    mutate,
    reset,
    abort: () => {
      if (!controller) return;
      requestId += 1;
      const requestController = controller;
      controller = null;
      requestController.abort();
      finishAbort(requestController);
    },
  };
}
