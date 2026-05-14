export type CsrfRequired = boolean | "state-changing";

export type CsrfTokenOptions = {
  token?: string;
  getToken?: () => string | null | undefined;
  cookieName?: string;
  metaName?: string;
};

export type CsrfRequestOptions = CsrfTokenOptions & {
  headerName?: string;
  required?: CsrfRequired;
};

export type CsrfFormOptions = CsrfTokenOptions & {
  fieldName?: string;
  required?: boolean;
};

export class CsrfError extends Error {
  constructor(message = "CSRF token is required.") {
    super(message);
    this.name = "CsrfError";
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (!value.startsWith(prefix)) continue;
    return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

function readMeta(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const element of Array.from(document.querySelectorAll("meta[name]"))) {
    if (element.getAttribute("name") === name) return element.getAttribute("content");
  }
  return null;
}

export function readCsrfToken(options: CsrfTokenOptions = {}): string | null {
  if (options.token) return options.token;

  const provided = options.getToken?.();
  if (provided) return provided;

  if (options.cookieName) {
    const cookie = readCookie(options.cookieName);
    if (cookie) return cookie;
  }

  if (options.metaName) {
    const meta = readMeta(options.metaName);
    if (meta) return meta;
  }

  return null;
}

export function csrfHeaderName(options: CsrfRequestOptions = {}): string {
  return options.headerName ?? "X-CSRF-Token";
}

export function csrfFieldName(options: CsrfFormOptions = {}): string {
  return options.fieldName ?? "_csrf";
}

export function defaultCookieCsrf(options: CsrfRequestOptions = {}): CsrfRequestOptions {
  return {
    cookieName: "XSRF-TOKEN",
    headerName: "X-CSRF-Token",
    ...options,
  };
}
