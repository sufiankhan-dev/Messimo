import type { ScanProgress } from "@/types";
import { getApprovedFolder } from "@/lib/files/folder-store";
import {
  ScanCancelledError,
  ScanError,
  scanFolder,
} from "@/lib/files/scanner";
import { apiError, routeError } from "@/lib/server/api-response";
import { readJsonBody, validateLocalRequest } from "@/lib/server/local-request";
import { scanFolderRequestSchema } from "@/lib/validation/files";

const PROGRESS_INTERVAL_MS = 90;

export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  let folderId: string;
  try {
    const body = await readJsonBody(request);
    const parsed = scanFolderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "Choose a folder before starting a scan.",
      );
    }
    folderId = parsed.data.folderId;
  } catch (error) {
    return routeError(error);
  }

  const approved = getApprovedFolder(folderId);
  if (!approved) {
    return apiError(
      404,
      "folder_not_selected",
      "That folder approval expired. Choose the folder again.",
    );
  }

  const encoder = new TextEncoder();
  const scanController = new AbortController();
  const onRequestAbort = () => scanController.abort();

  if (request.signal.aborted) {
    scanController.abort();
  } else {
    request.signal.addEventListener("abort", onRequestAbort, { once: true });
  }

  let closed = false;
  let lastProgressAt = 0;
  let latestProgress: ScanProgress = {
    phase: "scanning",
    scannedFiles: 0,
    directoriesScanned: 0,
    skippedCount: 0,
    hashedFiles: 0,
    filesToHash: 0,
    currentRelativePath: "",
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`${JSON.stringify(event)}\n`),
          );
        } catch {
          closed = true;
        }
      };

      const sendProgress = (progress: ScanProgress) => {
        latestProgress = progress;
        const now = Date.now();
        if (now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
        lastProgressAt = now;
        send({ type: "progress", progress });
      };

      try {
        const result = await scanFolder({
          rootPath: approved.rootPath,
          signal: scanController.signal,
          onProgress: sendProgress,
        });
        send({ type: "complete", result });
      } catch (error) {
        if (error instanceof ScanCancelledError) {
          latestProgress = error.progress;
          send({ type: "cancelled", progress: latestProgress });
        } else if (error instanceof ScanError) {
          send({
            type: "error",
            code: error.code,
            message: error.message,
          });
        } else {
          send({
            type: "error",
            code: "scan_failed",
            message:
              "The folder could not be scanned. No files were changed.",
          });
        }
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The client may have disconnected while the scan was finishing.
          }
        }
      }
    },
    cancel() {
      closed = true;
      scanController.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
