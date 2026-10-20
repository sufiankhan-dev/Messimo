import { NextResponse } from "next/server";
import { checkOllamaConnection } from "@/lib/ai/ollama";
import { apiError } from "@/lib/server/api-response";
import { validateLocalRequest } from "@/lib/server/local-request";

export async function GET(request: Request) {
  // Read-only, but a cross-site page must not be able to make the local app
  // probe (or reveal) the local inference runtime.
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  const status = await checkOllamaConnection();

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
