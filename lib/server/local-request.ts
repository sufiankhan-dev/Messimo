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

const JSON_MEDIA_TYPE = /^application\/(?:[a-z0-9.+-]+\+)?json$/;

/**
 * Read a small JSON request body with an explicit size limit. Folder APIs only
 * accept a path or an opaque folder id, never file contents.
 *
 * The body is consumed incrementally and the stream is cancelled as soon as the
 * limit is exceeded. Checking the size only after buffering would let a chunked
 * request with no `Content-Length` allocate unbounded memory before being
 * rejected.
 */
export async function readJsonBody(
  request: Request,
  maxBytes = 8 * 1024,
): Promise<unknown> {
  const contentType = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .trim();
  const mediaType = contentType.split(";")[0]?.trim() ?? "";
  if (!JSON_MEDIA_TYPE.test(mediaType)) {
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

  if (!request.body) {
    throw new ApiInputError(400, "invalid_json", "The request body is empty.");
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiInputError(
          413,
          "request_too_large",
          "The request body is too large.",
        );
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The reader may already be released or cancelled; nothing to clean up.
    }
  }

  const text = Buffer.concat(chunks, receivedBytes).toString("utf8");
  if (!text.trim()) {
    throw new ApiInputError(400, "invalid_json", "The request body is empty.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiInputError(400, "invalid_json", "The request body is not valid JSON.");
  }
}
