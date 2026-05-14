export { Fragment, jsx, jsxs } from "./dom";

import type { Child, Component, IntrinsicElements as DomIntrinsicElements } from "./dom";

export namespace JSX {
  export type Element = Child;
  export type ElementType = keyof DomIntrinsicElements | Component<any>;

  export interface ElementChildrenAttribute {
    children: Record<string, never>;
  }

  export interface IntrinsicAttributes {
    key?: unknown;
  }

  export type IntrinsicElements = DomIntrinsicElements;
}
