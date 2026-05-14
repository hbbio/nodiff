import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { text, view } from "../src/store";
import { installDom } from "./test-dom";

describe("DOM runtime", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
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
      unsafeHTML: "<strong>Trusted</strong>",
      children: "Ignored",
    });

    expect(node).toBeInstanceOf(HTMLElement);
    expect((node as HTMLElement).innerHTML).toBe("<strong>Trusted</strong>");
    expect(() => jsx("div", { innerHTML: "<strong>nope</strong>" })).toThrow("Use unsafeHTML");
  });
});
