import { createStore, type StoreApi } from "zustand/vanilla";
import { type Action, type Child, type ElementProps, jsx } from "./dom";
import { subscribeSelector, view } from "./store";

export type RouteContext<TMeta = unknown> = {
  path: string;
  pathname: string;
  params: Record<string, string>;
  query: URLSearchParams;
  route: RouteDefinition<TMeta>;
  router: Router<TMeta>;
};

export type RouteDefinition<TMeta = unknown> = {
  path: string;
  title?: string;
  meta?: TMeta;
  component(context: RouteContext<TMeta>): Child;
};

export type RouteMatch<TMeta = unknown> = Omit<RouteContext<TMeta>, "router">;

export type RouterState<TMeta = unknown> = {
  path: string;
  pathname: string;
  query: URLSearchParams;
  match: RouteMatch<TMeta> | null;
};

export type RouterOptions<TMeta = unknown> = {
  mode?: "history" | "hash";
  fallback?: (state: RouterState<TMeta>) => Child;
};

export type LinkProps = Omit<ElementProps<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  activeClass?: string;
  exact?: boolean;
};

export type Router<TMeta = unknown> = {
  store: StoreApi<RouterState<TMeta>>;
  mode: "history" | "hash";
  href(to: string): string;
  navigate(to: string, options?: { replace?: boolean }): void;
  start(): () => void;
  stop(): void;
  outlet(): DocumentFragment;
  Link(props: LinkProps): Child;
};

export type RouteGuard<TMeta = unknown> = (context: RouteContext<TMeta>) => boolean;

