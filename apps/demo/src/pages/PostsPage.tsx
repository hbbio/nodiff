import { bind, For, ResourceView, view } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import {
  apiCache,
  posts,
  postsVm,
  preferences,
  refreshCacheInspector,
  type PostsVm,
} from "../state";

function StatusLine(props: { state: PostsVm }) {
  const state = props.state;
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "never";

  return (
    <div class="status-row">
      <Badge tone={state.error ? "danger" : state.loading ? "warning" : "success"}>
        {state.loading ? "loading" : state.status}
      </Badge>
      <span>{state.total} parsed</span>
      <span>{state.visible.length} visible</span>
      <span>updated {updated}</span>
      {state.stale ? <Badge tone="warning">stale</Badge> : null}
      {state.error ? <span class="error-text">{state.error}</span> : null}
    </div>
  );
}

function PostsToolbar() {
  return (
    <div class="actions">
      <button
        use={[
          bind.attr("disabled", postsVm, (state) => state.loading),
          bind.aria("busy", postsVm, (state) => state.loading),
          bind.classes(postsVm, (state) => ({ "is-loading": state.loading })),
          bind.prop("title", postsVm, (state) =>
            state.loading ? "Refreshing zod-checked posts" : "Refresh posts",
          ),
        ]}
        onClick={() => void posts.refresh()}
      >
        Refresh
      </button>
      <button
        class="ghost"
        onClick={() => {
          apiCache.remove("posts");
          refreshCacheInspector();
          void posts.refresh();
        }}
      >
        Bust cache
      </button>
    </div>
  );
}

function PostsList() {
  return (
    <div class="post-list">
      <For
        store={postsVm}
        each={(state) => state.visible}
        by={(post) => post.id}
        fallback={(state) =>
          state.search ? (
            <p class="panel">No posts match this filter.</p>
          ) : (
            <p class="panel">No posts are visible yet.</p>
          )
        }
      >
        {(post) => (
          <article class="panel post-card" data-id={post.id}>
            <div class="post-meta">
              <span>#{post.id}</span>
              <span>user {post.userId}</span>
            </div>
            <h2>{post.title}</h2>
            <p>{post.body}</p>
          </article>
        )}
      </For>
    </div>
  );
}

export function PostsPage() {
  return (
    <section class="stack">
      <PageHeader
        eyebrow="Data at the edge"
        title="Parsed, cached, explicit."
        actions={<PostsToolbar />}
      >
        Fetch uses the browser API, zod validates every response, localStorage keeps stale
        snapshots, and ResourceView decides which state branch should render.
      </PageHeader>

      <section class="panel stack compact">
        <div class="filter-row">
          <label class="field">
            <span>Filter posts</span>
            <input
              placeholder="Try album, photo, dolorem..."
              use={[
                bind.value(
                  preferences,
                  (state) => state.search,
                  (search) => ({ search }),
                ),
                bind.aria("describedby", preferences, () => "posts-status"),
              ]}
            />
          </label>
        </div>
        {view(
          postsVm,
          (state) => state,
          (state) => (
            <div id="posts-status">
              <StatusLine state={state} />
            </div>
          ),
        )}
      </section>

      <SectionTitle title="Keyed result list">
        Rows are reconciled by post id, so filtering and refreshes keep stable DOM where possible.
      </SectionTitle>

      <ResourceView
        resource={posts}
        pending={() => <p class="panel">Loading zod-checked posts...</p>}
        error={(error) => <pre class="panel error">{error.message}</pre>}
        empty={() => <p class="panel">No posts loaded.</p>}
      >
        {() => <PostsList />}
      </ResourceView>
    </section>
  );
}
