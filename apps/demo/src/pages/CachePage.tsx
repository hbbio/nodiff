import { view } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import { apiCache, appCache, auth, cacheInspector, refreshCacheInspector } from "../state";

function CacheActions() {
  return (
    <div class="actions">
      <button class="ghost" onClick={refreshCacheInspector}>
        Refresh list
      </button>
      <button
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
    <section class="stack">
      <PageHeader
        eyebrow="localStorage envelopes"
        title="Inspectable cache state."
        actions={<CacheActions />}
      >
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
            <section class="grid">
              <article class="panel summary-panel">
                <div class="stat-card-top">
                  <span>App cache</span>
                  <Badge>{appKeys.length}</Badge>
                </div>
                <strong>{appKeys.length}</strong>
                <small>Preferences and auth snapshots.</small>
              </article>
              <article class="panel summary-panel">
                <div class="stat-card-top">
                  <span>HTTP cache</span>
                  <Badge>{httpKeys.length}</Badge>
                </div>
                <strong>{httpKeys.length}</strong>
                <small>GET response envelopes with tags and TTL.</small>
              </article>
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
          if (keys.length === 0) return <p class="panel">No demo cache keys.</p>;

          return (
            <section class="panel stack compact">
              <h2>Keys</h2>
              <ul class="cache-list">
                {keys.map((key) => (
                  <li>
                    <code>demo:{key}</code>
                    <button
                      class="ghost small"
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
            </section>
          );
        },
      )}
    </section>
  );
}
