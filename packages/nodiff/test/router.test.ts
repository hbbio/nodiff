import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mount } from "../src/dom";
import { createRouter } from "../src/router";
import { installDom } from "./test-dom";

describe("router", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    window.location.href = "http://example.test/";
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("renders route params and query params through the outlet", () => {
    const router = createRouter(
      [
        {
          path: "/posts/:id",
          component: (context) => `${context.params.id}:${context.query.get("tab") ?? "missing"}`,
        },
      ],
      { mode: "hash" },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    router.navigate("/posts/42?tab=comments");

    expect(document.querySelector("#app")?.textContent).toBe("42:comments");

    unmount();
    stop();
  });

  test("links navigate without reloading and toggle active class", () => {
    const router = createRouter(
      [
        { path: "/", component: () => "Home" },
        { path: "/posts", component: () => "Posts" },
      ],
      { mode: "hash" },
    );

    const stop = router.start();
    const unmount = mount("#app", [
      router.Link({ to: "/", exact: true, activeClass: "active", children: "Home" }),
      router.Link({ to: "/posts", activeClass: "active", children: "Posts" }),
      router.outlet(),
    ]);

    const links = Array.from(document.querySelectorAll("a"));
    expect(links[0]?.classList.contains("active")).toBe(true);
    expect(links[1]?.classList.contains("active")).toBe(false);

    links[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#app")?.textContent).toContain("Posts");
    expect(links[0]?.classList.contains("active")).toBe(false);
    expect(links[1]?.classList.contains("active")).toBe(true);

    unmount();
    stop();
  });
});
