import { addCleanup, cleanupNode, replaceChildrenClean } from "./lifecycle";
import { safeErrorMessage, toError } from "./errors";
import { getSecurityPolicy } from "./security";

export type PrimitiveChild = string | number | bigint | boolean | null | undefined;
export type Child = PrimitiveChild | Node | Child[] | Iterable<Child>;
export type Component<P extends object = Record<string, unknown>> = (
  props: P & { children?: Child },
) => Child;
export type Ref<T extends Node = Node> = ((node: T) => void) | { current: T | null };
export type Action<T extends Element = Element> = (element: T) => void | (() => void);
type ErrorFallback = Child | ((error: Error) => Child);
type ErrorBoundaryHooks = {
  fallback?: ErrorFallback;
  onError?: (error: Error) => void;
};
export type CatchRenderProps = ErrorBoundaryHooks & {
  render: () => Child;
};
export type ErrorBoundaryProps =
  | CatchRenderProps
  | (ErrorBoundaryHooks & {
      children: Child | (() => Child);
      render?: never;
    });

type EventPair = [EventListenerOrEventListenerObject, AddEventListenerOptions?];
const trustedHTMLMarker = Symbol("nodiff:trustedHTML");

export type TrustedHTML = {
  readonly [trustedHTMLMarker]: true;
  readonly html: string;
};

export type StyleValue =
  | string
  | Partial<CSSStyleDeclaration>
  | Record<string, string | number | null | undefined>;

export type ClassValue =
  | string
  | string[]
  | Record<string, boolean | undefined | null>
  | false
  | null
  | undefined;
export type AttributeValue = string | number | boolean | null | undefined;
export type EventHandler<T extends Element, TEvent extends Event> = (
  event: TEvent & { currentTarget: T },
) => void;
export type EventProp<T extends Element, TEvent extends Event> =
  | EventHandler<T, TEvent>
  | [EventHandler<T, TEvent>, AddEventListenerOptions?];

type EmptyPropValue = false | null | undefined;
type ElementPropertyValue<TValue> =
  | TValue
  | (TValue extends string ? number | bigint : never)
  | (TValue extends number ? `${number}` : never)
  | EmptyPropValue;
type ReservedElementProp =
  | "aria"
  | "attributes"
  | "children"
  | "class"
  | "classList"
  | "className"
  | "dataset"
  | "innerHTML"
  | "key"
  | "outerHTML"
  | "ref"
  | "style"
  | "textContent"
  | "unsafeHTML"
  | "use"
  | `on${string}`;
