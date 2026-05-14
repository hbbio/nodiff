export type SafeError = {
  name: string;
  message: string;
};

export function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

export function safeErrorMessage(error: unknown): string {
  const caught = toError(error);
  const status = (caught as unknown as { status?: unknown }).status;
  if (typeof status === "number") return `Request failed (${status}).`;
  if (caught.name === "SecurityViolationError" || caught.name === "CsrfError")
    return caught.message;
  return "Something went wrong.";
}

export function redactError(error: unknown): SafeError {
  const caught = toError(error);
  return {
    name: caught.name,
    message: safeErrorMessage(caught),
  };
}
