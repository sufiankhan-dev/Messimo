export type LocalRequestFailure = {
  ok: false;
  status: 403 | 413 | 415;
  code: string;
  message: string;
};

export type LocalRequestResult = { ok: true } | LocalRequestFailure;

export interface LocalRequestHeaders {
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
  );
}

export function hostnameFromHostHeader(host: string | null): string | null {
  if (!host) return null;

  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

/** Shared header checks used by the local folder and scan endpoints. */
export function checkLocalRequestHeaders(
  headers: LocalRequestHeaders,
): LocalRequestResult {
  const host = headers.host;
  const hostname = hostnameFromHostHeader(host);

  if (!host || !hostname || !isLoopbackHostname(hostname)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden_local_only",
      message:
        "This action is available only from the local SlothSort app on this computer.",
    };
  }

  if (headers.secFetchSite) {
    const site = headers.secFetchSite.toLowerCase();
    if (site !== "same-origin" && site !== "none") {
      return {
        ok: false,
        status: 403,
        code: "forbidden_origin",
        message: "Cross-site folder requests are not allowed.",
      };
    }
  }

  if (headers.origin) {
    let origin: URL;
    try {
      origin = new URL(headers.origin);
    } catch {
      return {
        ok: false,
        status: 403,
        code: "forbidden_origin",
        message: "The request origin is not valid.",
      };
    }

    if (
      (origin.protocol !== "http:" && origin.protocol !== "https:") ||
      !isLoopbackHostname(origin.hostname) ||
      origin.host.toLowerCase() !== host.toLowerCase()
    ) {
      return {
        ok: false,
        status: 403,
        code: "forbidden_origin",
        message: "Cross-origin folder requests are not allowed.",
      };
    }
  }

  return { ok: true };
}

export function validateLocalRequest(request: Request): LocalRequestResult {
  return checkLocalRequestHeaders({
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
}

export class ApiInputError extends Error {
  readonly status: 400 | 413 | 415;
  readonly code: string;

  constructor(status: 400 | 413 | 415, code: string, message: string) {
    super(message);
    this.name = "ApiInputError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Read a small JSON request body with an explicit size limit. Folder APIs only
 * accept a path or an opaque folder id, never file contents.
 */
export async function readJsonBody(
  request: Request,
  maxBytes = 8 * 1024,
): Promise<unknown> {
  const contentType = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .trim();
  if (!contentType.startsWith("application/json")) {
    throw new ApiInputError(
      415,
      "invalid_content_type",
      "Send this request as application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiInputError(
      413,
      "request_too_large",
      "The request body is too large.",
    );
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiInputError(
      413,
      "request_too_large",
      "The request body is too large.",
    );
  }
  if (!text.trim()) {
    throw new ApiInputError(400, "invalid_json", "The request body is empty.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiInputError(400, "invalid_json", "The request body is not valid JSON.");
  }
}