type CompiledRoute<TMeta> = {
  route: RouteDefinition<TMeta>;
  keys: string[];
  pattern: RegExp;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileRoute<TMeta>(route: RouteDefinition<TMeta>): CompiledRoute<TMeta> {
  if (route.path === "/") return { route, keys: [], pattern: /^\/?$/ };

  const keys: string[] = [];
  const segments = route.path.split("/").filter(Boolean);
  const source = segments
    .map((segment) => {
      if (segment === "*") {
        keys.push("wildcard");
        return "(.*)";
      }
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return escapeRegExp(segment);
    })
    .join("/");

  return { route, keys, pattern: new RegExp(`^/${source}/?$`) };
}

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function parsePath(path: string): { pathname: string; query: URLSearchParams } {
  const url = new URL(normalizePath(path), "http://nodiff.local");
  return { pathname: url.pathname || "/", query: url.searchParams };
}

function pathWithQuery(pathname: string, query: URLSearchParams): string {
  const search = query.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

function decodeRouteParam(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function canonicalPathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function matchesPathSegment(pathname: string, targetPathname: string): boolean {
  const current = canonicalPathname(pathname);
  const target = canonicalPathname(targetPathname);
  if (target === "/") return pathname === "/";
  return current === target || current.startsWith(`${target}/`);
}

function isActivePath(state: RouterState, to: string, exact: boolean | undefined): boolean {
  const target = parsePath(to);
  const targetQuery = target.query.toString();

  if (exact) {
    if (targetQuery) return state.path === pathWithQuery(target.pathname, target.query);
    return canonicalPathname(state.pathname) === canonicalPathname(target.pathname);
  }

  if (!matchesPathSegment(state.pathname, target.pathname)) return false;
  return targetQuery ? state.query.toString() === targetQuery : true;
}

function routeMatch<TMeta>(compiled: CompiledRoute<TMeta>[], path: string): RouterState<TMeta> {
  const { pathname, query } = parsePath(path);

  for (const item of compiled) {
    const match = item.pattern.exec(pathname);
    if (!match) continue;

    const params: Record<string, string> = {};
    let validParams = true;
    item.keys.forEach((key, index) => {
      const decoded = decodeRouteParam(match[index + 1] ?? "");
      if (decoded === null) {
        validParams = false;
        return;
      }
      params[key] = decoded;
    });
    if (!validParams) continue;

    return {
      path: pathWithQuery(pathname, query),
      pathname,
      query,
      match: {
        path: pathWithQuery(pathname, query),
        pathname,
        query,
        params,
        route: item.route,
      },
    };
  }

  return {
    path: pathWithQuery(pathname, query),
    pathname,
    query,
    match: null,
  };
}

export function guardedRoute<TMeta = unknown>(
  guard: RouteGuard<TMeta>,
  component: RouteDefinition<TMeta>["component"],
  fallback: (context: RouteContext<TMeta>) => Child = () => null,
): RouteDefinition<TMeta>["component"] {
  return (context) => (guard(context) ? component(context) : fallback(context));
}

export function createRouter<TMeta = unknown>(
  routes: RouteDefinition<TMeta>[],
  options: RouterOptions<TMeta> = {},
): Router<TMeta> {
  const mode = options.mode ?? "history";
  const compiled = routes.map(compileRoute);

  const readPath = () => {
    if (typeof window === "undefined") return "/";
    if (mode === "hash") return normalizePath(window.location.hash.slice(1));
    return `${window.location.pathname}${window.location.search}`;
  };

  const store = createStore<RouterState<TMeta>>(() => routeMatch(compiled, readPath()));

  const sync = () => store.setState(routeMatch(compiled, readPath()), true);

  let dispose: (() => void) | null = null;

  const router: Router<TMeta> = {
    store,
    mode,
    href(to: string) {
      const normalized = normalizePath(to);
      return mode === "hash" ? `#${normalized}` : normalized;
    },
    navigate(to: string, navOptions: { replace?: boolean } = {}) {
      const href = router.href(to);
      if (typeof window === "undefined") return;
      if (mode === "hash") {
        const url = `${window.location.pathname}${window.location.search}${href}`;
        if (navOptions.replace) window.history.replaceState({}, "", url);
        else window.history.pushState({}, "", url);
      } else if (navOptions.replace) {
        window.history.replaceState({}, "", href);
      } else {
        window.history.pushState({}, "", href);
      }
      sync();
    },
    start() {
      if (dispose) return dispose;
      const handler = () => sync();
      window.addEventListener("popstate", handler);
      window.addEventListener("hashchange", handler);
      sync();
      dispose = () => {
        window.removeEventListener("popstate", handler);
        window.removeEventListener("hashchange", handler);
        dispose = null;
      };
      return dispose;
    },
    stop() {
      dispose?.();
    },
    outlet() {
      return view(
        store,
        (state) => state.path,
        (_path, state) => {
          const match = state.match;
          if (!match) {
            return (
              options.fallback?.(state) ??
              jsx("section", {
                class: "panel",
                children: [
                  jsx("h1", { children: "Not found" }),
                  jsx("p", { children: state.pathname }),
                ],
              })
            );
          }
          if (match.route.title && typeof document !== "undefined")
            document.title = match.route.title;
          return match.route.component({ ...match, router });
        },
      );
    },
    Link(props: LinkProps): Child {
      const { to, replace, activeClass, exact, children, onClick, use, ...rest } = props;
      const active: Action<HTMLAnchorElement> | undefined = activeClass
        ? (element) => {
            const select = (state: RouterState<TMeta>) => isActivePath(state, to, exact);
            const syncActive = (enabled: boolean) => element.classList.toggle(activeClass, enabled);
            syncActive(select(store.getState()));
            return subscribeSelector(store, select, syncActive);
          }
        : undefined;

      const click = (event: MouseEvent) => {
        if (typeof onClick === "function")
          onClick(event as MouseEvent & { currentTarget: HTMLAnchorElement });
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
          return;
        event.preventDefault();
        router.navigate(to, { replace: Boolean(replace) });
      };

      const actions = Array.isArray(use) ? use : use ? [use] : [];
      if (active) actions.push(active);

      return jsx("a", {
        ...rest,
        href: router.href(to),
        onClick: click,
        use: actions,
        children: children as Child,
      });
    },
  };

  return router;
}
