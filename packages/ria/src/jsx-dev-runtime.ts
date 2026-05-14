export { Fragment } from "./dom";

import { jsx } from "./dom";
import type { Child, Component, ElementProps } from "./dom";

export function jsxDEV(
  type: string | Component<unknown>,
  props: ElementProps | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown
): Child {
  return jsx(type, props);
}

export namespace JSX {
  export type Element = Child;
  export type ElementType = string | ((props: any) => Child);

  export interface ElementChildrenAttribute {
    children: Record<string, never>;
  }

  export interface IntrinsicAttributes {
    key?: unknown;
  }

  export interface IntrinsicElements {
    [elementName: string]: ElementProps<any>;
  }
}
