import { Window } from "happy-dom";

const domGlobals = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "SVGElement",
  "DocumentFragment",
  "Text",
  "Comment",
  "DOMException",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "Event",
  "MouseEvent",
  "InputEvent",
  "SubmitEvent",
  "KeyboardEvent",
  "FocusEvent",
] as const;

export function installDom(): () => void {
  const window = new Window();
  Object.assign(window, {
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
  });

  const previous = new Map<string, unknown>();

  for (const key of domGlobals) {
    previous.set(key, (globalThis as Record<string, unknown>)[key]);
    (globalThis as Record<string, unknown>)[key] = window[key] as unknown;
  }

  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete (globalThis as Record<string, unknown>)[key];
      } else {
        (globalThis as Record<string, unknown>)[key] = value;
      }
    }
    window.close();
  };
}
