import { HistoryError, listOperationRecords } from "@/lib/history/store";
import { apiError, noStoreJson } from "@/lib/server/api-response";
import { validateLocalRequest } from "@/lib/server/local-request";

export async function GET(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  try {
    const records = await listOperationRecords();
    return noStoreJson({ records });
  } catch (error) {
    if (error instanceof HistoryError) {
      return apiError(500, error.code, error.message);
    }
    return apiError(
      500,
      "history_unavailable",
      "The local operation history could not be read.",
    );
  }
}
