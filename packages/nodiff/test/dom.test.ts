import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount, sanitizeHTML, trustedHTML } from "../src/dom";
import { configureSecurityPolicy } from "../src/security";
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
    expect(() => jsx("img", { src: "https://cdn.example.test/image.png" })).toThrow(
      "disallowed origin",
    );
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
});
