import { bind, text, type Action, type Child } from "@nodiffjs/core";
import { preferences, themeOptions, type PreferencesData } from "./state";

const badgeTone = {
  neutral: "badge-neutral",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-error",
} as const;

export function PageHeader(props: {
  title: string;
  children: Child;
  actions?: Child;
  hero?: boolean;
}) {
  const headerClass = props.hero
    ? "hero rounded-box bg-primary text-primary-content"
    : "hero rounded-box bg-base-100 shadow-sm";
  const copyClass = props.hero
    ? "max-w-2xl py-4 text-primary-content/75"
    : "mt-4 max-w-2xl text-base-content/70";

  return (
    <header class={headerClass}>
      <div
        class={
          props.actions
            ? "hero-content w-full flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between"
            : "hero-content w-full justify-start"
        }
      >
        <div class="max-w-3xl">
          <h1
            class={
              props.hero
                ? "text-5xl font-black leading-none tracking-tight sm:text-6xl"
                : "text-4xl font-black leading-tight tracking-tight"
            }
          >
            {props.title}
          </h1>
          <p class={copyClass}>{props.children}</p>
        </div>
        {props.actions ? <div class="shrink-0">{props.actions}</div> : null}
      </div>
    </header>
  );
}

export function Badge(props: {
  children?: Child;
  tone?: "neutral" | "success" | "warning" | "danger";
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
  return (
    <span
      class={`badge badge-sm ${badgeTone[props.tone ?? "neutral"]} whitespace-nowrap font-semibold`}
      use={props.use}
    >
      {props.children}
    </span>
  );
}

export function SectionTitle(props: { title: string; children?: Child; actions?: Child }) {
  return (
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-xl font-bold">{props.title}</h2>
        {props.children ? (
          <p class="mt-1 max-w-2xl text-sm text-base-content/65">{props.children}</p>
        ) : null}
      </div>
      {props.actions}
    </div>
  );
}

export function CounterCard() {
  return (
    <article
      class="card card-border border-primary/20 bg-base-100 shadow-sm"
      use={[
        bind.dataset("step", preferences, (state) => state.step),
        bind.aria("live", preferences, () => "polite"),
      ]}
    >
      <div class="card-body gap-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-bold uppercase tracking-wide text-base-content/55">Counter</p>
            <strong class="block text-5xl font-black tabular-nums">
              {text(preferences, (state) => state.count)}
            </strong>
          </div>
          <Badge>localStorage</Badge>
        </div>

        <div class="join w-full">
          <button
            class="btn btn-primary join-item flex-1"
            onClick={() => preferences.getState().increment()}
          >
            Increment
          </button>
          <button
            class="btn btn-ghost join-item"
            onClick={() => preferences.getState().resetCount()}
          >
            Reset
          </button>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Step</legend>
          <input
            class="input input-bordered input-sm w-full"
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
        </fieldset>
      </div>
    </article>
  );
}

export function ThemeCard() {
  const previews = ["cupcake", "synthwave", "nord", "sunset"] as const;

  return (
    <article class="card card-border bg-base-100 shadow-sm">
      <div class="card-body gap-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-bold uppercase tracking-wide text-base-content/55">Theme</p>
            <strong class="block text-2xl font-black">DaisyUI</strong>
          </div>
          <Badge use={bind.text(preferences, (state) => state.theme)} />
        </div>

        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-outline btn-sm w-full justify-between">
            Theme
            <span class="text-xs opacity-60">{themeOptions.length}</span>
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content z-10 mt-2 w-56 rounded-box bg-base-300 p-2 shadow-2xl"
          >
            {themeOptions.map((theme) => (
              <li>
                <input
                  type="radio"
                  name="theme-dropdown"
                  class="theme-controller btn btn-ghost btn-sm btn-block justify-start"
                  aria-label={themeLabel(theme)}
                  value={theme === "system" ? "default" : theme}
                  use={bind.prop("checked", preferences, (state) => state.theme === theme)}
                  onChange={() => preferences.getState().setTheme(theme)}
                />
              </li>
            ))}
          </ul>
        </div>

        <div class="grid grid-cols-4 gap-2">
          {previews.map((theme) => (
            <div data-theme={theme} class="rounded-box bg-base-200 p-2 shadow-inner">
              <div class="h-8 rounded-field bg-primary" />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function themeLabel(theme: PreferencesData["theme"]): string {
  if (theme === "system") return "System";
  return theme
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusMetric(props: {
  label: string;
  value: Child;
  badge: Child;
  hint: Child;
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
  return (
    <div class="stat" use={props.use}>
      <div class="flex items-start justify-between gap-3">
        <div class="stat-title">{props.label}</div>
        <Badge>{props.badge}</Badge>
      </div>
      <div class="stat-value text-3xl">{props.value}</div>
      <div class="stat-desc mt-2 whitespace-normal">{props.hint}</div>
    </div>
  );
}

export function FeatureList(props: { title: string; items: string[]; use?: Action<HTMLElement> }) {
  return (
    <article class="card card-border bg-base-100 shadow-sm" use={props.use}>
      <div class="card-body">
        <h3 class="card-title text-base">{props.title}</h3>
        <ul class="mt-2 grid gap-2 text-sm text-base-content/70">
          {props.items.map((item) => (
            <li class="flex gap-2">
              <span class="badge badge-primary badge-xs mt-1.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
