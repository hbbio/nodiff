import { addCleanup, cleanupNode, replaceChildrenClean } from "./lifecycle";

export type PrimitiveChild = string | number | bigint | boolean | null | undefined;
export type Child = PrimitiveChild | Node | Child[] | Iterable<Child>;
export type Component<P = Record<string, unknown>> = (props: P & { children?: Child }) => Child;
export type Ref<T extends Node = Node> = ((node: T) => void) | { current: T | null };
export type Action<T extends Element = Element> = (element: T) => void | (() => void);

type EventPair = [EventListenerOrEventListenerObject, AddEventListenerOptions?];

export type StyleValue = string | Partial<CSSStyleDeclaration> | Record<string, string | number | null | undefined>;

export type ElementProps<T extends Element = Element> = {
  children?: Child;
  class?: string | string[] | Record<string, boolean | undefined | null> | false | null | undefined;
  className?: string | string[] | Record<string, boolean | undefined | null> | false | null | undefined;
  style?: StyleValue;
  ref?: Ref<T>;
  use?: Action<T> | Array<Action<T> | false | null | undefined> | false | null | undefined;
  key?: unknown;
  dataset?: Record<string, string | number | boolean | null | undefined>;
  aria?: Record<string, string | number | boolean | null | undefined>;
  innerHTML?: string;
  textContent?: string | number | null | undefined;
  onClick?: (event: MouseEvent & { currentTarget: T }) => void;
  onInput?: (event: InputEvent & { currentTarget: T }) => void;
  onChange?: (event: Event & { currentTarget: T }) => void;
  onSubmit?: (event: SubmitEvent & { currentTarget: T }) => void;
  onKeydown?: (event: KeyboardEvent & { currentTarget: T }) => void;
  onKeyup?: (event: KeyboardEvent & { currentTarget: T }) => void;
  onFocus?: (event: FocusEvent & { currentTarget: T }) => void;
  onBlur?: (event: FocusEvent & { currentTarget: T }) => void;
  [key: `on${string}`]: unknown;
  [key: `data-${string}`]: string | number | boolean | null | undefined;
  [key: `aria-${string}`]: string | number | boolean | null | undefined;
  [key: string]: unknown;
};

const svgTags = new Set([
  "svg",
  "animate",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "feSpecularLighting",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "symbol",
  "text",
  "textPath",
  "tspan",
  "use"
]);

function isIterable(value: unknown): value is Iterable<Child> {
  return typeof value === "object" && value !== null && Symbol.iterator in value;
}

function isNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

function toEventName(prop: string): string | null {
  if (!prop.startsWith("on") || prop.length <= 2) return null;
  const raw = prop.slice(2);
  if (!raw) return null;
  return raw.toLowerCase();
}

function classValue(value: ElementProps["class"]): string | undefined {
  if (value === null || value === undefined || value === false) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name)
      .join(" ");
  }
  return String(value);
}

function setStyle(element: Element, value: StyleValue): void {
  if (typeof value === "string") {
    (element as HTMLElement).style.cssText = value;
    return;
  }

  const style = (element as HTMLElement).style;
  for (const [key, raw] of Object.entries(value as Record<string, string | number | null | undefined>)) {
    if (raw === null || raw === undefined) {
      style.removeProperty(key.includes("-") ? key : key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));
      continue;
    }
    const cssName = key.includes("-") ? key : key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    style.setProperty(cssName, typeof raw === "number" ? String(raw) : raw);
  }
}

function setDataset(element: Element, value: Record<string, string | number | boolean | null | undefined>): void {
  const dataset = (element as HTMLElement).dataset;
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined || raw === false) {
      delete dataset[key];
    } else {
      dataset[key] = String(raw);
    }
  }
}

function setAria(element: Element, value: Record<string, string | number | boolean | null | undefined>): void {
  for (const [key, raw] of Object.entries(value)) {
    const name = key.startsWith("aria-") ? key : `aria-${key}`;
    if (raw === null || raw === undefined || raw === false) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, String(raw));
    }
  }
}

function applyRef<T extends Node>(node: T, ref: Ref<T>): void {
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  ref.current = node;
  addCleanup(node, () => {
    ref.current = null;
  });
}

function applyAction<T extends Element>(element: T, action: ElementProps<T>["use"]): void {
  if (!action) return;
  const actions = Array.isArray(action) ? action : [action];
  for (const item of actions) {
    if (!item) continue;
    addCleanup(element, item(element));
  }
}

