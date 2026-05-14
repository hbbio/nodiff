import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { csrfFieldName, csrfHeaderName, defaultCookieCsrf, readCsrfToken } from "../src/csrf";
import { installDom } from "./test-dom";

describe("CSRF helpers", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("reads configured tokens from meta tags and handles document-less runtimes", () => {
    document.head.innerHTML = '<meta name="csrf-token" content="meta-token">';

    expect(readCsrfToken({ metaName: "csrf-token" })).toBe("meta-token");
    expect(readCsrfToken({ metaName: "missing-token" })).toBeNull();
    expect(csrfHeaderName({ headerName: "X-App-CSRF" })).toBe("X-App-CSRF");
    expect(csrfFieldName({ fieldName: "csrf" })).toBe("csrf");
    expect(defaultCookieCsrf({ required: true })).toEqual({
      cookieName: "XSRF-TOKEN",
      headerName: "X-CSRF-Token",
      required: true,
    });

    cleanupDom?.();
    cleanupDom = undefined;

    expect(readCsrfToken({ metaName: "csrf-token" })).toBeNull();
    expect(readCsrfToken({ cookieName: "XSRF-TOKEN" })).toBeNull();
  });
});
