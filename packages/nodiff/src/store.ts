import { addCleanup, clearBetween, removeNode } from "./lifecycle";
import { type Action, type Child, toNodes } from "./dom";
import type { ResourceState } from "./resource";

export type Equality<T> = (a: T, b: T) => boolean;

export interface ReadableStore<T> {
  getState(): T;
  subscribe(listener: (state: T, previousState: T) => void): () => void;
}

export interface WritableStore<T> extends ReadableStore<T> {
  setState(partial: Partial<T> | T | ((state: T) => Partial<T> | T), replace?: boolean): void;
}

export type Selector<TState, TValue> = (state: TState) => TValue;

export function subscribeSelector<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  listener: (value: TValue, previousValue: TValue, state: TState, previousState: TState) => void,
  equality: Equality<TValue> = Object.is,
): () => void {
  let current = selector(store.getState());

  return store.subscribe((state, previousState) => {
    const next = selector(state);
    if (equality(current, next)) return;
    const previous = current;
    current = next;
    listener(next, previous, state, previousState);
  });
}

export function effect<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  run: (value: TValue, previousValue: TValue | undefined, state: TState) => void,
  equality?: Equality<TValue>,
): Action {
  return (element) => {
    let previous: TValue | undefined;
    const initial = selector(store.getState());
    run(initial, previous, store.getState());
    previous = initial;

    const unsubscribe = subscribeSelector(
      store,
      selector,
      (value, oldValue, state) => {
        previous = oldValue;
        run(value, previous, state);
      },
      equality,
    );

    void element;
    return unsubscribe;
  };
}

export function text<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  format: (value: TValue) => string = (value) =>
    value === null || value === undefined ? "" : String(value),
  equality?: Equality<TValue>,
): Text {
  const node = document.createTextNode(format(selector(store.getState())));
  const unsubscribe = subscribeSelector(
    store,
    selector,
    (value) => {
      node.data = format(value);
    },
    equality,
  );
  addCleanup(node, unsubscribe);
  return node;
}

export function view<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  render: (value: TValue, state: TState) => Child,
  options: { equality?: Equality<TValue> } = {},
): DocumentFragment {
  const start = document.createComment("view:start");
  const end = document.createComment("view:end");
  const frag = document.createDocumentFragment();
  frag.append(start, end);

  const draw = (value: TValue, state: TState) => {
    if (!end.parentNode) return;
    clearBetween(start, end);
    for (const node of toNodes(render(value, state))) {
      end.parentNode.insertBefore(node, end);
    }
  };

  draw(selector(store.getState()), store.getState());

  const unsubscribe = subscribeSelector(
    store,
    selector,
    (value, _oldValue, state) => draw(value, state),
    options.equality,
  );

  addCleanup(start, () => {
    unsubscribe();
    clearBetween(start, end);
  });

  return frag;
}

export function when<TState>(
  store: ReadableStore<TState>,
  predicate: Selector<TState, boolean>,
  yes: (state: TState) => Child,
  no?: (state: TState) => Child,
): DocumentFragment {
  return view(store, predicate, (enabled, state) => (enabled ? yes(state) : (no?.(state) ?? null)));
}

export type ShowProps<TState, TValue> = {
  store: ReadableStore<TState>;
  when: Selector<TState, TValue>;
  children: Child | ((value: NonNullable<TValue>, state: TState) => Child);
  fallback?: Child | ((state: TState, value: TValue) => Child);
  equality?: Equality<TValue>;
};

function renderShowChild<TState, TValue>(
  child: ShowProps<TState, TValue>["children"],
  value: NonNullable<TValue>,
  state: TState,
): Child {
  return typeof child === "function" ? child(value, state) : child;
}

function renderShowFallback<TState, TValue>(
  fallback: ShowProps<TState, TValue>["fallback"],
  state: TState,
  value: TValue,
): Child {
  if (fallback === undefined) return null;
  return typeof fallback === "function" ? fallback(state, value) : fallback;
}

export function Show<TState, TValue>(props: ShowProps<TState, TValue>): DocumentFragment {
  return view(
    props.store,
    props.when,
    (value, state) =>
      value
        ? renderShowChild(props.children, value as NonNullable<TValue>, state)
        : renderShowFallback(props.fallback, state, value),
    props.equality ? { equality: props.equality } : {},
  );
}

export type ResourceStore<T> = ReadableStore<ResourceState<T>>;
export type ResourceLike<T> = ResourceStore<T> | { store: ResourceStore<T> };

