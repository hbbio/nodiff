import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { effect, list, when } from "../src/store";
import { installDom } from "./test-dom";

describe("store view helpers", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("runs effects and renders conditional and list views", () => {
    const store = createStore(() => ({
      enabled: true,
      count: 1,
      items: ["a"],
    }));
    const effects: string[] = [];

    const unmount = mount(
      "#app",
      jsx("section", {
        use: effect(
          store,
          (state) => state.count,
          (count, previous, state) => {
            effects.push(`${previous ?? "none"}:${count}:${state.enabled}`);
          },
        ),
        children: [
          when(
            store,
            (state) => state.enabled,
            (state) => `On:${state.count};`,
            (state) => `Off:${state.count};`,
          ),
          list(
            store,
            (state) => state.items,
            (item, index, items) => jsx("span", { children: `${index}/${items.length}:${item};` }),
          ),
        ],
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("On:1;0/1:a;");
    expect(effects).toEqual(["none:1:true"]);

    store.setState({
      enabled: false,
      count: 2,
      items: ["b", "c"],
    });

    expect(document.querySelector("#app")?.textContent).toBe("Off:2;0/2:b;1/2:c;");
    expect(effects).toEqual(["none:1:true", "1:2:false"]);

    unmount();
    store.setState({ count: 3 });

    expect(effects).toEqual(["none:1:true", "1:2:false"]);
  });

  test("renders an empty conditional branch when no fallback is provided", () => {
    const store = createStore(() => ({ enabled: false }));

    const unmount = mount(
      "#app",
      when(
        store,
        (state) => state.enabled,
        () => "Visible",
      ),
    );

    expect(document.querySelector("#app")?.textContent).toBe("");

    store.setState({ enabled: true });
    expect(document.querySelector("#app")?.textContent).toBe("Visible");

    unmount();
  });
});
