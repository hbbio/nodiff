import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  configureSecurityPolicy,
  createSecurityPolicy,
  getSecurityPolicy,
  SecurityViolationError,
  type SecurityViolation,
} from "../src/security";
import { installDom } from "./test-dom";

describe("SecurityPolicy", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    window.location.href = "https://app.example.test/dashboard";
    configureSecurityPolicy({});
  });

  afterEach(() => {
    configureSecurityPolicy({});
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("allows broad URL use by default", () => {
    const policy = createSecurityPolicy();

    expect(policy.isOriginAllowed("https://api.example.test/users")).toBe(true);
    expect(policy.assertSafeUrl("/local").toString()).toBe("https://app.example.test/local");
  });

  test("blocks disallowed origins in strict mode", () => {
    const violations: SecurityViolation[] = [];
    const policy = createSecurityPolicy({
      mode: "strict",
      allowedOrigins: ["self", "https://api.example.test"],
      onViolation: (violation) => violations.push(violation),
    });

    expect(policy.assertAllowedOrigin("https://api.example.test/users").origin).toBe(
      "https://api.example.test",
    );
    expect(() => policy.assertAllowedOrigin("https://evil.example.test/users")).toThrow(
      SecurityViolationError,
    );
    expect(violations[0]?.type).toBe("blocked-origin");
  });

  test("blocks unsafe URL schemes and allows configured schemes", () => {
    const policy = createSecurityPolicy({
      allowedUrlSchemes: ["https:", "mailto:"],
    });

    expect(policy.assertSafeUrl("mailto:hello@example.test").protocol).toBe("mailto:");
    expect(() => policy.assertSafeUrl("javascript:alert(1)")).toThrow(SecurityViolationError);
  });

  test("configures a process-wide active policy", () => {
    const policy = configureSecurityPolicy({
      mode: "strict",
      allowedOrigins: ["https://api.example.test"],
    });

    expect(getSecurityPolicy()).toBe(policy);
    expect(getSecurityPolicy().isOriginAllowed("https://api.example.test/users")).toBe(true);
    expect(getSecurityPolicy().isOriginAllowed("https://other.example.test/users")).toBe(false);
  });
});