type ElementPropertyProps<T extends Element, TExcluded extends string = never> = {
  [K in keyof T as K extends string
    ? K extends ReservedElementProp | TExcluded
      ? never
      : T[K] extends (...args: unknown[]) => unknown
        ? never
        : K
    : never]?: ElementPropertyValue<T[K]>;
};
type DataAriaAttributes = {
  [K in `data-${string}`]?: AttributeValue;
} & {
  [K in `aria-${string}`]?: AttributeValue;
};
type DashAttributes = {
  [K in `${string}-${string}`]?: AttributeValue;
} & {
  [K in `on-${string}`]?: never;
};
type SharedAttributes = {
  role?: string | false | null | undefined;
};
type HTMLAttributeAliases = {
  "accept-charset"?: AttributeValue;
  autocapitalize?: AttributeValue;
  autocomplete?: AttributeValue;
  autocorrect?: AttributeValue;
  autofocus?: AttributeValue;
  colspan?: AttributeValue;
  contenteditable?: AttributeValue;
  crossorigin?: AttributeValue;
  enterkeyhint?: AttributeValue;
  for?: AttributeValue;
  formnovalidate?: AttributeValue;
  "http-equiv"?: AttributeValue;
  inputmode?: AttributeValue;
  maxlength?: AttributeValue;
  minlength?: AttributeValue;
  nomodule?: AttributeValue;
  novalidate?: AttributeValue;
  playsinline?: AttributeValue;
  readonly?: AttributeValue;
  rowspan?: AttributeValue;
  spellcheck?: AttributeValue;
  srcset?: AttributeValue;
  tabindex?: AttributeValue;
  usemap?: AttributeValue;
};
type SVGAttributeProps = {
  alignmentBaseline?: AttributeValue;
  baselineShift?: AttributeValue;
  clipPath?: AttributeValue;
  clipRule?: AttributeValue;
  colorInterpolation?: AttributeValue;
  colorInterpolationFilters?: AttributeValue;
  cx?: AttributeValue;
  cy?: AttributeValue;
  d?: AttributeValue;
  dominantBaseline?: AttributeValue;
  fill?: AttributeValue;
  fillOpacity?: AttributeValue;
  fillRule?: AttributeValue;
  filter?: AttributeValue;
  floodColor?: AttributeValue;
  floodOpacity?: AttributeValue;
  fontFamily?: AttributeValue;
  fontSize?: AttributeValue;
  fontStretch?: AttributeValue;
  fontStyle?: AttributeValue;
  fontVariant?: AttributeValue;
  fontWeight?: AttributeValue;
  gradientTransform?: AttributeValue;
  gradientUnits?: AttributeValue;
  height?: AttributeValue;
  markerEnd?: AttributeValue;
  markerMid?: AttributeValue;
  markerStart?: AttributeValue;
  mask?: AttributeValue;
  offset?: AttributeValue;
  opacity?: AttributeValue;
  pathLength?: AttributeValue;
  patternContentUnits?: AttributeValue;
  patternTransform?: AttributeValue;
  patternUnits?: AttributeValue;
  points?: AttributeValue;
  preserveAspectRatio?: AttributeValue;
  r?: AttributeValue;
  rx?: AttributeValue;
  ry?: AttributeValue;
  stopColor?: AttributeValue;
  stopOpacity?: AttributeValue;
  stroke?: AttributeValue;
  strokeDasharray?: AttributeValue;
  strokeDashoffset?: AttributeValue;
  strokeLinecap?: AttributeValue;
  strokeLinejoin?: AttributeValue;
  strokeMiterlimit?: AttributeValue;
  strokeOpacity?: AttributeValue;
  strokeWidth?: AttributeValue;
  textAnchor?: AttributeValue;
  transform?: AttributeValue;
  vectorEffect?: AttributeValue;
  viewBox?: AttributeValue;
  width?: AttributeValue;
  x?: AttributeValue;
  x1?: AttributeValue;
  x2?: AttributeValue;
  xlinkHref?: AttributeValue;
  xmlns?: AttributeValue;
  y?: AttributeValue;
  y1?: AttributeValue;
  y2?: AttributeValue;
} & {
  "alignment-baseline"?: AttributeValue;
  "baseline-shift"?: AttributeValue;
  "clip-path"?: AttributeValue;
  "clip-rule"?: AttributeValue;
  "color-interpolation"?: AttributeValue;
  "color-interpolation-filters"?: AttributeValue;
  "dominant-baseline"?: AttributeValue;
  "fill-opacity"?: AttributeValue;
  "fill-rule"?: AttributeValue;
  "flood-color"?: AttributeValue;
  "flood-opacity"?: AttributeValue;
  "font-family"?: AttributeValue;
  "font-size"?: AttributeValue;
  "font-stretch"?: AttributeValue;
  "font-style"?: AttributeValue;
  "font-variant"?: AttributeValue;
  "font-weight"?: AttributeValue;
  "gradient-transform"?: AttributeValue;
  "gradient-units"?: AttributeValue;
  "marker-end"?: AttributeValue;
  "marker-mid"?: AttributeValue;
  "marker-start"?: AttributeValue;
  "path-length"?: AttributeValue;
  "pattern-content-units"?: AttributeValue;
  "pattern-transform"?: AttributeValue;
  "pattern-units"?: AttributeValue;
  "preserve-aspect-ratio"?: AttributeValue;
  "stop-color"?: AttributeValue;
  "stop-opacity"?: AttributeValue;
  "stroke-dasharray"?: AttributeValue;
  "stroke-dashoffset"?: AttributeValue;
  "stroke-linecap"?: AttributeValue;
  "stroke-linejoin"?: AttributeValue;
  "stroke-miterlimit"?: AttributeValue;
  "stroke-opacity"?: AttributeValue;
  "stroke-width"?: AttributeValue;
  "text-anchor"?: AttributeValue;
  "vector-effect"?: AttributeValue;
  "xlink:href"?: AttributeValue;
};
type EventProps<T extends Element> = {
  [K in keyof GlobalEventHandlersEventMap as `on${Capitalize<string & K>}`]?: EventProp<
    T,
    GlobalEventHandlersEventMap[K]
  >;
} & {
  onAnimationEnd?: EventProp<T, AnimationEvent>;
  onAnimationIteration?: EventProp<T, AnimationEvent>;
  onAnimationStart?: EventProp<T, AnimationEvent>;
  onBeforeInput?: EventProp<T, InputEvent>;
  onContextMenu?: EventProp<T, MouseEvent>;
  onDoubleClick?: EventProp<T, MouseEvent>;
  onDragEnd?: EventProp<T, DragEvent>;
  onDragEnter?: EventProp<T, DragEvent>;
  onDragLeave?: EventProp<T, DragEvent>;
  onDragOver?: EventProp<T, DragEvent>;
  onDragStart?: EventProp<T, DragEvent>;
  onFocusIn?: EventProp<T, FocusEvent>;
  onFocusOut?: EventProp<T, FocusEvent>;
  onKeyDown?: EventProp<T, KeyboardEvent>;
  onKeyUp?: EventProp<T, KeyboardEvent>;
  onMouseDown?: EventProp<T, MouseEvent>;
  onMouseEnter?: EventProp<T, MouseEvent>;
  onMouseLeave?: EventProp<T, MouseEvent>;
  onMouseMove?: EventProp<T, MouseEvent>;
  onMouseOut?: EventProp<T, MouseEvent>;
  onMouseOver?: EventProp<T, MouseEvent>;
  onMouseUp?: EventProp<T, MouseEvent>;
  onPointerDown?: EventProp<T, PointerEvent>;
  onPointerEnter?: EventProp<T, PointerEvent>;
  onPointerLeave?: EventProp<T, PointerEvent>;
  onPointerMove?: EventProp<T, PointerEvent>;
  onPointerOut?: EventProp<T, PointerEvent>;
  onPointerOver?: EventProp<T, PointerEvent>;
  onPointerUp?: EventProp<T, PointerEvent>;
  onTouchCancel?: EventProp<T, TouchEvent>;
  onTouchEnd?: EventProp<T, TouchEvent>;
  onTouchMove?: EventProp<T, TouchEvent>;
  onTouchStart?: EventProp<T, TouchEvent>;
  onTransitionEnd?: EventProp<T, TransitionEvent>;
};

