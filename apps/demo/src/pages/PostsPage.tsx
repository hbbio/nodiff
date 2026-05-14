import { bind, For, ResourceView, view } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import {
  apiCache,
  type Post,
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
    <div class="flex flex-wrap items-center gap-2 text-sm text-base-content/65">
      <Badge tone={state.error ? "danger" : state.loading ? "warning" : "success"}>
        {state.loading ? "loading" : state.status}
      </Badge>
      <span>
        {state.pageStart}-{state.pageEnd} of {state.filtered}
      </span>
      <span>{state.total} parsed</span>
      <span>page {state.page}</span>
      <span>updated {updated}</span>
      {state.stale ? <Badge tone="warning">stale</Badge> : null}
      {state.error ? <span class="text-error">{state.error}</span> : null}
    </div>
  );
}

function PostsToolbar() {
  return (
    <div class="join">
      <button
        class="btn btn-primary join-item"
        use={[
          bind.attr("disabled", postsVm, (state) => state.loading),
          bind.aria("busy", postsVm, (state) => state.loading),
          bind.classes(postsVm, (state) => ({ "btn-disabled": state.loading })),
          bind.prop("title", postsVm, (state) =>
            state.loading ? "Refreshing zod-checked posts" : "Refresh posts",
          ),
        ]}
        onClick={() => void posts.refresh()}
      >
        Refresh
      </button>
      <button
        class="btn btn-outline join-item"
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

function PostCard(props: { post: Post }) {
  const post = props.post;
  const reactions = post.id * 7 + post.userId;
  const replies = (post.id % 9) + 1;

  return (
    <article class="card card-border bg-base-100 shadow-sm" data-id={post.id}>
      <div class="card-body gap-4">
        <div class="flex gap-3">
          <div class="avatar avatar-placeholder avatar-online">
            <div class="w-12 rounded-full bg-neutral text-neutral-content">
              <span>U{post.userId}</span>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-bold">User {post.userId}</h2>
              <span class="text-sm text-base-content/50">@jsonplaceholder</span>
              <span class="badge badge-outline">#{post.id}</span>
            </div>
            <p class="text-xs text-base-content/50">{post.id + 1}h ago via cached API</p>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-bold">{post.title}</h3>
          <p class="leading-relaxed text-base-content/75">{post.body}</p>
        </div>

        <div class="divider my-0" />

        <div class="card-actions justify-between">
          <button class="btn btn-ghost btn-sm">Like {reactions}</button>
          <button class="btn btn-ghost btn-sm">Reply {replies}</button>
          <button class="btn btn-ghost btn-sm">Share</button>
        </div>
      </div>
    </article>
  );
}

function PostsList() {
  return (
    <div class="grid gap-4">
      <For
        store={postsVm}
        each={(state) => state.visible}
        by={(post) => post.id}
        fallback={(state) =>
          state.search ? (
            <p class="alert alert-info">No posts match this filter.</p>
          ) : (
            <p class="alert alert-info">No posts are visible yet.</p>
          )
        }
      >
        {(post) => <PostCard post={post} />}
      </For>
    </div>
  );
}

function pageNumbers(page: number, count: number): number[] {
  const length = Math.min(5, count);
  const start = Math.max(1, Math.min(page - 2, count - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}

function PostsPagination() {
  return view(
    postsVm,
    (state) => state,
    (state) => {
      if (state.pageCount <= 1) return null;

      const setPage = (page: number) =>
        preferences.getState().setPostPage(Math.min(Math.max(1, page), state.pageCount));

      return (
        <div class="flex flex-col items-center gap-2">
          <div class="join">
            <button
              class="btn btn-outline join-item"
              disabled={state.page === 1}
              onClick={() => setPage(state.page - 1)}
            >
              Prev
            </button>
            {pageNumbers(state.page, state.pageCount).map((page) => (
              <button
                class={`btn join-item ${page === state.page ? "btn-active" : ""}`}
                onClick={() => setPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              class="btn btn-outline join-item"
              disabled={state.page === state.pageCount}
              onClick={() => setPage(state.page + 1)}
            >
              Next
            </button>
          </div>
          <span class="text-xs text-base-content/50">
            {state.pageSize} posts per page, {state.pageCount} pages
          </span>
        </div>
      );
    },
  );
}

export function PostsPage() {
  return (
    <section class="grid gap-5">
      <PageHeader title="Parsed, cached, explicit." actions={<PostsToolbar />}>
        Fetch uses the browser API, zod validates every response, localStorage keeps stale
        snapshots, and ResourceView decides which state branch should render.
      </PageHeader>

      <fieldset class="fieldset rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <legend class="fieldset-legend">Feed controls</legend>
        <label class="input w-full">
          <span class="badge badge-ghost">Search</span>
          <input
            class="grow"
            placeholder="Try album, photo, dolorem..."
            use={[
              bind.value(
                preferences,
                (state) => state.search,
                (search) => ({ search, postPage: 1 }),
              ),
              bind.aria("describedby", preferences, () => "posts-status"),
            ]}
          />
        </label>
        {view(
          postsVm,
          (state) => state,
          (state) => (
            <div id="posts-status">
              <StatusLine state={state} />
            </div>
          ),
        )}
      </fieldset>

      <SectionTitle title="Social feed">
        Keyed posts keep stable DOM while filtering, refreshing, and paging.
      </SectionTitle>

      <ResourceView
        resource={posts}
        pending={() => (
          <p class="alert">
            <span class="loading loading-spinner loading-sm" />
            Loading zod-checked posts...
          </p>
        )}
        error={(error) => (
          <pre class="mockup-code border border-error/30 text-error">{error.message}</pre>
        )}
        empty={() => <p class="alert">No posts loaded.</p>}
      >
        {() => (
          <div class="grid gap-5">
            <PostsList />
            <PostsPagination />
          </div>
        )}
      </ResourceView>
    </section>
  );
}
