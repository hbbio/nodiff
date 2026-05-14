import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { Show } from "../src/store";
import { installDom } from "./test-dom";

type SessionState = {
  user: { name: string } | null;
  version: number;
};

describe("Show", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("renders fallback for falsy values and children for truthy values", () => {
    const session = createStore<SessionState>(() => ({ user: null, version: 1 }));

    const unmount = mount(
      "#app",
      Show({
        store: session,
        when: (state) => state.user,
        fallback: (state, value) => `Guest:${state.version}:${value === null}`,
        children: (user, state) => `${user.name}:${state.version}`,
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Guest:1:true");

    session.setState({ user: { name: "Ada" }, version: 2 });
    expect(document.querySelector("#app")?.textContent).toBe("Ada:2");

    session.setState({ user: null, version: 3 });
    expect(document.querySelector("#app")?.textContent).toBe("Guest:3:true");

    unmount();
  });

  test("accepts static child and fallback nodes", () => {
    const store = createStore<{ enabled: boolean }>(() => ({ enabled: true }));

    const unmount = mount(
      "#app",
      Show({
        store,
        when: (state) => state.enabled,
        fallback: jsx("span", { children: "Off" }),
        children: jsx("span", { children: "On" }),
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("On");

    store.setState({ enabled: false });
    expect(document.querySelector("#app")?.textContent).toBe("Off");

    unmount();
  });

  test("cleans replaced branches and unsubscribes on unmount", () => {
    const store = createStore<{ enabled: boolean }>(() => ({ enabled: true }));
    let cleanups = 0;

    const unmount = mount(
      "#app",
      Show({
        store,
        when: (state) => state.enabled,
        fallback: () =>
          jsx("span", {
            use: () => () => {
              cleanups += 1;
            },
            children: "Off",
          }),
        children: () =>
          jsx("span", {
            use: () => () => {
              cleanups += 1;
            },
            children: "On",
          }),
      }),
    );

    store.setState({ enabled: false });
    expect(cleanups).toBe(1);
    expect(document.querySelector("#app")?.textContent).toBe("Off");

    unmount();
    expect(cleanups).toBe(2);

    store.setState({ enabled: true });
    expect(document.querySelector("#app")?.textContent).toBe("");
    expect(cleanups).toBe(2);
  });

  test("honors equality for selected values", () => {
    const store = createStore<{ count: number; label: string }>(() => ({
      count: 1,
      label: "one",
    }));
    let renders = 0;

    const unmount = mount(
      "#app",
      Show({
        store,
        when: (state) => state.count,
        equality: (left, right) => left % 2 === right % 2,
        children: (count, state) => {
          renders += 1;
          return `${count}:${state.label}`;
        },
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("1:one");
    expect(renders).toBe(1);

    store.setState({ count: 3, label: "three" });
    expect(document.querySelector("#app")?.textContent).toBe("1:one");
    expect(renders).toBe(1);

    store.setState({ count: 4, label: "four" });
    expect(document.querySelector("#app")?.textContent).toBe("4:four");
    expect(renders).toBe(2);

    unmount();
  });
});
