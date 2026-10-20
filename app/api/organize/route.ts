import { promises as fs } from "node:fs";
import path from "node:path";
import type { OrganizationProgress, ScannedFile } from "@/types";
import { OllamaClient, OllamaClientError } from "@/lib/ai/ollama-client";
import { getServerEnv } from "@/lib/config/env";
import { describeFile } from "@/lib/files/metadata";
import { getApprovedFolder } from "@/lib/files/folder-store";
import {
  isStrictlyInsidePath,
  PathSafetyError,
  resolveInsideRoot,
} from "@/lib/files/path-safety";
import {
  OrganizationCancelledError,
  OrganizationError,
  planOrganization,
} from "@/lib/organizer/planner";
import { apiError } from "@/lib/server/api-response";
import {
  ApiInputError,
  readJsonBody,
  validateLocalRequest,
} from "@/lib/server/local-request";
import { organizeRequestSchema } from "@/lib/validation/organization";

const REQUEST_MAX_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  let folderId: string;
  let relativePaths: string[];
  try {
    const body = await readJsonBody(request, REQUEST_MAX_BYTES);
    const parsed = organizeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "invalid_request",
        "Choose a scanned folder before generating suggestions.",
      );
    }

    folderId = parsed.data.folderId;
    relativePaths = parsed.data.relativePaths;
  } catch (error) {
    if (error instanceof ApiInputError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(
      400,
      "invalid_request",
      "The organization request could not be read.",
    );
  }

  const approved = getApprovedFolder(folderId);
  if (!approved) {
    return apiError(
      404,
      "folder_not_selected",
      "That folder approval expired. Choose the folder again.",
    );
  }

  const env = getServerEnv();
  let client: OllamaClient;
  try {
    client = new OllamaClient({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
    });
  } catch (error) {
    if (error instanceof OllamaClientError) {
      return apiError(500, error.code, error.message);
    }
    return apiError(
      500,
      "planning_failed",
      "The local Ollama client could not be configured.",
    );
  }

  const files = await collectScannedFiles(approved.rootPath, relativePaths);
  if (files instanceof Response) return files;

  if (files.length === 0) {
    return apiError(
      404,
      "files_unavailable",
      "None of the scanned files are still available. Scan the folder again. No files were changed.",
    );
  }

  const encoder = new TextEncoder();
  const planController = new AbortController();
  const onRequestAbort = () => planController.abort();

  if (request.signal.aborted) {
    planController.abort();
  } else {
    request.signal.addEventListener("abort", onRequestAbort, { once: true });
  }

  let closed = false;
  let latestProgress: OrganizationProgress = {
    completed: 0,
    total: files.length,
    currentFile: "",
    ready: 0,
    needsReview: 0,
    failed: 0,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const plan = await planOrganization({
          rootPath: approved.rootPath,
          files,
          client,
          model: env.OLLAMA_MODEL,
          signal: planController.signal,
          onProgress: (progress) => {
            latestProgress = progress;
            send({ type: "progress", progress });
          },
        });

        send({ type: "complete", plan });
      } catch (error) {
        if (error instanceof OrganizationCancelledError) {
          latestProgress = error.progress;
          send({ type: "cancelled", progress: latestProgress });
        } else if (error instanceof OrganizationError) {
          send({
            type: "error",
            code: error.code,
            message: error.message,
          });
        } else if (error instanceof OllamaClientError) {
          send({
            type: "error",
            code: error.code,
            message: error.message,
          });
        } else {
          send({
            type: "error",
            code: "planning_failed",
            message:
              "The organization preview could not be completed. No files were changed.",
          });
        }
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The client may have disconnected while the plan was finishing.
          }
        }
      }
    },
    cancel() {
      closed = true;
      planController.abort();
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

/**
 * Rebuild metadata from disk instead of trusting client-supplied size, dates,
 * or MIME types. Every path must stay inside the approved root.
 */
async function collectScannedFiles(
  rootPath: string,
  relativePaths: string[],
): Promise<ScannedFile[] | Response> {
  const unique = Array.from(new Set(relativePaths));
  const files: ScannedFile[] = [];
  let canonicalRoot: string;

  try {
    canonicalRoot = await fs.realpath(rootPath);
  } catch {
    return apiError(
      404,
      "folder_unavailable",
      "The approved folder is no longer available. Choose it again. No files were changed.",
    );
  }

  for (const relativePath of unique) {
    try {
      const absolute = resolveInsideRoot(rootPath, relativePath);
      const stats = await fs.lstat(absolute);

      if (stats.isSymbolicLink() || !stats.isFile()) continue;

      const canonical = await fs.realpath(absolute);
      if (!isStrictlyInsidePath(canonicalRoot, canonical)) {
        return apiError(
          403,
          "outside_root",
          "A requested file is outside the approved folder. No files were read.",
        );
      }

      files.push(
        describeFile(path.basename(canonical), relativePath, stats),
      );
    } catch (error) {
      if (
        error instanceof PathSafetyError &&
        (error.code === "outside_root" || error.code === "unsafe_symlink")
      ) {
        return apiError(
          403,
          error.code,
          "A requested file is outside the approved folder. No files were read.",
        );
      }

      // A file may have disappeared since the scan. It is skipped rather than
      // treated as an empty file.
      continue;
    }
  }

  return files;
}
