import { addCleanup, clearBetween } from "./lifecycle";
import { type Action, type Child, toNodes } from "./dom";

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
  equality: Equality<TValue> = Object.is
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
  equality?: Equality<TValue>
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
      equality
    );

    void element;
    return unsubscribe;
  };
}

export function text<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  format: (value: TValue) => string = (value) => (value === null || value === undefined ? "" : String(value)),
  equality?: Equality<TValue>
): Text {
  const node = document.createTextNode(format(selector(store.getState())));
  const unsubscribe = subscribeSelector(
    store,
    selector,
    (value) => {
      node.data = format(value);
    },
    equality
  );
  addCleanup(node, unsubscribe);
  return node;
}

export function view<TState, TValue>(
  store: ReadableStore<TState>,
  selector: Selector<TState, TValue>,
  render: (value: TValue, state: TState) => Child,
  options: { equality?: Equality<TValue> } = {}
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
    options.equality
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
  no?: (state: TState) => Child
): DocumentFragment {
  return view(store, predicate, (enabled, state) => (enabled ? yes(state) : no?.(state) ?? null));
}

export function list<TState, TItem>(
  store: ReadableStore<TState>,
  selector: Selector<TState, readonly TItem[]>,
  render: (item: TItem, index: number, items: readonly TItem[]) => Child,
  options: { equality?: Equality<readonly TItem[]> } = {}
): DocumentFragment {
  return view(
    store,
    selector,
    (items) => items.map((item, index) => render(item, index, items)),
    options
  );
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
    format: (value: TValue) => string = (value) => (value === null || value === undefined ? "" : String(value)),
    equality?: Equality<TValue>
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
    equality?: Equality<TValue>
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
    equality?: Equality<boolean>
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
    options: { event?: "input" | "change"; format?: (value: TValue) => string; equality?: Equality<TValue> } = {}
  ): Action<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    return (element) => {
      const format = options.format ?? ((value: TValue) => (value === null || value === undefined ? "" : String(value)));
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
    equality?: Equality<boolean>
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
  }
};
