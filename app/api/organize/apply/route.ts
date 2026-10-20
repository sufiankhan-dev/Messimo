import {
  applyApprovedOperations,
  OrganizationExecutionError,
} from "@/lib/organizer/executor";
import { withFileOperationLock } from "@/lib/organizer/lock";
import { getApprovedFolder } from "@/lib/files/folder-store";
import { HistoryError } from "@/lib/history/store";
import { apiError } from "@/lib/server/api-response";
import {
  ApiInputError,
  readJsonBody,
  validateLocalRequest,
} from "@/lib/server/local-request";
import { applyOperationsRequestSchema } from "@/lib/validation/operations";
import type { ApplyStreamEvent } from "@/lib/validation/operations";

const REQUEST_MAX_BYTES = 128 * 1024;

export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  let folderId: string;
  let operations: ReturnType<
    typeof applyOperationsRequestSchema.parse
  >["operations"];
  try {
    const body = await readJsonBody(request, REQUEST_MAX_BYTES);
    const parsed = applyOperationsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "The approved batch was not valid. Confirm the selection and try again. No files were changed.",
      );
    }

    folderId = parsed.data.folderId;
    operations = parsed.data.operations;
  } catch (error) {
    if (error instanceof ApiInputError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(
      400,
      "invalid_request",
      "The approved batch could not be read. No files were changed.",
    );
  }

  const approved = getApprovedFolder(folderId);
  if (!approved) {
    return apiError(
      404,
      "folder_not_selected",
      "That folder approval expired. Choose the folder and generate a new preview. No files were changed.",
    );
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const onRequestAbort = () => abortController.abort();

  if (request.signal.aborted) {
    abortController.abort();
  } else {
    request.signal.addEventListener("abort", onRequestAbort, { once: true });
  }

  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ApplyStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const result = await withFileOperationLock(() =>
          applyApprovedOperations({
            rootPath: approved.rootPath,
            folderName: approved.folder.name,
            operations,
            signal: abortController.signal,
            onProgress: (progress) => {
              send({ type: "progress", progress });
            },
          }),
        );

        send({ type: "complete", result });
      } catch (error) {
        if (error instanceof OrganizationExecutionError) {
          send({
            type: "error",
            code: error.code,
            message: error.message,
          });
        } else if (error instanceof HistoryError) {
          send({
            type: "error",
            code: error.code,
            message:
              "The local history could not be written, so the batch did not start. No files were changed.",
          });
        } else {
          send({
            type: "error",
            code: "apply_failed",
            message:
              "The batch stopped unexpectedly. Open History and check which files changed before trying again.",
          });
        }
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The browser may have disconnected while the batch finished.
          }
        }
      }
    },
    cancel() {
      closed = true;
      abortController.abort();
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
