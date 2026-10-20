import { z } from "zod";
import { HistoryError } from "@/lib/history/store";
import { undoOperation, UndoRefusedError } from "@/lib/history/undo";
import { withFileOperationLock } from "@/lib/organizer/lock";
import { apiError, noStoreJson } from "@/lib/server/api-response";
import {
  ApiInputError,
  readJsonBody,
  validateLocalRequest,
} from "@/lib/server/local-request";
import { undoOperationRequestSchema } from "@/lib/validation/operations";

const idSchema = z.uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return apiError(404, "operation_not_found", "That operation is not in the local history.");
  }

  try {
    const body = await readJsonBody(request, 4 * 1024);
    const parsed = undoOperationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "Undo must be confirmed explicitly before it can run. No files were changed.",
      );
    }
  } catch (error) {
    if (error instanceof ApiInputError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(
      400,
      "invalid_request",
      "The undo request could not be read. No files were changed.",
    );
  }

  try {
    const result = await withFileOperationLock(() =>
      undoOperation(parsedId.data),
    );
    return noStoreJson({ result });
  } catch (error) {
    if (error instanceof UndoRefusedError) {
      return apiError(404, error.code, error.message);
    }
    if (error instanceof HistoryError) {
      return apiError(500, error.code, error.message);
    }
    return apiError(
      500,
      "undo_failed",
      "Undo could not be completed. Check History to see which files were restored.",
    );
  }
}
