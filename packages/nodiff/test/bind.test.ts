import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { configureSecurityPolicy } from "../src/security";
import { bind, type ClassBinding, type StyleBinding } from "../src/store";
import { installDom } from "./test-dom";

type BindingState = {
  style: StyleBinding;
  classes: ClassBinding;
  userId: string | null;
  busy: boolean;
  title: string;
  age: number | null;
  choices: string[];
  color: string;
  selected: string[];
  files: FileList | null;
};

function createBindingStore() {
  return createStore<BindingState>(() => ({
    style: { color: "red", backgroundColor: "white" },
    classes: { active: true, hidden: false },
    userId: "123",
    busy: true,
    title: "Initial",
    age: 1,
    choices: ["red"],
    color: "blue",
    selected: ["a", "c"],
    files: null,
  }));
}

describe("bind helpers", () => {
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

  test("binds style, classes, dataset, aria, and properties", () => {
    const store = createBindingStore();

    const unmount = mount(
      "#app",
      jsx("div", {
        class: "static",
        use: [
          bind.style(store, (state) => state.style),
          bind.classes(store, (state) => state.classes),
          bind.dataset("user-id", store, (state) => state.userId),
          bind.aria("busy", store, (state) => state.busy),
          bind.prop<BindingState, string, HTMLElement>("title", store, (state) => state.title),
        ],
        children: "Bound",
      }),
    );

    const div = document.querySelector("div") as HTMLElement;
    expect(div.style.color).toBe("red");
    expect(div.style.backgroundColor).toBe("white");
    expect(div.classList.contains("static")).toBe(true);
    expect(div.classList.contains("active")).toBe(true);
    expect(div.classList.contains("hidden")).toBe(false);
    expect(div.getAttribute("data-user-id")).toBe("123");
    expect(div.getAttribute("aria-busy")).toBe("true");
    expect(div.title).toBe("Initial");

    store.setState({
      style: { color: "blue", zIndex: 2 },
      classes: ["selected", "static"],
      userId: null,
      busy: false,
      title: "Updated",
    });

    expect(div.style.color).toBe("blue");
    expect(div.style.backgroundColor).toBe("");
    expect(div.style.zIndex).toBe("2");
    expect(div.classList.contains("static")).toBe(true);
    expect(div.classList.contains("active")).toBe(false);
    expect(div.classList.contains("selected")).toBe(true);
    expect(div.hasAttribute("data-user-id")).toBe(false);
    expect(div.hasAttribute("aria-busy")).toBe(false);
    expect(div.title).toBe("Updated");

    store.setState({ style: "display: none; color: green;" });
    expect(div.style.display).toBe("none");
    expect(div.style.color).toBe("green");

    unmount();
  });

  test("binds numeric inputs and removes listeners on cleanup", () => {
    const store = createBindingStore();

    const unmount = mount(
      "#app",
      jsx("input", {
        type: "number",
        use: bind.number(
          store,
          (state) => state.age,
          (age) => ({ age }),
        ),
      }),
    );

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("1");

    store.setState({ age: 7 });
    expect(input.value).toBe("7");

    input.value = "42";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(store.getState().age).toBe(42);

    input.value = "";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(store.getState().age).toBeNull();

    unmount();

    input.value = "9";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(store.getState().age).toBeNull();
  });

  test("binds checkbox groups", () => {
    const store = createBindingStore();

    const unmount = mount(
      "#app",
      jsx("input", {
        type: "checkbox",
        value: "red",
        use: bind.checkedGroup(
          store,
          (state) => state.choices,
          (choices) => ({ choices }),
        ),
      }),
    );

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.checked).toBe(true);

    store.setState({ choices: ["blue"] });
    expect(input.checked).toBe(false);

    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().choices).toEqual(["blue", "red"]);

    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().choices).toEqual(["blue"]);

    unmount();
  });

  test("binds radio groups", () => {
    const store = createBindingStore();

    const unmount = mount("#app", [
      jsx("input", {
        type: "radio",
        name: "color",
        value: "red",
        use: bind.radio(
          store,
          (state) => state.color,
          (color) => ({ color }),
        ),
      }),
      jsx("input", {
        type: "radio",
        name: "color",
        value: "blue",
        use: bind.radio(
          store,
          (state) => state.color,
          (color) => ({ color }),
        ),
      }),
    ]);

    const [red, blue] = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
    expect(red?.checked).toBe(false);
    expect(blue?.checked).toBe(true);

    red!.checked = true;
    red!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().color).toBe("red");
    expect(blue?.checked).toBe(false);

    unmount();
  });

  test("binds multiple select values", () => {
    const store = createBindingStore();

    const unmount = mount(
      "#app",
      jsx("select", {
        multiple: true,
        use: bind.selected(
          store,
          (state) => state.selected,
          (selected) => ({ selected }),
        ),
        children: [
          jsx("option", { value: "a", children: "A" }),
          jsx("option", { value: "b", children: "B" }),
          jsx("option", { value: "c", children: "C" }),
        ],
      }),
    );

    const select = document.querySelector("select") as HTMLSelectElement;
    const selectedValues = () =>
      Array.from(select.options)
        .filter((option) => option.selected)
        .map((option) => option.value);
    expect(selectedValues()).toEqual(["a", "c"]);

    store.setState({ selected: ["b"] });
    expect(selectedValues()).toEqual(["b"]);

    select.options[0]!.selected = true;
    select.options[1]!.selected = true;
    select.options[2]!.selected = false;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().selected).toEqual(["a", "b"]);

    unmount();
  });

  test("binds file inputs", () => {
    const store = createBindingStore();

    const unmount = mount(
      "#app",
      jsx("input", {
        type: "file",
        use: bind.files(store, (files) => ({ files })),
      }),
    );

    const input = document.querySelector("input") as HTMLInputElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;

    Object.defineProperty(input, "files", {
      configurable: true,
      value: files,
    });

    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().files?.item(0)?.name).toBe("hello.txt");

    unmount();

    Object.defineProperty(input, "files", {
      configurable: true,
      value: null,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().files).toBe(files);
  });

  test("blocks unsafe URL and CSS values in bindings", () => {
    const store = createStore(() => ({
      href: "https://example.test",
      style: { color: "green" } as StyleBinding,
    }));

    const unmount = mount(
      "#app",
      jsx("a", {
        use: [
          bind.attr("href", store, (state) => state.href),
          bind.style(store, (state) => state.style),
        ],
        children: "Safe",
      }),
    );

    const link = document.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toBe("https://example.test/");
    expect(link.style.color).toBe("green");

    expect(() => store.setState({ href: "javascript:alert(1)" })).toThrow("disallowed scheme");
    expect(() =>
      store.setState({ style: { backgroundImage: "url(javascript:alert(1))" } }),
    ).toThrow("unsafe CSS");

    unmount();
  });
});
