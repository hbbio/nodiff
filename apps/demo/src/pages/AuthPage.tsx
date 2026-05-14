import { bind, Show, text, zodSubmit } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import { auth, fakeLogin, LoginSchema } from "../state";

function AuthOverview() {
  return (
    <section class="stats stats-vertical bg-base-100 shadow-sm md:stats-horizontal">
      <div
        class="stat"
        use={bind.classes(auth.store, (state) => ({
          "text-success": state.status === "authenticated",
        }))}
      >
        <div class="flex items-start justify-between gap-3">
          <div class="stat-title">Session</div>
          <Badge>{text(auth.store, (state) => state.status)}</Badge>
        </div>
        <div class="stat-value text-3xl">
          {text(auth.store, (state) => state.user?.name ?? "guest")}
        </div>
        <div class="stat-desc">Token state is ordinary zustand data.</div>
      </div>
      <div class="stat">
        <div class="flex items-start justify-between gap-3">
          <div class="stat-title">Authorization</div>
          <Badge>{text(auth.store, (state) => (state.token ? "ready" : "empty"))}</Badge>
        </div>
        <div class="stat-value text-3xl">
          {text(auth.store, (state) => state.token?.tokenType ?? "Bearer")}
        </div>
        <div class="stat-desc">The API client reads headers from this controller.</div>
      </div>
    </section>
  );
}

function LoginPanel() {
  return (
    <form use={zodSubmit(LoginSchema, fakeLogin)}>
      <fieldset class="fieldset rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <legend class="fieldset-legend">Login</legend>
        <label class="label">Email</label>
        <input
          class="input w-full"
          name="email"
          type="email"
          value="demo@example.com"
          autocomplete="email"
        />
        <label class="label">Password</label>
        <input
          class="input w-full"
          name="password"
          type="password"
          value="demo"
          autocomplete="current-password"
        />
        <button class="btn btn-primary mt-4" type="submit">
          Create demo token
        </button>
      </fieldset>
    </form>
  );
}

function AuthenticatedPanel() {
  const token = auth.store.getState().token;
  const tokenPreview = token?.accessToken ? `${token.accessToken.slice(0, 18)}...` : "none";
  const expiresAt = token?.expiresAt ? new Date(token.expiresAt).toLocaleString() : "session";

  return (
    <section class="card card-border bg-base-100 shadow-sm">
      <div class="card-body gap-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="card-title">Authenticated</h2>
            <p class="text-sm text-base-content/65">Token preview: {tokenPreview}</p>
            <p class="text-sm text-base-content/65">Expires: {expiresAt}</p>
          </div>
          <button class="btn btn-outline" onClick={() => auth.logout()}>
            Logout
          </button>
        </div>
        <pre class="mockup-code border border-base-300 p-4 text-sm">
          {JSON.stringify(auth.authHeaders(), null, 2)}
        </pre>
      </div>
    </section>
  );
}

export function AuthPage() {
  return (
    <section class="grid gap-5">
      <PageHeader title="Bearer headers without ceremony.">
        A tiny controller keeps a token in memory, exposes auth headers for the API client, and lets
        the app keep ownership of login and refresh policy.
      </PageHeader>

      <AuthOverview />

      <SectionTitle title="Auth branch">
        Show swaps the login form and token panel from the auth store.
      </SectionTitle>

      <Show store={auth.store} when={(state) => state.token} fallback={() => <LoginPanel />}>
        {() => <AuthenticatedPanel />}
      </Show>
    </section>
  );
}
