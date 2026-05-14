export { Fragment, jsx, jsxs } from "./dom";

import type { Child, ElementProps } from "./dom";

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
