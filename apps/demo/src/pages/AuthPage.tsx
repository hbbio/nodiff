import { bind, Show, text, zodSubmit } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import { auth, fakeLogin, LoginSchema } from "../state";

function AuthOverview() {
  return (
    <section class="grid">
      <article
        class="panel summary-panel"
        use={bind.classes(auth.store, (state) => ({
          authenticated: state.status === "authenticated",
        }))}
      >
        <div class="stat-card-top">
          <span>Session</span>
          <Badge>{text(auth.store, (state) => state.status)}</Badge>
        </div>
        <strong>{text(auth.store, (state) => state.user?.name ?? "guest")}</strong>
        <small>Stored token state is ordinary zustand data.</small>
      </article>
      <article class="panel summary-panel">
        <div class="stat-card-top">
          <span>Authorization</span>
          <Badge>{text(auth.store, (state) => (state.token ? "ready" : "empty"))}</Badge>
        </div>
        <strong>{text(auth.store, (state) => state.token?.tokenType ?? "Bearer")}</strong>
        <small>The API client reads headers from this controller.</small>
      </article>
    </section>
  );
}

function LoginPanel() {
  return (
    <form class="panel stack compact" use={zodSubmit(LoginSchema, fakeLogin)}>
      <label class="field">
        <span>Email</span>
        <input name="email" type="email" value="demo@example.com" autocomplete="email" />
      </label>
      <label class="field">
        <span>Password</span>
        <input name="password" type="password" value="demo" autocomplete="current-password" />
      </label>
      <button type="submit">Create demo token</button>
    </form>
  );
}

function AuthenticatedPanel() {
  const token = auth.store.getState().token;
  const tokenPreview = token?.accessToken ? `${token.accessToken.slice(0, 18)}...` : "none";
  const expiresAt = token?.expiresAt ? new Date(token.expiresAt).toLocaleString() : "session";

  return (
    <section class="panel stack compact">
      <div class="split">
        <div>
          <h2>Authenticated</h2>
          <p class="muted">Token preview: {tokenPreview}</p>
          <p class="muted">Expires: {expiresAt}</p>
        </div>
        <button class="ghost" onClick={() => auth.logout()}>
          Logout
        </button>
      </div>
      <pre>{JSON.stringify(auth.authHeaders(), null, 2)}</pre>
    </section>
  );
}

export function AuthPage() {
  return (
    <section class="stack">
      <PageHeader eyebrow="Token auth" title="Bearer headers without ceremony.">
        A tiny controller persists a token, exposes auth headers for the API client, and lets the
        app keep ownership of login and refresh policy.
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