type BaseElementProps<T extends Element, TExcluded extends string = never> = CommonElementProps<T> &
  EventProps<T> &
  SharedAttributes &
  DataAriaAttributes &
  DashAttributes &
  ElementPropertyProps<T, TExcluded>;

export type CommonElementProps<T extends Element = Element> = {
  children?: Child;
  class?: ClassValue;
  className?: ClassValue;
  style?: StyleValue;
  ref?: Ref<T>;
  use?: Action<T> | Array<Action<T> | false | null | undefined> | false | null | undefined;
  key?: unknown;
  dataset?: Record<string, string | number | boolean | null | undefined>;
  aria?: Record<string, string | number | boolean | null | undefined>;
  unsafeHTML?: TrustedHTML;
  textContent?: string | number | null | undefined;
};

export type HTMLElementProps<T extends HTMLElement = HTMLElement> = BaseElementProps<T> &
  HTMLAttributeAliases;
export type SVGElementProps<T extends SVGElement = SVGElement> = BaseElementProps<
  T,
  Extract<keyof SVGAttributeProps, string>
> &
  SVGAttributeProps;
export type ElementProps<T extends Element = Element> = T extends SVGElement
  ? SVGElementProps<T>
  : T extends HTMLElement
    ? HTMLElementProps<T>
    : BaseElementProps<T>;
export type HTMLIntrinsicElements = {
  [K in keyof HTMLElementTagNameMap]: HTMLElementProps<HTMLElementTagNameMap[K]>;
};
export type SVGIntrinsicElements = {
  [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: SVGElementProps<
    SVGElementTagNameMap[K]
  >;
};
export type CustomElementProps = HTMLElementProps<HTMLElement> & Record<string, unknown>;
export type CustomIntrinsicElements = {
  [K in `${string}-${string}`]: CustomElementProps;
};
export type IntrinsicElements = HTMLIntrinsicElements &
  SVGIntrinsicElements &
  CustomIntrinsicElements;

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
  "use",
]);