export type ResourceViewProps<T> = {
  resource: ResourceLike<T>;
  children: (data: T, state: ResourceState<T>) => Child;
  pending?: Child | ((state: ResourceState<T>) => Child);
  error?: Child | ((error: Error, state: ResourceState<T>) => Child);
  empty?: Child | ((state: ResourceState<T>) => Child);
  equality?: Equality<ResourceState<T>>;
};

function resourceStore<T>(resource: ResourceLike<T>): ResourceStore<T> {
  return "store" in resource ? resource.store : resource;
}

function renderResourceSlot<T>(
  slot: Child | ((state: ResourceState<T>) => Child) | undefined,
  state: ResourceState<T>,
): Child {
  if (slot === undefined) return null;
  return typeof slot === "function" ? slot(state) : slot;
}

function renderResourceError<T>(
  slot: Child | ((error: Error, state: ResourceState<T>) => Child) | undefined,
  error: Error,
  state: ResourceState<T>,
): Child {
  if (slot === undefined) return null;
  return typeof slot === "function" ? slot(error, state) : slot;
}

export function ResourceView<T>(props: ResourceViewProps<T>): DocumentFragment {
  const store = resourceStore(props.resource);
  return view(
    store,
    (state) => state,
    (state) => {
      if (state.data !== null) return props.children(state.data, state);
      if (state.error) return renderResourceError(props.error, state.error, state);
      if (state.loading || state.status === "loading")
        return renderResourceSlot(props.pending, state);
      return renderResourceSlot(props.empty ?? props.pending, state);
    },
    props.equality ? { equality: props.equality } : {},
  );
}

export function Await<T>(props: ResourceViewProps<T>): DocumentFragment {
  return ResourceView(props);
}

export function list<TState, TItem>(
  store: ReadableStore<TState>,
  selector: Selector<TState, readonly TItem[]>,
  render: (item: TItem, index: number, items: readonly TItem[]) => Child,
  options: { equality?: Equality<readonly TItem[]> } = {},
): DocumentFragment {
  return view(
    store,
    selector,
    (items) => items.map((item, index) => render(item, index, items)),
    options,
  );
}

export type ForProps<TState, TItem, TKey = unknown> = {
  store: ReadableStore<TState>;
  each: Selector<TState, readonly TItem[]>;
  by: (item: TItem, index: number, items: readonly TItem[]) => TKey;
  children: (item: TItem, index: number, items: readonly TItem[]) => Child;
  fallback?: Child | ((state: TState) => Child);
  equality?: Equality<readonly TItem[]>;
};

type ForRow<TItem> = {
  item: TItem;
  nodes: Node[];
};

function concreteNodes(value: Child): Node[] {
  return toNodes(value).flatMap((node) => {
    if (typeof DocumentFragment !== "undefined" && node instanceof DocumentFragment) {
      return Array.from(node.childNodes);
    }
    return [node];
  });
}

function removeNodes(nodes: Node[]): void {
  for (const node of nodes) removeNode(node);
}

function keyLabel(key: unknown): string {
  if (typeof key === "symbol") return key.toString();
  try {
    return JSON.stringify(key) ?? String(key);
  } catch {
    return String(key);
  }
}

export function For<TState, TItem, TKey = unknown>(
  props: ForProps<TState, TItem, TKey>,
): DocumentFragment {
  const start = document.createComment("for:start");
  const end = document.createComment("for:end");
  const frag = document.createDocumentFragment();
  frag.append(start, end);

  let rows = new Map<TKey, ForRow<TItem>>();
  let fallbackNodes: Node[] = [];

  const clearFallback = () => {
    removeNodes(fallbackNodes);
    fallbackNodes = [];
  };

  const renderFallback = (state: TState): Node[] => {
    const fallback = props.fallback;
    if (fallback === undefined) return [];
    return concreteNodes(typeof fallback === "function" ? fallback(state) : fallback);
  };

  const renderRow = (item: TItem, index: number, items: readonly TItem[]): Node[] =>
    concreteNodes(props.children(item, index, items));

  const draw = (items: readonly TItem[], state: TState) => {
    if (!end.parentNode) return;
    const parent = end.parentNode;
    const records = items.map((item, index) => ({
      item,
      index,
      key: props.by(item, index, items),
    }));
    const nextKeys = new Set<TKey>();

    for (const record of records) {
      if (nextKeys.has(record.key)) {
        throw new Error(`Duplicate key in For: ${keyLabel(record.key)}`);
      }
      nextKeys.add(record.key);
    }

    if (records.length === 0) {
      for (const row of rows.values()) removeNodes(row.nodes);
      rows = new Map();
      clearFallback();
      fallbackNodes = renderFallback(state);
      for (const node of fallbackNodes) parent.insertBefore(node, end);
      return;
    }

    clearFallback();

    for (const [key, row] of rows) {
      if (!nextKeys.has(key)) removeNodes(row.nodes);
    }

    const nextRows = new Map<TKey, ForRow<TItem>>();
    for (const record of records) {
      let row = rows.get(record.key);

      if (!row) {
        row = {
          item: record.item,
          nodes: renderRow(record.item, record.index, items),
        };
      } else if (!Object.is(row.item, record.item)) {
        removeNodes(row.nodes);
        row = {
          item: record.item,
          nodes: renderRow(record.item, record.index, items),
        };
      }

      for (const node of row.nodes) parent.insertBefore(node, end);
      nextRows.set(record.key, row);
    }

    rows = nextRows;
  };

  draw(props.each(props.store.getState()), props.store.getState());

  const unsubscribe = subscribeSelector(
    props.store,
    props.each,
    (items, _oldItems, state) => draw(items, state),
    props.equality,
  );

  addCleanup(start, () => {
    unsubscribe();
    for (const row of rows.values()) removeNodes(row.nodes);
    rows = new Map();
    clearFallback();
  });

  return frag;
}

