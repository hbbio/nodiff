import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mount } from "../src/dom";
import { createRouter, guardedRoute } from "../src/router";
import { configureSecurityPolicy, type SecurityViolation } from "../src/security";
import { installDom } from "./test-dom";

describe("router", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    window.location.href = "http://example.test/";
    document.body.innerHTML = '<main id="app"></main>';
    configureSecurityPolicy({});
  });

  afterEach(() => {
    configureSecurityPolicy({});
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

  test("syncs from browser navigation events and supports stop()", () => {
    const router = createRouter(
      [
        { path: "/", component: () => "Home" },
        { path: "/events", component: () => "Events" },
      ],
      { mode: "hash" },
    );

    const stop = router.start();
    expect(router.start()).toBe(stop);
    const unmount = mount("#app", router.outlet());

    window.location.hash = "#/events";
    window.dispatchEvent(new Event("hashchange"));

    expect(document.querySelector("#app")?.textContent).toBe("Events");

    router.stop();
    window.location.hash = "#/";
    window.dispatchEvent(new Event("hashchange"));

    expect(document.querySelector("#app")?.textContent).toBe("Events");

    unmount();
  });

  test("falls back instead of throwing on malformed encoded params", () => {
    window.location.hash = "#/posts/%E0%A4%A";

    const router = createRouter(
      [
        {
          path: "/posts/:id",
          component: (context) => `Post:${context.params.id}`,
        },
      ],
      {
        mode: "hash",
        fallback: (state) => `Missing:${state.pathname}`,
      },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    expect(document.querySelector("#app")?.textContent).toBe("Missing:/posts/%E0%A4%A");
    expect(() => router.navigate("/posts/%E0%A4%A")).not.toThrow();
    expect(document.querySelector("#app")?.textContent).toBe("Missing:/posts/%E0%A4%A");

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

  test("matches active links on path segments, trailing slashes, and query intent", () => {
    const router = createRouter(
      [
        { path: "/", component: () => "Home" },
        { path: "/post", component: () => "Post" },
        { path: "/posts", component: () => "Posts" },
        { path: "/posts/:id", component: () => "Post detail" },
      ],
      { mode: "hash" },
    );

    const stop = router.start();
    const unmount = mount("#app", [
      router.Link({ to: "/post", activeClass: "active-post", children: "Post" }),
      router.Link({ to: "/posts", activeClass: "active-posts", children: "Posts" }),
      router.Link({ to: "/posts", exact: true, activeClass: "active-exact", children: "Exact" }),
      router.Link({
        to: "/posts?tab=comments",
        activeClass: "active-query",
        children: "Comments",
      }),
    ]);

    const [postLink, postsLink, exactLink, queryLink] = Array.from(document.querySelectorAll("a"));

    router.navigate("/posts");
    expect(postLink?.classList.contains("active-post")).toBe(false);
    expect(postsLink?.classList.contains("active-posts")).toBe(true);
    expect(exactLink?.classList.contains("active-exact")).toBe(true);
    expect(queryLink?.classList.contains("active-query")).toBe(false);

    router.navigate("/posts/");
    expect(exactLink?.classList.contains("active-exact")).toBe(true);

    router.navigate("/posts/42");
    expect(postsLink?.classList.contains("active-posts")).toBe(true);
    expect(exactLink?.classList.contains("active-exact")).toBe(false);

    router.navigate("/posts?tab=comments");
    expect(queryLink?.classList.contains("active-query")).toBe(true);
    expect(exactLink?.classList.contains("active-exact")).toBe(true);

    router.navigate("/post");
    expect(postLink?.classList.contains("active-post")).toBe(true);
    expect(postsLink?.classList.contains("active-posts")).toBe(false);

    unmount();
    stop();
  });

  test("matches wildcard routes in history mode", () => {
    const router = createRouter(
      [
        { path: "/", component: () => "Home" },
        { path: "/docs/*", component: (context) => `Docs:${context.params.wildcard}` },
      ],
      { mode: "history" },
    );

    const stop = router.start();
    const unmount = mount("#app", [
      router.Link({ to: "/docs", activeClass: "active", children: "Docs" }),
      router.outlet(),
    ]);

    router.navigate("/docs/guides/setup");

    expect(document.querySelector("#app")?.textContent).toContain("Docs:guides/setup");
    expect(document.querySelector("a")?.classList.contains("active")).toBe(true);
    expect(window.location.pathname).toBe("/docs/guides/setup");

    unmount();
    stop();
  });

  test("can replace the current history entry", () => {
    const router = createRouter(
      [
        { path: "/", component: () => "Home" },
        { path: "/settings", component: () => "Settings" },
      ],
      { mode: "history" },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    router.navigate("/settings", { replace: true });

    expect(window.location.pathname).toBe("/settings");
    expect(document.querySelector("#app")?.textContent).toBe("Settings");

    unmount();
    stop();
  });

  test("guards routes with fallback UI", () => {
    let authenticated = false;
    const router = createRouter(
      [
        {
          path: "/account",
          component: guardedRoute(
            () => authenticated,
            () => "Account",
            () => "Login required",
          ),
        },
      ],
      { mode: "hash" },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    router.navigate("/account");
    expect(document.querySelector("#app")?.textContent).toBe("Login required");

    authenticated = true;
    router.navigate("/account?refresh=1");
    expect(document.querySelector("#app")?.textContent).toBe("Account");

    unmount();
    stop();

    const hidden = guardedRoute(
      () => false,
      () => "Hidden",
    )({
      path: "/hidden",
      pathname: "/hidden",
      params: {},
      query: new URLSearchParams(),
      route: { path: "/hidden", component: () => "Hidden" },
      router,
    });
    expect(hidden).toBeNull();
  });

  test("renders successful routes without error reports", () => {
    const violations: SecurityViolation[] = [];
    configureSecurityPolicy({
      onViolation: (violation) => violations.push(violation),
    });
    const router = createRouter([{ path: "/", component: () => "Home" }], { mode: "hash" });

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    expect(document.querySelector("#app")?.textContent).toBe("Home");
    expect(violations).toHaveLength(0);

    unmount();
    stop();
  });

  test("route errors render safe fallback UI and notify hooks", () => {
    const violations: SecurityViolation[] = [];
    const seen: string[] = [];
    configureSecurityPolicy({
      onViolation: (violation) => violations.push(violation),
    });
    const router = createRouter(
      [
        {
          path: "/account",
          component: () => {
            throw new Error("session token=secret-token");
          },
        },
      ],
      {
        mode: "hash",
        onError: (error) => seen.push(error.message),
      },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    router.navigate("/account");

    const textContent = document.querySelector("#app")?.textContent ?? "";
    expect(textContent).toBe("Something went wrong.");
    expect(textContent).not.toContain("secret-token");
    expect(document.querySelector("[role='alert']")).toBeInstanceOf(HTMLElement);
    expect(seen).toEqual(["session token=secret-token"]);
    expect(violations).toEqual([
      {
        type: "exception",
        message: "Route exception captured.",
        value: "Error",
      },
    ]);

    unmount();
    stop();
  });

  test("route errors can use an explicit error view", () => {
    const router = createRouter(
      [
        {
          path: "/account",
          component: () => {
            throw Object.assign(new Error("forbidden"), { status: 403 });
          },
        },
      ],
      {
        mode: "hash",
        error: (error) => `Handled:${error.name}`,
      },
    );

    const stop = router.start();
    const unmount = mount("#app", router.outlet());

    router.navigate("/account");

    expect(document.querySelector("#app")?.textContent).toBe("Handled:Error");

    unmount();
    stop();
  });
});
