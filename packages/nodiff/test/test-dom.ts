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
] as const;

export function installDom(): () => void {
  const window = new Window();
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