const blockedElementTags = new Set(["script", "iframe", "object", "embed"]);
const rawHtmlSanitizerBlockedTags = new Set([...blockedElementTags, "link", "meta"]);
const urlAttributes = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "poster",
  "cite",
  "xlink:href",
]);

function isIterable(value: unknown): value is Iterable<Child> {
  return typeof value === "object" && value !== null && Symbol.iterator in value;
}

function isNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

const eventAliases = new Map([["DoubleClick", "dblclick"]]);

function toEventName(prop: string): string | null {
  if (!prop.startsWith("on") || prop.length <= 2) return null;
  const raw = prop.slice(2);
  if (!raw) return null;
  return eventAliases.get(raw) ?? raw.toLowerCase();
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

function domString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  try {
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function reportDomViolation(message: string, value?: string): never {
  const violation = {
    type: "blocked-dom",
    message,
  } as const;
  throw getSecurityPolicy().report(value === undefined ? violation : { ...violation, value });
}

function isTrustedHTML(value: unknown): value is TrustedHTML {
  return typeof value === "object" && value !== null && trustedHTMLMarker in value;
}

export function trustedHTML(html: string): TrustedHTML {
  return Object.freeze({ [trustedHTMLMarker]: true, html } satisfies TrustedHTML);
}

export function assertSafeCssValue(value: string, context = "style"): void {
  if (/(?:url\s*\(|expression\s*\()/i.test(value)) {
    reportDomViolation(`Blocked unsafe CSS value in ${context}.`, value);
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function safeUrlAttributeValue(element: Element, name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return value;

  const policy = getSecurityPolicy();
  const context = `${element.tagName.toLowerCase()}.${name}`;
  const url = policy.assertSafeUrl(trimmed, context);
  if (policy.isStrict() && isHttpUrl(url)) policy.assertAllowedOrigin(url, context);
  return value;
}

export function validateAttributeValue(element: Element, name: string, value: string): void {
  const normalized = name.toLowerCase();
  if (normalized.startsWith("on")) {
    reportDomViolation(`Event handler attributes are not supported: ${name}.`, value);
  }
  if (normalized === "style") assertSafeCssValue(value, "style attribute");
  if (urlAttributes.has(normalized)) safeUrlAttributeValue(element, normalized, value);
}

function assertSafeElementType(type: string): void {
  const normalized = type.toLowerCase();
  if (blockedElementTags.has(normalized)) {
    reportDomViolation(`The <${normalized}> element is not supported by the JSX runtime.`);
  }
}

function enforceAnchorRel(element: Element): void {
  if (!(element instanceof HTMLAnchorElement)) return;
  if (element.target !== "_blank") return;

  const rel = new Set(element.rel.split(/\s+/).filter(Boolean));
  rel.add("noopener");
  rel.add("noreferrer");
  element.rel = Array.from(rel).join(" ");
}

export function sanitizeHTML(html: string): TrustedHTML {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (rawHtmlSanitizerBlockedTags.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      try {
        validateAttributeValue(element, attribute.name, attribute.value);
      } catch {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return trustedHTML(template.innerHTML);
}

function setStyle(element: Element, value: StyleValue): void {
  if (typeof value === "string") {
    assertSafeCssValue(value);
    (element as HTMLElement).style.cssText = value;
    return;
  }

  const style = (element as HTMLElement).style;
  for (const [key, raw] of Object.entries(
    value as Record<string, string | number | null | undefined>,
  )) {
    if (raw === null || raw === undefined) {
      style.removeProperty(
        key.includes("-") ? key : key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`),
      );
      continue;
    }
    const cssName = key.includes("-")
      ? key
      : key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    const next = typeof raw === "number" ? String(raw) : raw;
    assertSafeCssValue(next, cssName);
    style.setProperty(cssName, next);
  }
}

function setDataset(
  element: Element,
  value: Record<string, string | number | boolean | null | undefined>,
): void {
  const dataset = (element as HTMLElement).dataset;
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined || raw === false) {
      delete dataset[key];
    } else {
      dataset[key] = String(raw);
    }
  }
}

function setAria(
  element: Element,
  value: Record<string, string | number | boolean | null | undefined>,
): void {
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

function applyAction<T extends Element>(element: T, action: CommonElementProps<T>["use"]): void {
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
    throw new Error("The innerHTML prop is not supported. Use unsafeHTML for explicit raw HTML.");
  }

  if (name === "unsafeHTML") {
    if (!isTrustedHTML(value)) {
      throw new Error("The unsafeHTML prop requires trustedHTML(...) or sanitizeHTML(...).");
    }
    element.innerHTML = value.html;
    return;
  }

  if (name === "textContent") {
    element.textContent = domString(value);
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
    throw new Error(`Event prop ${name} must be a function or [function, options] pair.`);
  }

  if (name.startsWith("aria-") || name.startsWith("data-")) {
    const next = domString(value);
    validateAttributeValue(element, name, next);
    element.setAttribute(name, next);
    return;
  }

  if (value === true) {
    element.setAttribute(name, "");
    return;
  }

  const target = element as unknown as Record<string, unknown>;
  if (name in target && !(element instanceof SVGElement)) {
    try {
      if (typeof value === "string") validateAttributeValue(element, name, value);
      target[name] = value;
      return;
    } catch {
      const next = domString(value);
      validateAttributeValue(element, name, next);
      element.setAttribute(name, next);
      return;
    }
  }

  const next = domString(value);
  validateAttributeValue(element, name, next);
  element.setAttribute(name, next);
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

export function jsx<P extends object>(
  type: Component<P>,
  props: (P & { children?: Child }) | null,
): Child;
export function jsx<K extends keyof HTMLElementTagNameMap>(
  type: K,
  props: HTMLElementProps<HTMLElementTagNameMap[K]> | null,
): Child;
export function jsx<K extends keyof SVGElementTagNameMap>(
  type: K,
  props: SVGElementProps<SVGElementTagNameMap[K]> | null,
): Child;
export function jsx<K extends keyof CustomIntrinsicElements>(
  type: K,
  props: CustomElementProps | null,
): Child;
export function jsx(type: string, props: ElementProps | null): Child;
export function jsx(type: string | Component<any>, props: Record<string, unknown> | null): Child {
  if (typeof type === "function") {
    return type({ ...props });
  }

  assertSafeElementType(type);

  const element = svgTags.has(type)
    ? document.createElementNS("http://www.w3.org/2000/svg", type)
    : document.createElement(type);

  const currentProps = props ?? {};
  for (const [name, value] of Object.entries(currentProps)) {
    if (name === "use") continue;
    applyProp(element, name, value);
  }

  if (
    currentProps.children !== undefined &&
    currentProps.unsafeHTML === undefined &&
    currentProps.textContent === undefined
  ) {
    append(element, currentProps.children as Child);
  }

  if (currentProps.use !== undefined) {
    applyProp(element, "use", currentProps.use);
  }

  enforceAnchorRel(element);

  return element;
}

export const jsxs = jsx;

export function Fragment(props: { children?: Child }): DocumentFragment {
  return fragment(props.children);
}

function reportException(error: Error): void {
  getSecurityPolicy().notify({
    type: "exception",
    message: "Render exception captured.",
    value: error.name,
  });
}

function defaultErrorFallback(error: Error): HTMLElement {
  const element = document.createElement("p");
  element.setAttribute("role", "alert");
  element.textContent = safeErrorMessage(error);
  return element;
}

function renderWithBoundary(props: ErrorBoundaryHooks, render: () => Child): Child {
  try {
    return render();
  } catch (caught) {
    const error = toError(caught);
    props.onError?.(error);
    reportException(error);
    if (props.fallback === undefined) return defaultErrorFallback(error);
    return typeof props.fallback === "function" ? props.fallback(error) : props.fallback;
  }
}

export function catchRender(props: CatchRenderProps): Child {
  return renderWithBoundary(props, props.render);
}

export function ErrorBoundary(props: ErrorBoundaryProps): Child {
  if (props.render) return catchRender(props);
  if (typeof props.children === "function") return renderWithBoundary(props, props.children);
  return props.children;
}

export function mount(
  host: Element | string,
  node: Child | Component,
  props?: Record<string, unknown>,
): () => void {
  const element = typeof host === "string" ? document.querySelector(host) : host;
  if (!element)
    throw new Error(
      `Mount target not found: ${typeof host === "string" ? host : host.tagName.toLowerCase()}`,
    );

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
  options?: AddEventListenerOptions,
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
