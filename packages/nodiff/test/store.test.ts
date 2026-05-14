import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { derivedStore, effect, list, when } from "../src/store";
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

  test("derives readable stores from explicit dependencies", () => {
    const count = createStore(() => ({ value: 1 }));
    const label = createStore(() => ({ value: "a" }));
    const derived = derivedStore(
      [count, label],
      (countState, labelState) => `${labelState.value}:${countState.value}`,
    );
    const updates: string[] = [];

    expect(derived.getState()).toBe("a:1");

    const unsubscribe = derived.subscribe((state, previousState) => {
      updates.push(`${previousState}->${state}`);
    });

    count.setState({ value: 2 });
    expect(derived.getState()).toBe("a:2");
    expect(updates).toEqual(["a:1->a:2"]);

    count.setState({ value: 2 });
    expect(updates).toEqual(["a:1->a:2"]);

    label.setState({ value: "b" });
    expect(derived.getState()).toBe("b:2");
    expect(updates).toEqual(["a:1->a:2", "a:2->b:2"]);

    unsubscribe();
    label.setState({ value: "c" });

    expect(updates).toEqual(["a:1->a:2", "a:2->b:2"]);
    expect(derived.getState()).toBe("c:2");
  });

  test("supports equality for derived store updates", () => {
    const source = createStore(() => ({ count: 1, label: "first" }));
    const derived = derivedStore([source], (state) => ({ bucket: Math.floor(state.count / 10) }), {
      equality: (left, right) => left.bucket === right.bucket,
    });
    const updates: number[] = [];

    const unsubscribe = derived.subscribe((state) => {
      updates.push(state.bucket);
    });

    source.setState({ count: 2, label: "second" });
    source.setState({ count: 11 });

    expect(updates).toEqual([1]);
    expect(derived.getState()).toEqual({ bucket: 1 });

    unsubscribe();
  });
});
