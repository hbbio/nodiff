export type SecurityMode = "permissive" | "strict";

export type CsrfPolicy = "off" | "double-submit-cookie";

export type CacheSecurityPolicy = {
  maxTtl?: number;
  requireSchema?: boolean;
};

export type SecurityViolationType =
  | "blocked-origin"
  | "blocked-url-scheme"
  | "blocked-cache"
  | "blocked-csrf"
  | "blocked-auth"
  | "blocked-dom"
  | "unsafe-config"
  | "exception";

export type SecurityViolation = {
  type: SecurityViolationType;
  message: string;
  context?: string;
  value?: string;
};

export type SecurityPolicyOptions = {
  mode?: SecurityMode;
  allowedOrigins?: readonly string[];
  allowedUrlSchemes?: readonly string[];
  csrf?: CsrfPolicy;
  cache?: CacheSecurityPolicy;
  enforceHttps?: boolean;
  onViolation?: (violation: SecurityViolation) => void;
};

const DEFAULT_SCHEMES = ["http:", "https:", "mailto:", "tel:"] as const;

function currentOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost";
}

function normalizeScheme(scheme: string): string {
  return scheme.endsWith(":") ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
}

function normalizeOrigin(origin: string): string {
  if (origin === "self") return currentOrigin();
  return new URL(origin, currentOrigin()).origin;
}

export class SecurityViolationError extends Error {
  constructor(public readonly violation: SecurityViolation) {
    super(violation.message);
    this.name = "SecurityViolationError";
  }
}

export class SecurityPolicy {
  readonly mode: SecurityMode;
  readonly csrf: CsrfPolicy;
  readonly cache: CacheSecurityPolicy;
  readonly enforceHttps: boolean;

  private readonly allowedOrigins: Set<string> | null;
  private readonly allowedUrlSchemes: Set<string>;
  private readonly onViolation: ((violation: SecurityViolation) => void) | undefined;

  constructor(options: SecurityPolicyOptions = {}) {
    this.mode = options.mode ?? "permissive";
    this.csrf = options.csrf ?? "off";
    this.cache = options.cache ?? {};
    this.enforceHttps = options.enforceHttps ?? false;
    this.allowedOrigins =
      options.allowedOrigins === undefined
        ? this.mode === "strict"
          ? new Set([currentOrigin()])
          : null
        : new Set(options.allowedOrigins.map(normalizeOrigin));
    this.allowedUrlSchemes = new Set(
      (options.allowedUrlSchemes ?? DEFAULT_SCHEMES).map(normalizeScheme),
    );
    this.onViolation = options.onViolation;
  }

  isStrict(): boolean {
    return this.mode === "strict";
  }

  report(violation: SecurityViolation): SecurityViolationError {
    this.onViolation?.(violation);
    return new SecurityViolationError(violation);
  }

  toUrl(value: string | URL): URL {
    if (value instanceof URL) return value;
    return new URL(value, currentOrigin());
  }

  isOriginAllowed(value: string | URL): boolean {
    if (!this.allowedOrigins) return true;
    return this.allowedOrigins.has(this.toUrl(value).origin);
  }

  assertAllowedOrigin(value: string | URL, context?: string): URL {
    const url = this.toUrl(value);
    if (this.isOriginAllowed(url)) return url;
    const violation: SecurityViolation = {
      type: "blocked-origin",
      message: `Blocked request to disallowed origin: ${url.origin}`,
      value: url.toString(),
    };
    if (context !== undefined) violation.context = context;
    throw this.report(violation);
  }

  isUrlSchemeAllowed(value: string | URL): boolean {
    return this.allowedUrlSchemes.has(this.toUrl(value).protocol);
  }

  assertSafeUrl(value: string | URL, context?: string): URL {
    const url = this.toUrl(value);
    if (this.isUrlSchemeAllowed(url)) return url;
    const violation: SecurityViolation = {
      type: "blocked-url-scheme",
      message: `Blocked URL with disallowed scheme: ${url.protocol}`,
      value: url.toString(),
    };
    if (context !== undefined) violation.context = context;
    throw this.report(violation);
  }
}

let activeSecurityPolicy = new SecurityPolicy();

export function createSecurityPolicy(options: SecurityPolicyOptions = {}): SecurityPolicy {
  return new SecurityPolicy(options);
}

export function getSecurityPolicy(): SecurityPolicy {
  return activeSecurityPolicy;
}

export function configureSecurityPolicy(
  options: SecurityPolicy | SecurityPolicyOptions,
): SecurityPolicy {
  activeSecurityPolicy = options instanceof SecurityPolicy ? options : new SecurityPolicy(options);
  return activeSecurityPolicy;
}

export function resolveSecurityPolicy(
  options: SecurityPolicy | SecurityPolicyOptions | undefined,
): SecurityPolicy {
  if (!options) return getSecurityPolicy();
  return options instanceof SecurityPolicy ? options : new SecurityPolicy(options);
}
