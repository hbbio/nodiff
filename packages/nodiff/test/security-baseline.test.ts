import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { createSecurityPolicy, securityHeaders } from "../src/security";

type RootPackage = {
  scripts?: Record<string, string>;
};

const root = fileURLToPath(new URL("../../..", import.meta.url));

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function rootPackage(): RootPackage {
  return JSON.parse(readRepoFile("package.json")) as RootPackage;
}

describe("security baseline", () => {
  test("keeps a one-command security check and committed lockfile", () => {
    const securityCheck = rootPackage().scripts?.["security:check"];

    expect(securityCheck).toContain("bun audit");
    expect(securityCheck).toContain("bun run check");
    expect(securityCheck).toContain("bun run build");
    expect(existsSync(join(root, "bun.lock"))).toBe(true);
  });

  test("keeps dependency lockfiles tracked and local secrets ignored", () => {
    const ignored = readRepoFile(".gitignore").split(/\r?\n/);

    expect(ignored).toContain(".env");
    expect(ignored).toContain(".env.*");
    expect(ignored).not.toContain("bun.lock");
  });

  test("keeps the demo wired to strict security defaults", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const app = readRepoFile("apps/demo/src/app.tsx");
    const main = readRepoFile("apps/demo/src/main.tsx");

    expect(state).toContain("configureSecurityPolicy");
    expect(state).toContain('mode: "strict"');
    expect(state).toContain('allowedOrigins: ["self", "https://jsonplaceholder.typicode.com"]');
    expect(state).toContain("enforceHttps: true");
    expect(state).toContain('csrf: "double-submit-cookie"');
    expect(state).toContain("security: securityPolicy");
    expect(state).toContain("readDemoCsrfToken");
    expect(app).toContain("error: RouteError");
    expect(main).toContain("catchRender");
  });

  test("keeps public API reads isolated from demo auth headers", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const publicApi = state.match(/export const publicApi = createApi\(\{[\s\S]*?\n\}\);/)?.[0];
    const sessionApi = state.match(/export const sessionApi = createApi\(\{[\s\S]*?\n\}\);/)?.[0];

    expect(publicApi).toContain('baseUrl: "https://jsonplaceholder.typicode.com"');
    expect(publicApi).not.toContain("getAuthHeaders");
    expect(state).toContain("publicApi.get");
    expect(state).toContain("auth: false");
    expect(sessionApi).toContain('baseUrl: "/api"');
    expect(sessionApi).toContain("getAuthHeaders: auth.authHeaders");
    expect(sessionApi).toContain("getToken: readDemoCsrfToken");
  });

  test("keeps visible demo errors redacted", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const postsPage = readRepoFile("apps/demo/src/pages/PostsPage.tsx");

    expect(state).toContain("safeErrorMessage(resource.error)");
    expect(postsPage).toContain("safeErrorMessage(error)");
    expect(postsPage).not.toContain("error.message");
  });

  test("publishes deployment security headers from framework defaults", () => {
    const headers = readRepoFile("apps/demo/public/_headers");
    const expected = securityHeaders({
      policy: createSecurityPolicy({
        mode: "strict",
        allowedOrigins: ["self", "https://jsonplaceholder.typicode.com"],
        allowedUrlSchemes: ["http:", "https:"],
        enforceHttps: true,
      }),
      hsts: true,
    });

    for (const [name, value] of Object.entries(expected)) {
      expect(headers).toContain(`${name}: ${value}`);
    }
  });

  test("keeps the demo away from common production footguns", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const authPage = readRepoFile("apps/demo/src/pages/AuthPage.tsx");
    const vite = readRepoFile("apps/demo/vite.config.ts");
    const html = readRepoFile("apps/demo/index.html");

    expect(state).not.toContain("persist: true");
    expect(state).not.toContain("allowRefreshTokenPersistence: true");
    expect(authPage).toContain("csrf:");
    expect(authPage).toContain("getToken: readDemoCsrfToken");
    expect(vite).toContain("sourcemap: false");
    expect(vite).not.toContain("sourcemap: true");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});
