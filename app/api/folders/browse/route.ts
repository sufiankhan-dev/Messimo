import { browseFolders } from "@/lib/files/folders";
import { apiError, noStoreJson, routeError } from "@/lib/server/api-response";
import { readJsonBody, validateLocalRequest } from "@/lib/server/local-request";
import { browseRequestSchema } from "@/lib/validation/files";

export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  try {
    const body = await readJsonBody(request);
    const parsed = browseRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "The folder request was not valid.",
      );
    }

    const result = await browseFolders(parsed.data.path);
    return noStoreJson(result);
  } catch (error) {
    return routeError(error);
  }
}
