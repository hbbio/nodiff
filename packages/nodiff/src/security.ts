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

export type SecurityHeadersOptions = {
  policy?: SecurityPolicy | SecurityPolicyOptions;
  connectSrc?: readonly string[];
  imgSrc?: readonly string[];
  frameAncestors?: readonly string[];
  formAction?: readonly string[];
  reportUri?: string;
  hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
};

const DEFAULT_SCHEMES = ["http:", "https:", "mailto:", "tel:"] as const;

function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin !== "null")
    return window.location.origin;
  return "http://localhost";
}

function normalizeScheme(scheme: string): string {
  return scheme.endsWith(":") ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
}

function normalizeOrigin(origin: string): string {
  if (origin === "self") return currentOrigin();
  return new URL(origin, currentOrigin()).origin;
}

function normalizeCspSource(source: string): string {
  if (/[\r\n;]/.test(source)) {
    throw new SecurityViolationError({
      type: "unsafe-config",
      message: `Invalid CSP source: ${source}`,
      value: source,
    });
  }
  if (source.startsWith("'") || source.endsWith(":")) return source;
  return normalizeOrigin(source);
}

function normalizeReportUri(uri: string): string {
  if (/[\r\n;]/.test(uri)) {
    throw new SecurityViolationError({
      type: "unsafe-config",
      message: `Invalid CSP report URI: ${uri}`,
      value: uri,
    });
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(uri) || uri.startsWith("//")) {
    return new URL(uri, currentOrigin()).toString();
  }
  return uri;
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

  cspOriginSources(): string[] {
    const sources = this.allowedOrigins ? Array.from(this.allowedOrigins) : [currentOrigin()];
    return sources.map((origin) => (origin === currentOrigin() ? "'self'" : origin));
  }

  report(violation: SecurityViolation): SecurityViolationError {
    this.notify(violation);
    return new SecurityViolationError(violation);
  }

  notify(violation: SecurityViolation): void {
    this.onViolation?.(violation);
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

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function directive(name: string, values: readonly string[]): string {
  return `${name} ${unique(values).join(" ")}`;
}

export function contentSecurityPolicy(options: SecurityHeadersOptions = {}): string {
  const policy = resolveSecurityPolicy(options.policy);
  const connectSrc = unique([
    "'self'",
    ...policy.cspOriginSources(),
    ...(options.connectSrc ?? []).map(normalizeCspSource),
  ]);
  const imgSrc = unique([
    "'self'",
    "data:",
    "blob:",
    ...(options.imgSrc ?? []).map(normalizeCspSource),
  ]);
  const frameAncestors = unique((options.frameAncestors ?? ["'self'"]).map(normalizeCspSource));
  const formAction = unique((options.formAction ?? ["'self'"]).map(normalizeCspSource));

  const directives = [
    directive("default-src", ["'none'"]),
    directive("base-uri", ["'none'"]),
    directive("object-src", ["'none'"]),
    directive("script-src", ["'self'"]),
    directive("style-src", ["'self'"]),
    directive("connect-src", connectSrc),
    directive("img-src", imgSrc),
    directive("font-src", ["'self'"]),
    directive("frame-ancestors", frameAncestors),
    directive("form-action", formAction),
  ];

  if (policy.enforceHttps) directives.push("upgrade-insecure-requests");
  if (options.reportUri)
    directives.push(directive("report-uri", [normalizeReportUri(options.reportUri)]));
  return directives.join("; ");
}

function hstsHeader(
  option: true | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean },
): string {
  if (option === true) return "max-age=31536000; includeSubDomains";
  const maxAge = option.maxAge ?? 31_536_000;
  const parts = [`max-age=${maxAge}`];
  if (option.includeSubDomains ?? true) parts.push("includeSubDomains");
  if (option.preload) parts.push("preload");
  return parts.join("; ");
}

export function securityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(options),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (options.hsts) headers["Strict-Transport-Security"] = hstsHeader(options.hsts);
  return headers;
}
