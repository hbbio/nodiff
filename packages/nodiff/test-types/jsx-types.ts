import { jsx, type IntrinsicElements } from "../src/dom";
import { jsxDEV } from "../src/jsx-dev-runtime";

jsx("button", {
  disabled: false,
  onClick: (event) => {
    event.currentTarget.disabled = true;
  },
  children: "Save",
});

jsx("a", { href: "/docs", target: "_blank", rel: "noreferrer" });
jsx("input", {
  value: 42,
  autocomplete: "email",
  onInput: (event) => {
    event.currentTarget.value = event.currentTarget.value.trim();
  },
});
jsx("svg", {
  viewBox: "0 0 24 24",
  children: jsx("path", {
    d: "M4 6h16",
    "stroke-linecap": "round",
    "stroke-width": 2,
  }),
});
jsx("my-widget", { customProp: 1 });

const inputProps: IntrinsicElements["input"] = {
  "aria-label": "Email",
  "data-field": "email",
  autocomplete: "email",
  value: "demo@example.com",
};
void inputProps;

// @ts-expect-error href belongs on anchors, not buttons.
jsx("button", { href: "/bad", children: "Bad" });

// @ts-expect-error catches common event-name typos.
jsx("button", { onClik: () => undefined });

// @ts-expect-error raw HTML is intentionally forced through unsafeHTML.
jsx("div", { innerHTML: "<strong>bad</strong>" });

// @ts-expect-error arbitrary bare attributes should be data-, aria-, dash-case, or custom elements.
jsx("div", { custom: "value" });

// @ts-expect-error event handler attributes are blocked; use typed event props instead.
jsx("button", { "on-click": "alert(1)" });

// @ts-expect-error JSX intrinsic props use the same strict surface.
const buttonProps: IntrinsicElements["button"] = { onClik: () => undefined };
void buttonProps;

// @ts-expect-error dev runtime direct calls should not fall back to custom-element looseness.
jsxDEV("button", { onClik: () => undefined });
