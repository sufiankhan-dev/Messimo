import { rememberApprovedFolder } from "@/lib/files/folder-store";
import { approveRoot } from "@/lib/files/path-safety";
import { apiError, noStoreJson, routeError } from "@/lib/server/api-response";
import { readJsonBody, validateLocalRequest } from "@/lib/server/local-request";
import { selectFolderRequestSchema } from "@/lib/validation/files";

export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  try {
    const body = await readJsonBody(request);
    const parsed = selectFolderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "Choose a valid folder path.",
      );
    }

    const canonicalRoot = await approveRoot(parsed.data.path);
    const folder = rememberApprovedFolder(canonicalRoot);

    return noStoreJson({ folder });
  } catch (error) {
    return routeError(error);
  }
}
