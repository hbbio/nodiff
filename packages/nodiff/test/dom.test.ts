import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import {
  ErrorBoundary,
  Fragment,
  catchRender,
  fragment,
  jsx,
  mount,
  on,
  sanitizeHTML,
  setText,
  toNodes,
  trustedHTML,
} from "../src/dom";
import { configureSecurityPolicy, type SecurityViolation } from "../src/security";
import { text, view } from "../src/store";
import { installDom } from "./test-dom";

describe("DOM runtime", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
    configureSecurityPolicy({});
  });

  afterEach(() => {
    configureSecurityPolicy({});
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("mount renders direct DOM nodes and runs action cleanup on unmount", () => {
    let clicks = 0;
    let cleanups = 0;

    const unmount = mount(
      "#app",
      jsx("button", {
        onClick: () => {
          clicks += 1;
        },
        use: () => () => {
          cleanups += 1;
        },
        children: "Save",
      }),
    );

    document.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(clicks).toBe(1);
    expect(document.querySelector("button")?.textContent).toBe("Save");

    unmount();

    expect(cleanups).toBe(1);
    expect(document.querySelector("#app")?.childNodes).toHaveLength(0);
  });

  test("text bindings unsubscribe when their node is cleaned up", () => {
    const counter = createStore<{ count: number }>(() => ({ count: 0 }));
    const countText = text(counter, (state) => state.count);
    const unmount = mount("#app", jsx("p", { children: ["Count: ", countText] }));

    counter.setState({ count: 1 });
    expect(document.querySelector("#app")?.textContent).toBe("Count: 1");

    unmount();
    counter.setState({ count: 2 });

    expect(countText.data).toBe("1");
  });

  test("view redraws bounded regions and cleans replaced nodes", () => {
    const toggle = createStore<{ enabled: boolean }>(() => ({ enabled: true }));
    let cleanups = 0;

    const unmount = mount(
      "#app",
      view(
        toggle,
        (state) => state.enabled,
        (enabled) =>
          enabled
            ? jsx("span", {
                use: () => () => {
                  cleanups += 1;
                },
                children: "Enabled",
              })
            : jsx("span", { children: "Disabled" }),
      ),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Enabled");

    toggle.setState({ enabled: false });
    expect(cleanups).toBe(1);
    expect(document.querySelector("#app")?.textContent).toBe("Disabled");

    unmount();
  });

  test("requires explicit unsafeHTML for raw HTML injection", () => {
    const node = jsx("div", {
      unsafeHTML: trustedHTML("<strong>Trusted</strong>"),
      children: "Ignored",
    });

    expect(node).toBeInstanceOf(HTMLElement);
    expect((node as HTMLElement).innerHTML).toBe("<strong>Trusted</strong>");
    expect(() => jsx("div", { innerHTML: "<strong>nope</strong>" })).toThrow("Use unsafeHTML");
    expect(() => jsx("div", { unsafeHTML: "<strong>nope</strong>" })).toThrow("trustedHTML");
  });

  test("sanitizes raw HTML before it reaches unsafeHTML", () => {
    const node = jsx("div", {
      unsafeHTML: sanitizeHTML(
        '<strong onclick="alert(1)">Safe</strong><a href="javascript:alert(1)">bad</a><script>alert(1)</script>',
      ),
    }) as HTMLElement;

    expect(node.querySelector("strong")?.textContent).toBe("Safe");
    expect(node.querySelector("strong")?.hasAttribute("onclick")).toBe(false);
    expect(node.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(node.querySelector("script")).toBeNull();
  });

  test("blocks dangerous DOM sinks and preserves safe ones", () => {
    const link = jsx("a", {
      href: "https://example.test/docs",
      target: "_blank",
      children: "Docs",
    }) as HTMLAnchorElement;

    expect(link.href).toBe("https://example.test/docs");
    expect(link.rel.split(/\s+/).sort()).toEqual(["noopener", "noreferrer"]);

    expect(() => jsx("a", { href: "javascript:alert(1)", children: "Bad" })).toThrow(
      "disallowed scheme",
    );
    expect(() =>
      jsx("img", {
        srcset: "/safe.png 1x, javascript:alert(1) 2x",
      }),
    ).toThrow("disallowed scheme");
    expect(() => jsx("button", { onClick: "alert(1)", children: "Bad" })).toThrow(
      "must be a function",
    );
    expect(() => jsx("script", { children: "alert(1)" })).toThrow("not supported");
  });

  test("blocks CSS execution sinks in static styles", () => {
    const node = jsx("div", {
      style: { color: "red" },
    }) as HTMLElement;

    expect(node.style.color).toBe("red");
    expect(() => jsx("div", { style: "background: url(javascript:alert(1))" })).toThrow(
      "unsafe CSS",
    );
    expect(() =>
      jsx("div", {
        style: { backgroundImage: "url(javascript:alert(1))" },
      }),
    ).toThrow("unsafe CSS");
  });

  test("applies strict origin checks to URL attributes", () => {
    configureSecurityPolicy({
      mode: "strict",
      allowedOrigins: ["self"],
    });

    expect(() => jsx("a", { href: "/local", children: "Local" })).not.toThrow();
    expect(() => jsx("img", { srcset: "/local.png 1x, /large.png 2x" })).not.toThrow();
    expect(() => jsx("img", { src: "https://cdn.example.test/image.png" })).toThrow(
      "disallowed origin",
    );
    expect(() =>
      jsx("img", {
        srcset: "/local.png 1x, https://cdn.example.test/image.png 2x",
      }),
    ).toThrow("disallowed origin");
  });

  test("runs actions after children are appended", () => {
    let childCount = -1;

    const unmount = mount(
      "#app",
      jsx("section", {
        use: (element) => {
          childCount = element.children.length;
        },
        children: [jsx("span", { children: "One" }), jsx("span", { children: "Two" })],
      }),
    );

    expect(childCount).toBe(2);

    unmount();
  });

  test("applies JSX prop variants for classes, refs, events, and coerced attributes", () => {
    const objectRef: { current: HTMLInputElement | null } = { current: null };
    let functionRef: Element | null = null;
    let pairClicks = 0;
    let doubleClicks = 0;
    let helperClicks = 0;
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const unmount = mount("#app", [
      jsx("button", {
        class: ["primary", "", "wide"],
        style: { color: "red", backgroundColor: null },
        dataset: { id: "save", gone: false },
        aria: { label: "Save", hidden: false },
        ref: (node) => {
          functionRef = node;
        },
        onClick: [
          () => {
            pairClicks += 1;
          },
          { once: true },
        ],
        onDoubleClick: () => {
          doubleClicks += 1;
        },
        "data-count": 2,
        "data-symbol": Symbol("flag") as unknown as string,
        "data-object": { ok: true } as unknown as string,
        "data-circular": circular as unknown as string,
        "aria-live": "polite",
        custom: "value",
        hidden: true,
        title: false,
        textContent: new Date("2020-01-02T00:00:00.000Z") as unknown as string,
      }),
      jsx("input", {
        ref: objectRef,
        value: 42,
        use: on("click", () => {
          helperClicks += 1;
        }),
      }),
      jsx("div", { class: 7 as unknown as string }),
      jsx("div", { className: { active: true, hidden: false } }),
      jsx("div", { className: false }),
      jsx("div", { tagName: "section" }),
    ]);

    const button = document.querySelector("button") as HTMLButtonElement;
    const input = document.querySelector("input") as HTMLInputElement;

    expect(button.className).toBe("primary wide");
    expect(button.style.color).toBe("red");
    expect(button.dataset.id).toBe("save");
    expect(button.dataset.gone).toBeUndefined();
    expect(button.getAttribute("aria-label")).toBe("Save");
    expect(button.hasAttribute("aria-hidden")).toBe(false);
    expect(button.getAttribute("data-count")).toBe("2");
    expect(button.getAttribute("data-symbol")).toBe("Symbol(flag)");
    expect(button.getAttribute("data-object")).toBe('{"ok":true}');
    expect(button.getAttribute("data-circular")).toBe("[object Object]");
    expect(button.getAttribute("aria-live")).toBe("polite");
    expect(button.getAttribute("custom")).toBe("value");
    expect(button.hidden).toBe(true);
    expect(button.hasAttribute("title")).toBe(false);
    expect(button.textContent).toBe("2020-01-02T00:00:00.000Z");
    expect(functionRef).toBe(button);
    expect(objectRef.current).toBe(input);
    expect(input.value).toBe("42");
    expect(document.querySelectorAll("div")[0]?.className).toBe("7");
    expect(document.querySelectorAll("div")[1]?.className).toBe("active");
    expect(document.querySelectorAll("div")[3]?.getAttribute("tagName")).toBe("section");

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(pairClicks).toBe(1);
    expect(doubleClicks).toBe(1);
    expect(helperClicks).toBe(1);

    unmount();
    expect(objectRef.current).toBeNull();

    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(helperClicks).toBe(1);
  });

  test("supports fragments, components, iterable children, and missing mount errors", () => {
    const Component = (props: { children?: unknown }) =>
      jsx("strong", { children: props.children as string });
    const nodes = toNodes(new Set(["A", jsx("span", { children: "B" })]));
    const empty = fragment();
    const built = Fragment({
      children: [jsx(Component, { children: "Ready" }), fragment(nodes), setText(null), setText(5)],
    });

    const unmount = mount("#app", built);

    expect(empty.childNodes).toHaveLength(0);
    expect(document.querySelector("#app")?.textContent).toBe("ReadyAB5");
    expect(() => mount("#missing", "Nope")).toThrow("Mount target not found: #missing");

    unmount();
  });

  test("catchRender renders successful children without security reports", () => {
    const violations: SecurityViolation[] = [];
    configureSecurityPolicy({
      onViolation: (violation) => violations.push(violation),
    });

    const unmount = mount(
      "#app",
      catchRender({
        render: () => jsx("strong", { children: "Ready" }),
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Ready");
    expect(violations).toHaveLength(0);

    unmount();
  });

  test("catchRender catches render exceptions without leaking details", () => {
    const violations: SecurityViolation[] = [];
    const seen: string[] = [];
    configureSecurityPolicy({
      onViolation: (violation) => violations.push(violation),
    });
    const secretError = new Error("database password=secret-token");

    const unmount = mount(
      "#app",
      catchRender({
        render: () => {
          throw secretError;
        },
        onError: (error) => seen.push(error.message),
      }),
    );

    const textContent = document.querySelector("#app")?.textContent ?? "";
    expect(textContent).toBe("Something went wrong.");
    expect(textContent).not.toContain("secret-token");
    expect(seen).toEqual(["database password=secret-token"]);
    expect(violations).toEqual([
      {
        type: "exception",
        message: "Render exception captured.",
        value: "Error",
      },
    ]);

    unmount();
  });

  test("ErrorBoundary supports render props, function children, and direct children", () => {
    const renderProp = ErrorBoundary({
      render: () => jsx("strong", { children: "Render prop" }),
    });
    const functionChild = ErrorBoundary({
      children: () => jsx("em", { children: "Function child" }),
    });
    const directChild = jsx("span", { children: "Already rendered" });

    expect(ErrorBoundary({ children: directChild })).toBe(directChild);

    const unmount = mount("#app", [renderProp, functionChild, directChild]);

    expect(document.querySelector("#app")?.textContent).toBe(
      "Render propFunction childAlready rendered",
    );

    unmount();
  });
});
