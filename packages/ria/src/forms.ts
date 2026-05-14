import type { z } from "zod";
import type { Action } from "./dom";

export type FormValues = Record<string, FormDataEntryValue | FormDataEntryValue[]>;

export function formValues(form: HTMLFormElement): FormValues {
  const values: FormValues = {};
  const data = new FormData(form);

  for (const [key, value] of data.entries()) {
    const current = values[key];
    if (current === undefined) {
      values[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      values[key] = [current, value];
    }
  }

  return values;
}

function validatable(element: Element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return "setCustomValidity" in element && "reportValidity" in element;
}

export function clearFormValidity(form: HTMLFormElement): void {
  for (const element of form.querySelectorAll("[name]")) {
    if (validatable(element)) element.setCustomValidity("");
  }
}

export function applyZodValidity(form: HTMLFormElement, error: z.ZodError): void {
  clearFormValidity(form);

  for (const issue of error.issues) {
    const name = issue.path.join(".");
    if (!name) continue;
    const field = form.elements.namedItem(name);
    if (field instanceof Element && validatable(field)) {
      field.setCustomValidity(issue.message);
    }
  }

  form.reportValidity();
}

export function zodSubmit<T>(
  schema: z.ZodType<T>,
  handler: (values: T, event: SubmitEvent, form: HTMLFormElement) => void | Promise<void>,
  options: {
    onError?: (error: z.ZodError, form: HTMLFormElement) => void;
    resetOnSuccess?: boolean;
  } = {}
): Action<HTMLFormElement> {
  return (form) => {
    const submit = async (event: SubmitEvent) => {
      event.preventDefault();
      clearFormValidity(form);

      const parsed = schema.safeParse(formValues(form));
      if (!parsed.success) {
        applyZodValidity(form, parsed.error);
        options.onError?.(parsed.error, form);
        return;
      }

      await handler(parsed.data, event, form);
      if (options.resetOnSuccess) form.reset();
    };

    form.addEventListener("submit", submit);
    return () => form.removeEventListener("submit", submit);
  };
}
