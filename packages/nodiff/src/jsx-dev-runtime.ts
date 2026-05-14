export { Fragment } from "./dom";

import { jsx } from "./dom";
import type {
  Child,
  Component,
  CustomElementProps,
  CustomIntrinsicElements,
  ElementProps,
  HTMLElementProps,
  IntrinsicElements as DomIntrinsicElements,
  SVGElementProps,
} from "./dom";

export function jsxDEV<P extends object>(
  type: Component<P>,
  props: (P & { children?: Child }) | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child;
export function jsxDEV<K extends keyof HTMLElementTagNameMap>(
  type: K,
  props: HTMLElementProps<HTMLElementTagNameMap[K]> | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child;
export function jsxDEV<K extends keyof SVGElementTagNameMap>(
  type: K,
  props: SVGElementProps<SVGElementTagNameMap[K]> | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child;
export function jsxDEV<K extends keyof CustomIntrinsicElements>(
  type: K,
  props: CustomElementProps | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child;
export function jsxDEV(
  type: string,
  props: ElementProps | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child;
export function jsxDEV(
  type: string | Component<any>,
  props: Record<string, unknown> | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Child {
  return jsx(type as any, props as any);
}

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
