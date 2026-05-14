import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { jsx, mount } from "../src/dom";
import { configureSecurityPolicy } from "../src/security";
import { bind, type ClassBinding, type PropsBinding, type StyleBinding } from "../src/store";
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

  test("binds grouped props and cleans removed keys", () => {
    const store = createStore(() => ({
      props: {
        disabled: true,
        title: "Initial",
        class: { active: true, stale: true },
        style: { color: "red", backgroundColor: "white" },
        dataset: { "user-id": "123", gone: true },
        aria: { busy: true, label: "Save" },
        attributes: { "data-extra": 7 },
        textContent: "Loading",
      },
    }));

    const unmount = mount(
      "#app",
      jsx("button", {
        class: "static",
        use: bind.props(store, (state) => state.props),
      }),
    );

    const button = document.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("Initial");
    expect(button.classList.contains("static")).toBe(true);
    expect(button.classList.contains("active")).toBe(true);
    expect(button.classList.contains("stale")).toBe(true);
    expect(button.style.color).toBe("red");
    expect(button.style.backgroundColor).toBe("white");
    expect(button.getAttribute("data-user-id")).toBe("123");
    expect(button.getAttribute("data-gone")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Save");
    expect(button.getAttribute("data-extra")).toBe("7");
    expect(button.textContent).toBe("Loading");

    store.setState({
      props: {
        disabled: false,
        className: ["selected"],
        style: { color: "blue", backgroundColor: null },
        dataset: { "user-id": null },
        aria: { busy: false },
        attributes: { "data-extra": null, "data-next": "ok" },
        textContent: "Ready",
      },
    });

    expect(button.disabled).toBe(false);
    expect(button.title).toBe("");
    expect(button.classList.contains("static")).toBe(true);
    expect(button.classList.contains("active")).toBe(false);
    expect(button.classList.contains("stale")).toBe(false);
    expect(button.classList.contains("selected")).toBe(true);
    expect(button.style.color).toBe("blue");
    expect(button.style.backgroundColor).toBe("");
    expect(button.hasAttribute("data-user-id")).toBe(false);
    expect(button.hasAttribute("data-gone")).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(button.hasAttribute("aria-label")).toBe(false);
    expect(button.hasAttribute("data-extra")).toBe(false);
    expect(button.getAttribute("data-next")).toBe("ok");
    expect(button.textContent).toBe("Ready");

    unmount();
    store.setState({ props: { disabled: true, textContent: "After cleanup" } });

    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Ready");
  });

  test("binds grouped string styles and fallback attributes", () => {
    const store = createStore(() => ({
      props: {
        style: "display: none; color: red;",
        custom: "yes",
        "stroke-width": 2,
      } satisfies PropsBinding,
    }));

    const unmount = mount(
      "#app",
      jsx("div", {
        use: bind.props(store, (state) => state.props),
      }),
    );

    const div = document.querySelector("div") as HTMLDivElement;
    expect(div.style.display).toBe("none");
    expect(div.style.color).toBe("red");
    expect(div.getAttribute("custom")).toBe("yes");
    expect(div.getAttribute("stroke-width")).toBe("2");

    store.setState({
      props: {
        style: { color: "blue" },
        "stroke-width": null,
      },
    });

    expect(div.style.display).toBe("");
    expect(div.style.color).toBe("blue");
    expect(div.hasAttribute("custom")).toBe(false);
    expect(div.hasAttribute("stroke-width")).toBe(false);

    unmount();
  });

  test("binds text, single classes, attribute variants, plain dataset keys, and style resets", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const store = createStore(() => ({
      label: null as string | null,
      active: false,
      flag: false,
      attr: 7 as unknown,
      userId: "123" as string | null,
      style: "display: none; color: red;" as StyleBinding,
    }));

    const unmount = mount(
      "#app",
      jsx("output", {
        use: [
          bind.text(store, (state) => state.label),
          bind.class("active", store, (state) => state.active),
          bind.attr("data-flag", store, (state) => state.flag),
          bind.attr("data-value", store, (state) => state.attr),
          bind.dataset("userId", store, (state) => state.userId),
          bind.style(store, (state) => state.style),
        ],
      }),
    );

    const output = document.querySelector("output") as HTMLOutputElement;
    expect(output.textContent).toBe("");
    expect(output.classList.contains("active")).toBe(false);
    expect(output.hasAttribute("data-flag")).toBe(false);
    expect(output.getAttribute("data-value")).toBe("7");
    expect(output.dataset.userId).toBe("123");
    expect(output.style.display).toBe("none");

    store.setState({
      label: "Ready",
      active: true,
      flag: true,
      attr: new Date("2020-01-02T00:00:00.000Z"),
      userId: null,
      style: { color: "blue", backgroundColor: null },
    });

    expect(output.textContent).toBe("Ready");
    expect(output.classList.contains("active")).toBe(true);
    expect(output.getAttribute("data-flag")).toBe("");
    expect(output.getAttribute("data-value")).toBe("2020-01-02T00:00:00.000Z");
    expect(output.dataset.userId).toBeUndefined();
    expect(output.style.display).toBe("");
    expect(output.style.color).toBe("blue");

    store.setState({ attr: { ok: true } });
    expect(output.getAttribute("data-value")).toBe('{"ok":true}');

    store.setState({ attr: circular });
    expect(output.getAttribute("data-value")).toBe("[object Object]");

    store.setState({ attr: Symbol("flag") });
    expect(output.getAttribute("data-value")).toBe("Symbol(flag)");

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

  test("binds string values and checked state with cleanup", () => {
    const store = createStore(() => ({
      title: "Initial",
      accepted: false,
    }));
    let valueCommits = 0;
    let checkedCommits = 0;

    const unmount = mount("#app", [
      jsx("input", {
        use: bind.value(
          store,
          (state) => state.title,
          (value) => {
            valueCommits += 1;
            if (value === "skip") return;
            return { title: value.toUpperCase() };
          },
          { event: "change" },
        ),
      }),
      jsx("input", {
        type: "checkbox",
        use: bind.checked(
          store,
          (state) => state.accepted,
          (checked) => {
            checkedCommits += 1;
            if (!checked) return;
            return { accepted: checked };
          },
        ),
      }),
    ]);

    const [textInput, checkbox] = Array.from(
      document.querySelectorAll("input"),
    ) as HTMLInputElement[];
    expect(textInput?.value).toBe("Initial");
    expect(checkbox?.checked).toBe(false);

    textInput!.value = "done";
    textInput!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().title).toBe("DONE");

    textInput!.value = "skip";
    textInput!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().title).toBe("DONE");

    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().accepted).toBe(true);

    checkbox!.checked = false;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getState().accepted).toBe(true);

    unmount();

    textInput!.value = "late";
    textInput!.dispatchEvent(new Event("change", { bubbles: true }));
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(valueCommits).toBe(2);
    expect(checkedCommits).toBe(2);
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

  test("blocks unsafe grouped props", () => {
    const store = createStore(() => ({
      props: {
        href: "https://example.test",
        style: { color: "green" },
      } satisfies PropsBinding,
    }));

    const unmount = mount(
      "#app",
      jsx("a", {
        use: bind.props(store, (state) => state.props),
        children: "Safe",
      }),
    );

    const link = document.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toBe("https://example.test/");
    expect(link.style.color).toBe("green");

    expect(() => store.setState({ props: { href: "javascript:alert(1)" } })).toThrow(
      "disallowed scheme",
    );
    expect(() =>
      store.setState({
        props: { style: { backgroundImage: "url(javascript:alert(1))" } },
      }),
    ).toThrow("unsafe CSS");
    expect(() => store.setState({ props: { onclick: "alert(1)" } })).toThrow(
      "Event handler attributes",
    );

    unmount();
  });

  test("blocks raw HTML DOM sink property bindings", () => {
    const rawProperty = createStore(() => ({
      html: "<img src=x onerror=alert(1)>",
    }));

    expect(() =>
      jsx("div", {
        use: bind.prop("innerHTML", rawProperty, (state) => state.html),
      }),
    ).toThrow("Raw HTML DOM sink");
    expect(() =>
      jsx("div", {
        use: bind.prop("outerHTML", rawProperty, (state) => state.html),
      }),
    ).toThrow("Raw HTML DOM sink");
    expect(() =>
      jsx("iframe-preview", {
        use: bind.prop("srcdoc", rawProperty, (state) => state.html),
      }),
    ).toThrow("Raw HTML DOM sink");

    const grouped = createStore(() => ({
      props: {
        title: "Safe",
      } satisfies PropsBinding,
    }));

    const unmount = mount(
      "#app",
      jsx("div", {
        use: bind.props(grouped, (state) => state.props),
      }),
    );

    expect(() =>
      grouped.setState({
        props: {
          innerHTML: "<img src=x onerror=alert(1)>",
        },
      }),
    ).toThrow("Raw HTML DOM sink");

    unmount();
  });
});
