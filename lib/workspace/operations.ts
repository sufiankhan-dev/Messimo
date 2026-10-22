import {
  applyStreamEventSchema,
  undoResponseSchema,
  type ApplyProgress,
  type ApplyResult,
  type RequestedOperation,
  type UndoResult,
} from "@/lib/validation/operations";
import { apiErrorResponseSchema } from "@/lib/validation/files";
import type { OrganizationFile } from "@/types";

const MAX_OPERATIONS = 50;

export interface ApprovedOperationPlan {
  fileId: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  operation: RequestedOperation;
}

function normalized(value: string): string {
  return value.replace(/\\/g, "/");
}

/**
 * Build the exact list the user approved. A suggestion that would not change
 * the file's path is omitted instead of being sent as a no-op operation.
 */
export function getApprovedOperations(
  files: OrganizationFile[],
): ApprovedOperationPlan[] {
  const operations: ApprovedOperationPlan[] = [];

  for (const file of files) {
    if (file.status !== "approved" || !file.suggestion) continue;
    if (!file.supported || file.kind === "other") continue;

    const source = normalized(file.relativePath);
    const target = `${normalized(file.suggestion.suggestedRelativePath).replace(
      /\/+$/,
      "",
    )}/${file.suggestion.suggestedFileName}`;

    if (source.toLowerCase() === target.toLowerCase()) continue;
    if (operations.length >= MAX_OPERATIONS) break;

    operations.push({
      fileId: file.id,
      sourceRelativePath: source,
      targetRelativePath: target,
      operation: {
        sourceRelativePath: source,
        targetRelativePath: target,
        expectedSizeBytes: file.sizeBytes,
        expectedModifiedAt: file.modifiedAt,
        ...(file.sha256 ? { expectedSha256: file.sha256 } : {}),
      },
    });
  }

  return operations;
}

/** Approved suggestions that need no file operation because nothing changes. */
export function countNoChangeApprovals(files: OrganizationFile[]): number {
  return files.filter(
    (file) =>
      file.status === "approved" &&
      file.suggestion !== null &&
      file.supported &&
      file.kind !== "other" &&
      normalized(file.relativePath).toLowerCase() ===
        `${normalized(file.suggestion.suggestedRelativePath).replace(
          /\/+$/,
          "",
        )}/${file.suggestion.suggestedFileName}`.toLowerCase(),
  ).length;
}

async function readApiMessage(response: Response): Promise<string> {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // Fall through to a safe generic message.
  }

  if (response.status === 403) {
    return "This action is available only from the local Messimo app on this computer.";
  }
  if (response.status === 404) {
    return "That folder approval expired. Generate a new preview.";
  }

  return "The request could not be completed. No files were changed.";
}

export interface ApplyBatchInput {
  folderId: string;
  operations: RequestedOperation[];
}

export interface ApplyBatchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ApplyProgress) => void;
}

/**
 * Stream an explicitly confirmed batch. Terminal events are required; a stream
 * that ends unexpectedly is never treated as success.
 */
export async function applyApprovedBatch(
  input: ApplyBatchInput,
  options: ApplyBatchOptions = {},
): Promise<ApplyResult> {
  const response = await fetch("/api/organize/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderId: input.folderId,
      confirmed: true,
      operations: input.operations,
    }),
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readApiMessage(response));
  }
  if (!response.body) {
    throw new Error(
      "The batch response had no body. Open History before trying again.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ApplyResult | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
      if (!line) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(line) as unknown;
      } catch {
        throw new Error(
          "The batch stream was not valid. Open History before trying again.",
        );
      }

      const parsed = applyStreamEventSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(
          "The batch stream returned an unexpected event. Open History before trying again.",
        );
      }

      if (parsed.data.type === "progress") {
        options.onProgress?.(parsed.data.progress);
      } else if (parsed.data.type === "complete") {
        result = parsed.data.result;
      } else {
        throw new Error(parsed.data.message);
      }
    }
  }

  if (!result) {
    throw new Error(
      "The batch ended before it confirmed the result. Open History to check which files changed before trying again.",
    );
  }

  return result;
}

export async function requestUndo(operationId: string): Promise<UndoResult> {
  const response = await fetch(
    `/api/history/${encodeURIComponent(operationId)}/undo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readApiMessage(response));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The undo response was not valid.");
  }

  const parsed = undoResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("The undo response was not valid.");
  }

  return parsed.data.result;
}
