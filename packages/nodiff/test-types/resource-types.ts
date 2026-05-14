import { createResource } from "../src/resource";

const requiredArgs = createResource<string, { id: string }>({
  load: async (args) => args.id,
});

void requiredArgs.load({ id: "post-1" });
void requiredArgs.refresh();

// @ts-expect-error required resource args must be passed to load.
void requiredArgs.load();

createResource<string, { id: string }>({
  immediate: true,
  initialArgs: { id: "post-1" },
  load: async (args) => args.id,
});

// @ts-expect-error immediate required-args resources need initialArgs.
createResource<string, { id: string }>({
  immediate: true,
  load: async (args) => args.id,
});

const noArgs = createResource<string>({
  immediate: true,
  load: async () => "ready",
});

void noArgs.load();
void noArgs.refresh();
