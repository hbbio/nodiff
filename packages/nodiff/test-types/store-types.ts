import { createStore } from "zustand/vanilla";
import { bind, derivedStore, type PropsBinding } from "../src/store";

const count = createStore(() => ({ value: 1 }));
const label = createStore(() => ({ value: "posts" }));

const vm = derivedStore([count, label], (countState, labelState) => ({
  label: labelState.value,
  doubled: countState.value * 2,
}));

vm.getState().doubled.toFixed();
vm.getState().label.toUpperCase();

// @ts-expect-error derived state preserves the selected property types.
vm.getState().doubled.toUpperCase();

bind.props(vm, (state) => ({
  disabled: state.doubled > 1,
  aria: { label: state.label },
  class: { active: state.doubled > 1 },
  title: state.label,
}));

const props = {
  disabled: true,
  dataset: { id: "posts" },
  style: { color: "red" },
} satisfies PropsBinding;
void props;
