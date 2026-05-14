import { createRouter } from "@nodiffjs/core";
import { AuthPage } from "./pages/AuthPage";
import { CachePage } from "./pages/CachePage";
import { HomePage } from "./pages/HomePage";
import { PostsPage } from "./pages/PostsPage";

function NotFound() {
  return (
    <section class="alert alert-error">
      <div>
        <h1 class="font-bold">Not found</h1>
        <p>The current route is not registered.</p>
      </div>
    </section>
  );
}

function RouteError() {
  return (
    <section class="alert alert-error" role="alert">
      <div>
        <h1 class="font-bold">Route failed</h1>
        <p>The page could not render safely.</p>
      </div>
    </section>
  );
}

export const router = createRouter(
  [
    { path: "/", title: "NoDiff", component: HomePage },
    { path: "/posts", title: "Posts | NoDiff", component: PostsPage },
    { path: "/auth", title: "Auth | NoDiff", component: AuthPage },
    { path: "/cache", title: "Cache | NoDiff", component: CachePage },
  ],
  {
    mode: "hash",
    fallback: NotFound,
    error: RouteError,
  },
);

export function App() {
  const Link = (props: Parameters<typeof router.Link>[0]) => router.Link(props);

  return (
    <div class="drawer bg-base-200 text-base-content lg:drawer-open">
      <input id="app-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content min-h-screen">
        <div class="navbar sticky top-0 z-10 border-b border-base-300 bg-base-100 lg:hidden">
          <div class="flex-none">
            <label for="app-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </label>
          </div>
          <div class="flex-1 px-2 text-lg font-black">NoDiff</div>
        </div>
        <main class="mx-auto w-full max-w-7xl p-4 lg:p-8">{router.outlet()}</main>
      </div>
      <div class="drawer-side z-20">
        <label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
        <aside class="flex min-h-full w-72 flex-col bg-base-100 p-4">
          <a
            class="btn btn-ghost h-auto justify-start gap-3 px-2 text-lg"
            href={router.href("/")}
            onClick={(event) => {
              event.preventDefault();
              router.navigate("/");
            }}
          >
            <span class="badge badge-primary badge-lg rounded-md px-2 py-4 font-black normal-case">
              no
            </span>
            <span class="font-black">NoDiff</span>
          </a>
          <ul class="menu mt-4 w-full rounded-box bg-base-200">
            <li>
              <Link class="font-medium" to="/" exact activeClass="menu-active">
                Home
              </Link>
            </li>
            <li>
              <Link class="font-medium" to="/posts" activeClass="menu-active">
                Posts
              </Link>
            </li>
            <li>
              <Link class="font-medium" to="/auth" activeClass="menu-active">
                Auth
              </Link>
            </li>
            <li>
              <Link class="font-medium" to="/cache" activeClass="menu-active">
                Cache
              </Link>
            </li>
          </ul>
          <footer class="mt-auto rounded-box border border-base-300 bg-base-200 p-3">
            <small class="text-base-content/60">Bun + Vite + direct DOM TSX</small>
          </footer>
        </aside>
      </div>
    </div>
  );
}