function isEventPair(value: unknown): value is EventPair {
  return Array.isArray(value) && typeof value[0] === "function";
}

function applyProp(element: Element, name: string, value: unknown): void {
  if (name === "children" || name === "key") return;

  if (name === "ref" && value) {
    applyRef(element, value as Ref<Element>);
    return;
  }

  if (name === "use") {
    applyAction(element, value as ElementProps["use"]);
    return;
  }

  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name === "className" ? "class" : name);
    return;
  }

  if (name === "class" || name === "className") {
    const classes = classValue(value as ElementProps["class"]);
    if (classes) element.setAttribute("class", classes);
    return;
  }

  if (name === "style") {
    setStyle(element, value as StyleValue);
    return;
  }

  if (name === "dataset" && typeof value === "object") {
    setDataset(element, value as Record<string, string | number | boolean | null | undefined>);
    return;
  }

  if (name === "aria" && typeof value === "object") {
    setAria(element, value as Record<string, string | number | boolean | null | undefined>);
    return;
  }

  if (name === "innerHTML") {
    element.innerHTML = String(value);
    return;
  }

  if (name === "textContent") {
    element.textContent = value === null || value === undefined ? "" : String(value);
    return;
  }

  const eventName = toEventName(name);
  if (eventName) {
    if (typeof value === "function") {
      const listener = value as EventListener;
      element.addEventListener(eventName, listener);
      addCleanup(element, () => element.removeEventListener(eventName, listener));
      return;
    }
    if (isEventPair(value)) {
      const [listener, options] = value;
      element.addEventListener(eventName, listener, options);
      addCleanup(element, () => element.removeEventListener(eventName, listener, options));
      return;
    }
  }

  if (name.startsWith("aria-") || name.startsWith("data-")) {
    element.setAttribute(name, String(value));
    return;
  }

  if (value === true) {
    element.setAttribute(name, "");
    return;
  }

  const target = element as unknown as Record<string, unknown>;
  if (name in target && !(element instanceof SVGElement)) {
    try {
      target[name] = value;
      return;
    } catch {
      element.setAttribute(name, String(value));
      return;
    }
  }

  element.setAttribute(name, String(value));
}

export function toNodes(value: Child): Node[] {
  if (value === null || value === undefined || typeof value === "boolean") return [];
  if (isNode(value)) return [value];
  if (Array.isArray(value)) return value.flatMap((child) => toNodes(child));
  if (typeof value !== "string" && isIterable(value)) {
    return Array.from(value).flatMap((child) => toNodes(child));
  }
  return [document.createTextNode(String(value))];
}

export function fragment(children?: Child): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (children !== undefined) append(frag, children);
  return frag;
}

export function append(parent: Node, value: Child): void {
  for (const node of toNodes(value)) {
    parent.appendChild(node);
  }
}

export function jsx(type: string | Component<unknown>, props: ElementProps | null): Child {
  if (typeof type === "function") {
    return type({ ...(props ?? {}) });
  }

  const element = svgTags.has(type)
    ? document.createElementNS("http://www.w3.org/2000/svg", type)
    : document.createElement(type);

  const currentProps = props ?? {};
  for (const [name, value] of Object.entries(currentProps)) {
    applyProp(element, name, value);
  }

  if (currentProps.children !== undefined && currentProps.innerHTML === undefined && currentProps.textContent === undefined) {
    append(element, currentProps.children);
  }

  return element;
}

export const jsxs = jsx;

export function Fragment(props: { children?: Child }): DocumentFragment {
  return fragment(props.children);
}

export function mount(host: Element | string, node: Child | Component, props?: Record<string, unknown>): () => void {
  const element = typeof host === "string" ? document.querySelector(host) : host;
  if (!element) throw new Error(`Mount target not found: ${String(host)}`);

  const rendered = typeof node === "function" ? (node as Component)(props ?? {}) : node;
  replaceChildrenClean(element, toNodes(rendered));

  return () => {
    cleanupNode(element);
    element.replaceChildren();
  };
}

export function on<T extends Element, K extends keyof HTMLElementEventMap>(
  type: K,
  handler: (event: HTMLElementEventMap[K] & { currentTarget: T }) => void,
  options?: AddEventListenerOptions
): Action<T> {
  return (element) => {
    const listener = handler as EventListener;
    element.addEventListener(type, listener, options);
    return () => element.removeEventListener(type, listener, options);
  };
}

export function setText(text: string | number | null | undefined): Text {
  return document.createTextNode(text === null || text === undefined ? "" : String(text));
}
