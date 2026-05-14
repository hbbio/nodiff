import { bind, text } from "@nodiffjs/core";
import {
  CounterCard,
  FeatureList,
  PageHeader,
  SectionTitle,
  StatusMetric,
  ThemeCard,
} from "../components";
import { auth, postsVm } from "../state";

export function HomePage() {
  return (
    <section class="grid gap-5">
      <PageHeader hero title="TSX as browser syntax.">
        A lean rich-client framework that lives with your app: real DOM nodes, explicit store
        subscriptions, zod-checked data, cache, auth, forms, and routing without React, axios, a
        virtual DOM, or a scheduler.
      </PageHeader>

      <SectionTitle title="Live app surface">
        Each panel is real DOM plus a small subscription, action, or binding. There is no component
        replay behind these updates.
      </SectionTitle>

      <div class="grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_minmax(22rem,1.4fr)_minmax(16rem,1fr)]">
        <CounterCard />
        <section class="stats stats-vertical bg-base-100 shadow-sm md:stats-horizontal">
          <StatusMetric
            label="Auth"
            value={text(auth.store, (state) => state.status)}
            badge={text(auth.store, (state) => (state.token ? "token" : "guest"))}
            hint="Bearer-token helper"
            use={bind.classes(auth.store, (state) => ({
              "text-success": state.status === "authenticated",
            }))}
          />
          <StatusMetric
            label="Posts"
            value={text(postsVm, (state) => state.total)}
            badge={text(postsVm, (state) => (state.loading ? "loading" : state.status))}
            hint={text(postsVm, (state) =>
              state.stale ? "Stale cache visible while refreshing" : "Zod-validated API data",
            )}
            use={[
              bind.prop("title", postsVm, (state) => `${state.total} parsed posts in memory`),
              bind.classes(postsVm, (state) => ({ "text-warning": state.loading })),
            ]}
          />
        </section>
        <ThemeCard />
      </div>

      <SectionTitle title="Runtime map">
        The demo keeps the framework surface visible instead of hiding it behind app-specific
        wrappers.
      </SectionTitle>
      <section class="grid gap-4 md:grid-cols-2">
        <FeatureList
          title="Framework surface"
          items={[
            "Direct DOM JSX runtime",
            "Lifecycle cleanup through actions",
            "Store bindings for text, attrs, classes, inputs",
            "Hash or history router",
          ]}
        />
        <FeatureList
          title="Data surface"
          items={[
            "Zod response validation",
            "Token auth headers and logout on 401",
            "localStorage cache with TTL and stale reads",
            "Resource state for loading, stale, error, success",
          ]}
        />
      </section>
    </section>
  );
}