function setAttributeValue(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name);
    return;
  }
  if (value === true) {
    element.setAttribute(name, "");
    return;
  }
  if (typeof value === "string") {
    element.setAttribute(name, value);
    return;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "symbol") {
    element.setAttribute(name, String(value));
    return;
  }
  if (value instanceof Date) {
    element.setAttribute(name, value.toISOString());
    return;
  }
  try {
    element.setAttribute(name, JSON.stringify(value) ?? Object.prototype.toString.call(value));
  } catch {
    element.setAttribute(name, Object.prototype.toString.call(value));
  }
}

export const bind = {
  text<TState, TValue>(
    store: ReadableStore<TState>,
    selector: Selector<TState, TValue>,
    format: (value: TValue) => string = (value) =>
      value === null || value === undefined ? "" : String(value),
    equality?: Equality<TValue>,
  ): Action<HTMLElement> {
    return (element) => {
      const sync = (value: TValue) => {
        element.textContent = format(value);
      };
      sync(selector(store.getState()));
      return subscribeSelector(store, selector, sync, equality);
    };
  },

  attr<TState, TValue>(
    name: string,
    store: ReadableStore<TState>,
    selector: Selector<TState, TValue>,
    equality?: Equality<TValue>,
  ): Action<Element> {
    return (element) => {
      const sync = (value: TValue) => setAttributeValue(element, name, value);
      sync(selector(store.getState()));
      return subscribeSelector(store, selector, sync, equality);
    };
  },

  class<TState>(
    name: string,
    store: ReadableStore<TState>,
    selector: Selector<TState, boolean>,
    equality?: Equality<boolean>,
  ): Action<Element> {
    return (element) => {
      const sync = (enabled: boolean) => element.classList.toggle(name, enabled);
      sync(selector(store.getState()));
      return subscribeSelector(store, selector, sync, equality);
    };
  },

  value<TState, TValue>(
    store: WritableStore<TState>,
    selector: Selector<TState, TValue>,
    commit: (value: string, state: TState) => Partial<TState> | TState | void,
    options: {
      event?: "input" | "change";
      format?: (value: TValue) => string;
      equality?: Equality<TValue>;
    } = {},
  ): Action<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    return (element) => {
      const format =
        options.format ??
        ((value: TValue) => (value === null || value === undefined ? "" : String(value)));
      const sync = (value: TValue) => {
        const next = format(value);
        if (element.value !== next) element.value = next;
      };
      sync(selector(store.getState()));
      const unsubscribe = subscribeSelector(store, selector, sync, options.equality);
      const eventName = options.event ?? "input";
      const handler = () => {
        const patch = commit(element.value, store.getState());
        if (patch !== undefined) store.setState(patch);
      };
      element.addEventListener(eventName, handler);
      return () => {
        unsubscribe();
        element.removeEventListener(eventName, handler);
      };
    };
  },

  checked<TState>(
    store: WritableStore<TState>,
    selector: Selector<TState, boolean>,
    commit: (checked: boolean, state: TState) => Partial<TState> | TState | void,
    equality?: Equality<boolean>,
  ): Action<HTMLInputElement> {
    return (element) => {
      const sync = (checked: boolean) => {
        if (element.checked !== checked) element.checked = checked;
      };
      sync(selector(store.getState()));
      const unsubscribe = subscribeSelector(store, selector, sync, equality);
      const handler = () => {
        const patch = commit(element.checked, store.getState());
        if (patch !== undefined) store.setState(patch);
      };
      element.addEventListener("change", handler);
      return () => {
        unsubscribe();
        element.removeEventListener("change", handler);
      };
    };
  },
};
