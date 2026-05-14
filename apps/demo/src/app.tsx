import { createRouter } from "@nodiffjs/core";
import { AuthPage } from "./pages/AuthPage";
import { CachePage } from "./pages/CachePage";
import { HomePage } from "./pages/HomePage";
import { PostsPage } from "./pages/PostsPage";

function NotFound() {
  return (
    <section class="panel">
      <h1>Not found</h1>
      <p>The current route is not registered.</p>
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
  },
);

export function App() {
  const Link = (props: Parameters<typeof router.Link>[0]) => router.Link(props);

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <a
          class="brand"
          href={router.href("/")}
          onClick={(event) => {
            event.preventDefault();
            router.navigate("/");
          }}
        >
          <span class="brand-mark">no</span>
          <span>NoDiff</span>
        </a>
        <nav>
          <Link to="/" exact activeClass="active">
            Home
          </Link>
          <Link to="/posts" activeClass="active">
            Posts
          </Link>
          <Link to="/auth" activeClass="active">
            Auth
          </Link>
          <Link to="/cache" activeClass="active">
            Cache
          </Link>
        </nav>
        <footer>
          <small>Bun + Vite + direct DOM TSX</small>
        </footer>
      </aside>
      <main>{router.outlet()}</main>
    </div>
  );
}
