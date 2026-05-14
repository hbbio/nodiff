import { view } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import { apiCache, appCache, auth, cacheInspector, refreshCacheInspector } from "../state";

function CacheActions() {
  return (
    <div class="join">
      <button class="btn btn-outline join-item" onClick={refreshCacheInspector}>
        Refresh list
      </button>
      <button
        class="btn btn-primary join-item"
        onClick={() => {
          appCache.clear();
          auth.logout();
          refreshCacheInspector();
        }}
      >
        Clear demo cache
      </button>
    </div>
  );
}

export function CachePage() {
  return (
    <section class="grid gap-5">
      <PageHeader title="Inspectable cache state." actions={<CacheActions />}>
        Preferences, auth, and HTTP snapshots share the same tiny cache format with expiry, tags,
        stale reads, and zod validation at read time.
      </PageHeader>

      {view(
        cacheInspector,
        (state) => state.version,
        () => {
          const appKeys = appCache.keys();
          const httpKeys = apiCache.keys();
          return (
            <section class="stats stats-vertical bg-base-100 shadow-sm md:stats-horizontal">
              <div class="stat">
                <div class="flex items-start justify-between gap-3">
                  <div class="stat-title">App cache</div>
                  <Badge>{appKeys.length}</Badge>
                </div>
                <div class="stat-value text-3xl">{appKeys.length}</div>
                <div class="stat-desc">Preferences and auth snapshots.</div>
              </div>
              <div class="stat">
                <div class="flex items-start justify-between gap-3">
                  <div class="stat-title">HTTP cache</div>
                  <Badge>{httpKeys.length}</Badge>
                </div>
                <div class="stat-value text-3xl">{httpKeys.length}</div>
                <div class="stat-desc">GET response envelopes with tags and TTL.</div>
              </div>
            </section>
          );
        },
      )}

      <SectionTitle title="Demo-prefixed keys">
        Remove individual entries to watch the app recover from parsed defaults or a fresh request.
      </SectionTitle>

      {view(
        cacheInspector,
        (state) => state.version,
        () => {
          const keys = appCache.keys().sort();
          if (keys.length === 0) return <p class="alert alert-info">No demo cache keys.</p>;

          return (
            <section class="card card-border bg-base-100 shadow-sm">
              <div class="card-body gap-4">
                <h2 class="card-title">Keys</h2>
                <ul class="list rounded-box border border-base-300 bg-base-100">
                  {keys.map((key) => (
                    <li class="list-row items-center">
                      <code class="text-sm">demo:{key}</code>
                      <button
                        class="btn btn-ghost btn-xs"
                        onClick={() => {
                          appCache.remove(key);
                          refreshCacheInspector();
                        }}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        },
      )}
    </section>
  );
}
