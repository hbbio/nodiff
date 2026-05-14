import { ErrorBoundary, catchRender } from "../src/dom";

catchRender({ render: () => "ready" });
catchRender({
  render: () => {
    throw new Error("boom");
  },
  fallback: (error) => error.name,
});

ErrorBoundary({ render: () => "ready" });
ErrorBoundary({ children: () => "ready" });
ErrorBoundary({ children: "already-rendered" });

// @ts-expect-error catchRender catches a render callback, not pre-evaluated children.
catchRender({ children: () => "ready" });
