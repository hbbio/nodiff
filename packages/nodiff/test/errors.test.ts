import { describe, expect, test } from "bun:test";
import { redactError, safeErrorMessage, toError } from "../src/errors";

describe("safe error helpers", () => {
  test("keeps explicit security and CSRF messages visible", () => {
    const security = new Error("Blocked request to disallowed origin: https://evil.test");
    security.name = "SecurityViolationError";
    const csrf = new Error("CSRF token is required.");
    csrf.name = "CsrfError";

    expect(safeErrorMessage(security)).toBe(
      "Blocked request to disallowed origin: https://evil.test",
    );
    expect(safeErrorMessage(csrf)).toBe("CSRF token is required.");
  });

  test("redacts ordinary exception messages and stack details", () => {
    const error = Object.assign(new Error("password=secret-token"), {
      stack: "Error: password=secret-token\n    at secret.ts:1",
    });

    expect(safeErrorMessage(error)).toBe("Something went wrong.");
    expect(redactError(error)).toEqual({
      name: "Error",
      message: "Something went wrong.",
    });
  });

  test("normalizes non-error throws and preserves HTTP status only", () => {
    expect(toError("plain string").message).toBe("plain string");
    expect(safeErrorMessage(Object.assign(new Error("api key leaked"), { status: 403 }))).toBe(
      "Request failed (403).",
    );
  });
});
