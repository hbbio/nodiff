import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { fragment, jsx, mount } from "../src/dom";
import { For } from "../src/store";
import { installDom } from "./test-dom";

type Item = {
  id: string;
  label: string;
};

function orderedIds(): string[] {
  return Array.from(document.querySelectorAll("[data-id]")).map(
    (element) => element.getAttribute("data-id") ?? "",
  );
}

describe("For", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("moves keyed rows without re-rendering stable item identities", () => {
    const alpha: Item = { id: "a", label: "Alpha" };
    const beta: Item = { id: "b", label: "Beta" };
    const items = createStore<{ items: Item[] }>(() => ({ items: [alpha, beta] }));
    let renders = 0;

    const unmount = mount(
      "#app",
      For({
        store: items,
        each: (state) => state.items,
        by: (item) => item.id,
        children: (item) => {
          renders += 1;
          return jsx("article", {
            dataset: { id: item.id },
            children: item.label,
          });
        },
      }),
    );

    const alphaNode = document.querySelector('[data-id="a"]');
    expect(orderedIds()).toEqual(["a", "b"]);
    expect(renders).toBe(2);

    items.setState({ items: [beta, alpha] });

    expect(orderedIds()).toEqual(["b", "a"]);
    expect(renders).toBe(2);
    expect(document.querySelector('[data-id="a"]')).toBe(alphaNode);

    unmount();
  });

  test("re-renders changed item identities, cleans removed rows, and shows fallback", () => {
    const initial: Item = { id: "a", label: "Alpha" };
    const updated: Item = { id: "a", label: "Updated alpha" };
    const items = createStore<{ items: Item[] }>(() => ({ items: [initial] }));
    let cleanups = 0;

    const unmount = mount(
      "#app",
      For({
        store: items,
        each: (state) => state.items,
        by: (item) => item.id,
        fallback: "Empty",
        children: (item) =>
          jsx("article", {
            dataset: { id: item.id },
            use: () => () => {
              cleanups += 1;
            },
            children: item.label,
          }),
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Alpha");

    items.setState({ items: [updated] });
    expect(document.querySelector("#app")?.textContent).toBe("Updated alpha");
    expect(cleanups).toBe(1);

    items.setState({ items: [] });
    expect(document.querySelector("#app")?.textContent).toBe("Empty");
    expect(cleanups).toBe(2);

    unmount();
  });

  test("rejects duplicate keys before mutating the rendered list", () => {
    const items = createStore<{ items: Item[] }>(() => ({
      items: [
        { id: "a", label: "Alpha" },
        { id: "a", label: "Again" },
      ],
    }));

    expect(() =>
      For({
        store: items,
        each: (state) => state.items,
        by: (item) => item.id,
        children: (item) => item.label,
      }),
    ).toThrow("Duplicate key in For");
  });

  test("renders fragment rows and labels unserializable duplicate keys", () => {
    const items = createStore<{ items: Item[] }>(() => ({
      items: [{ id: "a", label: "Alpha" }],
    }));

    const unmount = mount(
      "#app",
      For({
        store: items,
        each: (state) => state.items,
        by: (item) => item.id,
        children: (item) =>
          fragment([
            jsx("span", {
              dataset: { id: item.id },
              children: item.label,
            }),
            "!",
          ]),
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Alpha!");
    unmount();

    const key: Record<string, unknown> = {};
    key.self = key;
    const duplicates = createStore<{ items: Item[] }>(() => ({
      items: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    }));

    expect(() =>
      For({
        store: duplicates,
        each: (state) => state.items,
        by: () => key,
        children: (item) => item.label,
      }),
    ).toThrow("Duplicate key in For: [object Object]");
  });
});
