import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { addCleanup, cleanupNode, replaceChildrenClean } from "../src/lifecycle";
import { installDom } from "./test-dom";

describe("lifecycle helpers", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("reports cleanup errors asynchronously while continuing cleanup", () => {
    const node = document.createElement("div");
    const calls: string[] = [];
    const queued: VoidFunction[] = [];
    const originalQueueMicrotask = globalThis.queueMicrotask;

    addCleanup(node, () => {
      calls.push("first");
    });
    addCleanup(node, () => {
      calls.push("second");
      throw new Error("cleanup failed");
    });

    globalThis.queueMicrotask = ((callback: VoidFunction) => {
      queued.push(callback);
    }) as typeof queueMicrotask;
    try {
      cleanupNode(node);
    } finally {
      globalThis.queueMicrotask = originalQueueMicrotask;
    }

    expect(calls).toEqual(["second", "first"]);
    expect(queued).toHaveLength(1);
    expect(() => queued[0]?.()).toThrow("cleanup failed");
  });

  test("replaces children after cleaning removed nodes", () => {
    const parent = document.createElement("section");
    const oldChild = document.createElement("span");
    let cleanups = 0;
    addCleanup(oldChild, () => {
      cleanups += 1;
    });
    parent.appendChild(oldChild);

    replaceChildrenClean(parent, [document.createTextNode("next")]);

    expect(cleanups).toBe(1);
    expect(parent.textContent).toBe("next");
  });
});
