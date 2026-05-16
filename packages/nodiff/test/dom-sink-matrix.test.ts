import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx } from "../src/dom";
import { configureSecurityPolicy } from "../src/security";
import { bind, type PropsBinding } from "../src/store";
import { installDom } from "./test-dom";

type SinkCase = {
  name: string;
  tag: string;
  prop: string;
  value: unknown;
};

type WritePath = {
  name: string;
  write(sink: SinkCase): void;
};

const sinkCases: SinkCase[] = [
  {
    name: "innerHTML",
    tag: "div",
    prop: "innerHTML",
    value: "<img src=x onerror=alert(1)>",
  },
  {
    name: "outerHTML",
    tag: "div",
    prop: "outerHTML",
    value: "<img src=x onerror=alert(1)>",
  },
  {
    name: "srcdoc",
    tag: "iframe-preview",
    prop: "srcdoc",
    value: "<script>alert(1)</script>",
  },
  {
    name: "href",
    tag: "a",
    prop: "href",
    value: "javascript:alert(1)",
  },
  {
    name: "srcset",
    tag: "img",
    prop: "srcset",
    value: "/safe.png 1x, javascript:alert(1) 2x",
  },
  {
    name: "style",
    tag: "div",
    prop: "style",
    value: "background-image: url(javascript:alert(1))",
  },
  {
    name: "event handler",
    tag: "button",
    prop: "onClick",
    value: "alert(1)",
  },
];

function render(tag: string, props: Record<string, unknown>): void {
  void jsx(tag, props);
}

function valueStore(value: unknown) {
  return createStore(() => ({ value }));
}

const writePaths: WritePath[] = [
  {
    name: "JSX prop",
    write(sink) {
      render(sink.tag, { [sink.prop]: sink.value });
    },
  },
  {
    name: "bind.attr",
    write(sink) {
      const store = valueStore(sink.value);
      render(sink.tag, {
        use: bind.attr(sink.prop, store, (state) => state.value),
      });
    },
  },
  {
    name: "bind.props direct",
    write(sink) {
      const store = createStore(() => ({
        props: { [sink.prop]: sink.value } satisfies PropsBinding,
      }));
      render(sink.tag, {
        use: bind.props(store, (state) => state.props),
      });
    },
  },
  {
    name: "bind.props attributes",
    write(sink) {
      const store = createStore(() => ({
        props: {
          attributes: { [sink.prop]: sink.value },
        } satisfies PropsBinding,
      }));
      render(sink.tag, {
        use: bind.props(store, (state) => state.props),
      });
    },
  },
];

describe("DOM sink matrix", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    configureSecurityPolicy({});
  });

  afterEach(() => {
    configureSecurityPolicy({});
    cleanupDom?.();
    cleanupDom = undefined;
  });

  for (const writePath of writePaths) {
    for (const sink of sinkCases) {
      test(`blocks ${sink.name} through ${writePath.name}`, () => {
        expect(() => writePath.write(sink)).toThrow();
      });
    }
  }
});
