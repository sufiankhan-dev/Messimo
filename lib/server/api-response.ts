import { NextResponse } from "next/server";
import { PathSafetyError } from "@/lib/files/path-safety";
import { ScanError } from "@/lib/files/scanner";
import { ApiInputError } from "@/lib/server/local-request";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function noStoreJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return noStoreJson({ error: { code, message } }, status);
}

const PATH_ERROR_STATUS: Record<string, number> = {
  invalid_path: 400,
  not_absolute: 400,
  not_found: 404,
  not_directory: 400,
  not_readable: 403,
  protected_path: 403,
  outside_root: 403,
  unsafe_symlink: 403,
};

const SCAN_ERROR_MESSAGES: Record<string, string> = {
  root_unavailable:
    "The approved folder is no longer available. Choose it again.",
  root_not_directory: "The approved path is no longer a folder.",
  scan_failed: "The folder could not be scanned. No files were changed.",
};

/** Convert known service errors into safe responses without stack traces. */
export function routeError(error: unknown): NextResponse {
  if (error instanceof ApiInputError) {
    return apiError(error.status, error.code, error.message);
  }
  if (error instanceof PathSafetyError) {
    return apiError(
      PATH_ERROR_STATUS[error.code] ?? 400,
      error.code,
      error.message,
    );
  }
  if (error instanceof ScanError) {
    return apiError(
      500,
      error.code,
      SCAN_ERROR_MESSAGES[error.code] ??
        "The folder could not be scanned. No files were changed.",
    );
  }

  return apiError(
    500,
    "internal_error",
    "Something went wrong while reading folder information. No files were changed.",
  );
}
