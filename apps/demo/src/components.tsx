import { bind, text, type Action, type Child } from "@nodiffjs/core";
import { preferences, type PreferencesData } from "./state";

export function PageHeader(props: {
  eyebrow: string;
  title: string;
  children: Child;
  actions?: Child;
  hero?: boolean;
}) {
  return (
    <header class={{ panel: true, hero: props.hero, split: Boolean(props.actions) }}>
      <div>
        <p class="eyebrow">{props.eyebrow}</p>
        <h1>{props.title}</h1>
        <p>{props.children}</p>
      </div>
      {props.actions}
    </header>
  );
}

export function Badge(props: {
  children?: Child;
  tone?: "neutral" | "success" | "warning" | "danger";
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
  return (
    <span class={["badge", props.tone ?? "neutral"]} use={props.use}>
      {props.children}
    </span>
  );
}

export function SectionTitle(props: { title: string; children?: Child; actions?: Child }) {
  return (
    <div class="section-title">
      <div>
        <h2>{props.title}</h2>
        {props.children ? <p class="muted">{props.children}</p> : null}
      </div>
      {props.actions}
    </div>
  );
}

export function StatCard(props: {
  label: string;
  value: string | number | Node;
  hint?: string | Node;
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
  children?: Child;
}) {
  return (
    <article class="stat-card" use={props.use}>
      <div class="stat-card-top">
        <span>{props.label}</span>
        {props.hint ? <small>{props.hint}</small> : null}
      </div>
      <strong>{props.value}</strong>
      {props.children}
    </article>
  );
}

export function CounterCard() {
  return (
    <article
      class="stat-card control-card"
      use={[
        bind.dataset("step", preferences, (state) => state.step),
        bind.aria("live", preferences, () => "polite"),
      ]}
    >
      <div class="stat-card-top">
        <span>Counter</span>
        <Badge>localStorage</Badge>
      </div>
      <strong>{text(preferences, (state) => state.count)}</strong>
      <div class="counter-controls">
        <button onClick={() => preferences.getState().increment()}>Increment</button>
        <button class="ghost" onClick={() => preferences.getState().resetCount()}>
          Reset
        </button>
      </div>
      <label class="field compact-field">
        <span>Step</span>
        <input
          type="number"
          min="1"
          max="10"
          use={bind.number(
            preferences,
            (state) => state.step,
            (step) => ({
              step: Math.max(1, Math.min(10, Math.trunc(step ?? 1))),
            }),
          )}
        />
      </label>
    </article>
  );
}

export function ThemeCard() {
  return (
    <article class="stat-card control-card">
      <div class="stat-card-top">
        <span>Theme</span>
        <Badge use={bind.text(preferences, (state) => state.theme)} />
      </div>
      <div class="theme-row">
        <label class="field compact-field">
          <span>Preference</span>
          <select
            use={bind.value(
              preferences,
              (state) => state.theme,
              (theme) => ({ theme: theme as PreferencesData["theme"] }),
              { event: "change" },
            )}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <span
          class="theme-swatch"
          use={[
            bind.dataset("theme", preferences, (state) => state.theme),
            bind.style(preferences, (state) => ({
              backgroundColor: state.theme === "dark" ? "#171a23" : "#ffffff",
              borderColor: state.theme === "system" ? "#8a93a5" : "#111827",
            })),
          ]}
        />
      </div>
    </article>
  );
}

export function StatusMetric(props: {
  label: string;
  value: Child;
  badge: Child;
  hint: Child;
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
  return (
    <article class="stat-card" use={props.use}>
      <div class="stat-card-top">
        <span>{props.label}</span>
        <Badge>{props.badge}</Badge>
      </div>
      <strong>{props.value}</strong>
      <small>{props.hint}</small>
    </article>
  );
}

export function FeatureList(props: { title: string; items: string[]; use?: Action<HTMLElement> }) {
  return (
    <article class="panel" use={props.use}>
      <h3>{props.title}</h3>
      <ul>
        {props.items.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    </article>
  );
}
