import { promises as fs } from "node:fs";
import path from "node:path";
import {
  OllamaClientError,
  type StructuredChatRequest,
  type StructuredChatResult,
} from "@/lib/ai/ollama-client";
import { describeFile } from "@/lib/files/metadata";
import { hashFileSha256 } from "@/lib/files/hash";
import { extractDocumentText } from "@/lib/files/text-extraction";
import {
  isStrictlyInsidePath,
  resolveInsideRoot,
} from "@/lib/files/path-safety";
import {
  aiSuggestionSchema,
  type AiSuggestion,
  type ExtractionInfo,
  type OrganizationPlan,
  type OrganizationPlanEntry,
  type OrganizationProgress,
} from "@/lib/validation/organization";
import type { ScannedFile } from "@/types";
import {
  canonicalDestination,
  ORGANIZATION_RULES_VERSION,
} from "./rules";
import {
  checkDestination,
  destinationKey,
} from "./conflicts";
import {
  buildOrganizerUserPrompt,
  ORGANIZER_SYSTEM_PROMPT,
  type PromptFileInput,
} from "./prompt";
import { sanitizeSuggestedFileName } from "./sanitize";

export interface PlannerClient {
  chatStructured<T>(
    request: StructuredChatRequest<T>,
  ): Promise<StructuredChatResult<T>>;
}

export interface PlanOrganizationOptions {
  rootPath: string;
  files: ScannedFile[];
  client: PlannerClient;
  /** Model name, used only for plan metadata. */
  model: string;
  signal?: AbortSignal;
  onProgress?: (progress: OrganizationProgress) => void | Promise<void>;
  concurrency?: number;
  /** Maximum number of files sent to the model in one batch. */
  maxFiles?: number;
  maxAttempts?: number;
  requestTimeoutMs?: number;
}

export const PLAN_DEFAULTS = {
  concurrency: 2,
  maxConcurrency: 4,
  maxFiles: 24,
  maxPlanFiles: 50,
  maxAttempts: 2,
  maxAttemptsLimit: 3,
  requestTimeoutMs: 90_000,
} as const;

export class OrganizationCancelledError extends Error {
  readonly progress: OrganizationProgress;

  constructor(progress: OrganizationProgress) {
    super("Organization planning was cancelled. No file was changed.");
    this.name = "OrganizationCancelledError";
    this.progress = progress;
  }
}

export type OrganizationErrorCode =
  | "ollama_unavailable"
  | "model_missing"
  | "unsafe_endpoint"
  | "planning_failed";

export class OrganizationError extends Error {
  readonly code: OrganizationErrorCode;

  constructor(code: OrganizationErrorCode, message: string) {
    super(message);
    this.name = "OrganizationError";
    this.code = code;
  }
}

class SuggestionRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionRejected";
  }
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function emptyProgress(total: number): OrganizationProgress {
  return {
    completed: 0,
    total,
    currentFile: "",
    ready: 0,
    needsReview: 0,
    failed: 0,
  };
}

function extractionInfoForSkipped(reason: string): ExtractionInfo {
  return {
    status: "not-needed",
    characters: 0,
    truncated: false,
    message: reason,
  };
}

function fatalCodeFor(error: OllamaClientError): OrganizationErrorCode | null {
  switch (error.code) {
    case "unsafe_endpoint":
      return "unsafe_endpoint";
    case "unavailable":
      return "ollama_unavailable";
    case "model_missing":
      return "model_missing";
    default:
      return null;
  }
}

/**
 * Validate and normalize one model reply. Schema validation already happened in
 * the Ollama client; this layer enforces application rules that a JSON schema
 * cannot express (approved folders, extension preservation, safe filenames).
 */
function validateSuggestion(
  raw: AiSuggestion,
  file: ScannedFile,
): AiSuggestion {
  const destination = canonicalDestination(
    raw.category,
    raw.suggestedRelativePath,
  );

  if (!destination) {
    throw new SuggestionRejected(
      "The model chose a destination outside the approved organization scheme.",
    );
  }

  const filename = sanitizeSuggestedFileName(
    raw.suggestedFileName,
    file.name,
    file.extension,
  );

  if (!filename.ok) {
    throw new SuggestionRejected(filename.reason);
  }

  const reason = raw.reason.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!reason) {
    throw new SuggestionRejected(
      "The model did not provide a usable explanation.",
    );
  }

  return {
    category: raw.category,
    suggestedFileName: filename.value,
    suggestedRelativePath: destination,
    reason,
    uncertainty: raw.uncertainty,
  };
}

function addWarning(entry: OrganizationPlanEntry, warning: string): void {
  if (!entry.warnings.includes(warning)) entry.warnings.push(warning);
}

function markNeedsReview(entry: OrganizationPlanEntry): void {
  if (entry.outcome === "ready" || entry.outcome === "needs-review") {
    entry.outcome = "needs-review";
  }
}

function failedEntry(
  file: ScannedFile,
  extraction: ExtractionInfo,
  message: string,
  attempts = 0,
): OrganizationPlanEntry {
  return {
    file,
    suggestion: null,
    outcome: "failed",
    warnings: [message],
    extraction,
    attempts,
    modelDurationMs: null,
    error: message,
  };
}

async function revalidateFile(
  rootPath: string,
  file: ScannedFile,
): Promise<ScannedFile> {
  const absolute = resolveInsideRoot(rootPath, file.relativePath);
  const stats = await fs.lstat(absolute);

  if (stats.isSymbolicLink()) {
    throw new Error(
      "This file is a symbolic link. SlothSort never follows links.",
    );
  }
  if (!stats.isFile()) {
    throw new Error("This entry is no longer a regular file.");
  }

  const canonical = await fs.realpath(absolute);
  const canonicalRoot = await fs.realpath(rootPath);
  if (!isStrictlyInsidePath(canonicalRoot, canonical)) {
    throw new Error(
      "This file resolves outside the approved folder. It was not read.",
    );
  }

  return describeFile(path.basename(canonical), file.relativePath, stats);
}

interface AnalyzeContext {
  rootPath: string;
  client: PlannerClient;
  maxAttempts: number;
  requestTimeoutMs: number;
  signal: AbortSignal;
  currentProgress: () => OrganizationProgress;
  abort: () => void;
}

async function analyzeFile(
  file: ScannedFile,
  context: AnalyzeContext,
): Promise<OrganizationPlanEntry> {
  if (file.kind === "other") {
    return {
      file,
      suggestion: null,
      outcome: "skipped",
      warnings: [
        "Unsupported file type. SlothSort never sends executables or unknown binaries to the model.",
      ],
      extraction: extractionInfoForSkipped(
        "SlothSort does not extract or organize this file type.",
      ),
      attempts: 0,
      modelDurationMs: null,
      error: null,
    };
  }

  let currentFile: ScannedFile;
  try {
    currentFile = await revalidateFile(context.rootPath, file);
  } catch (error) {
    return failedEntry(
      file,
      extractionInfoForSkipped(
        "The file could not be revalidated immediately before reading.",
      ),
      error instanceof Error
        ? error.message
        : "The file changed after the scan. It was not read.",
    );
  }

  if (currentFile.kind === "other") {
    return {
      file: currentFile,
      suggestion: null,
      outcome: "skipped",
      warnings: [
        "The file type is not supported for organization. It was not sent to the model.",
      ],
      extraction: extractionInfoForSkipped(
        "SlothSort does not extract or organize this file type.",
      ),
      attempts: 0,
      modelDurationMs: null,
      error: null,
    };
  }

  const hash = await hashFileSha256(
    resolveInsideRoot(context.rootPath, currentFile.relativePath),
  );
  if (hash) {
    currentFile = { ...currentFile, sha256: hash };
  }

  const extraction = await extractDocumentText(
    resolveInsideRoot(context.rootPath, currentFile.relativePath),
    currentFile,
  );

  const promptInput: PromptFileInput = {
    file: currentFile,
    extractedText: extraction.text,
    extractionStatus: extraction.info.status,
    extractionMessage: extraction.info.message,
  };

  let lastError = "The local model did not return a safe suggestion.";
  let attempts = 0;
  let modelDurationMs = 0;

  for (let attempt = 1; attempt <= context.maxAttempts; attempt += 1) {
    if (context.signal.aborted) {
      throw new OrganizationCancelledError(context.currentProgress());
    }

    attempts = attempt;

    try {
      const completion = await context.client.chatStructured<AiSuggestion>({
        systemPrompt: ORGANIZER_SYSTEM_PROMPT,
        userPrompt: buildOrganizerUserPrompt(promptInput),
        schema: aiSuggestionSchema,
        maxOutputTokens: 360,
        timeoutMs: context.requestTimeoutMs,
        signal: context.signal,
      });

      modelDurationMs += completion.durationMs;
      const suggestion = validateSuggestion(completion.data, currentFile);
      const warnings: string[] = [];

      if (
        currentFile.kind === "document" &&
        extraction.info.status !== "extracted"
      ) {
        warnings.push(
          "Document text was not available. This suggestion is based on metadata only.",
        );
      }

      return {
        file: currentFile,
        suggestion,
        outcome:
          suggestion.uncertainty === "low" && warnings.length === 0
            ? "ready"
            : "needs-review",
        warnings,
        extraction: extraction.info,
        attempts,
        modelDurationMs,
        error: null,
      };
    } catch (error) {
      if (error instanceof OllamaClientError) {
        if (error.code === "cancelled") {
          throw new OrganizationCancelledError(context.currentProgress());
        }

        const fatalCode = fatalCodeFor(error);
        if (fatalCode) {
          context.abort();
          throw new OrganizationError(fatalCode, error.message);
        }

        lastError = error.message;
        continue;
      }

      if (error instanceof SuggestionRejected) {
        lastError = error.message;
        continue;
      }

      lastError =
        "The local model could not produce a suggestion that passed validation.";
    }
  }

  return failedEntry(
    currentFile,
    extraction.info,
    `${lastError} No suggestion was used.`,
    attempts,
  );
}

interface PoolResult {
  entries: OrganizationPlanEntry[];
  fatal: unknown;
}

/**
 * Run the model calls with a fixed worker pool. A fatal failure stops new work
 * and aborts in-flight requests, but every worker is awaited so no request is
 * left running after the plan returns.
 */
async function runPool(
  files: ScannedFile[],
  concurrency: number,
  worker: (file: ScannedFile) => Promise<OrganizationPlanEntry>,
  abort: () => void,
): Promise<PoolResult> {
  const entries: OrganizationPlanEntry[] = new Array(files.length);
  let nextIndex = 0;
  let fatal: unknown = null;

  const run = async (): Promise<void> => {
    while (true) {
      if (fatal) return;

      const index = nextIndex;
      nextIndex += 1;
      if (index >= files.length) return;

      try {
        entries[index] = await worker(files[index]);
      } catch (error) {
        fatal ??= error;
        abort();
        return;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, files.length)) },
    () => run(),
  );

  await Promise.all(workers);
  return { entries, fatal };
}

/**
 * Build a read-only organization preview.
 *
 * The model only classifies and names files. Every path, filename, conflict,
 * and hash is produced by deterministic code. No operation moves or renames a
 * file, and unapproved changes cannot be executed from this module.
 */
export async function planOrganization(
  options: PlanOrganizationOptions,
): Promise<OrganizationPlan> {
  const startedAt = Date.now();
  const concurrency = clampInteger(
    options.concurrency,
    PLAN_DEFAULTS.concurrency,
    1,
    PLAN_DEFAULTS.maxConcurrency,
  );
  const maxFiles = clampInteger(
    options.maxFiles,
    PLAN_DEFAULTS.maxFiles,
    1,
    PLAN_DEFAULTS.maxPlanFiles,
  );
  const maxAttempts = clampInteger(
    options.maxAttempts,
    PLAN_DEFAULTS.maxAttempts,
    1,
    PLAN_DEFAULTS.maxAttemptsLimit,
  );
  const requestTimeoutMs = clampInteger(
    options.requestTimeoutMs,
    PLAN_DEFAULTS.requestTimeoutMs,
    5_000,
    300_000,
  );

  const externalSignal = options.signal;
  const runController = new AbortController();
  const abortFromCaller = () => runController.abort();
  if (externalSignal?.aborted) {
    runController.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const uniqueFiles = Array.from(
    new Map(
      options.files
        .filter((file) => file.relativePath.trim().length > 0)
        .map((file) => [file.relativePath, file] as const),
    ).values(),
  ).sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  const supported = uniqueFiles.filter((file) => file.kind !== "other");
  const unsupported = uniqueFiles.filter((file) => file.kind === "other");
  const candidates = supported.slice(0, maxFiles);
  const truncated = supported.length > candidates.length;
  const totalToProcess = candidates.length;

  let progress = emptyProgress(totalToProcess);

  const emitProgress = async (): Promise<void> => {
    await options.onProgress?.({ ...progress });
  };

  await emitProgress();

  if (runController.signal.aborted) {
    externalSignal?.removeEventListener("abort", abortFromCaller);
    throw new OrganizationCancelledError(progress);
  }

  const context: AnalyzeContext = {
    rootPath: options.rootPath,
    client: options.client,
    maxAttempts,
    requestTimeoutMs,
    signal: runController.signal,
    currentProgress: () => ({ ...progress }),
    abort: () => runController.abort(),
  };

  const pool = await runPool(
    candidates,
    concurrency,
    async (file) => {
      const entry = await analyzeFile(file, context);

      progress = {
        ...progress,
        completed: progress.completed + 1,
        currentFile: entry.file.relativePath,
        ready: progress.ready + (entry.outcome === "ready" ? 1 : 0),
        needsReview:
          progress.needsReview +
          (entry.outcome === "needs-review" ? 1 : 0),
        failed: progress.failed + (entry.outcome === "failed" ? 1 : 0),
      };
      await emitProgress();
      return entry;
    },
    () => runController.abort(),
  );

  externalSignal?.removeEventListener("abort", abortFromCaller);

  if (pool.fatal) {
    if (pool.fatal instanceof OrganizationCancelledError) {
      throw new OrganizationCancelledError(progress);
    }
    throw pool.fatal;
  }

  const analyzed = pool.entries.filter(
    (entry): entry is OrganizationPlanEntry => Boolean(entry),
  );
  const skippedUnsupported = unsupported.map<OrganizationPlanEntry>((file) => ({
    file,
    suggestion: null,
    outcome: "skipped",
    warnings: [
      "Unsupported file type. It was not sent to the local model.",
    ],
    extraction: extractionInfoForSkipped(
      "SlothSort does not extract or organize this file type.",
    ),
    attempts: 0,
    modelDurationMs: null,
    error: null,
  }));

  const entries = [...analyzed, ...skippedUnsupported].sort((first, second) =>
    first.file.relativePath.localeCompare(second.file.relativePath, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  markExactDuplicates(entries);
  await markDestinationConflicts(entries, options.rootPath);
  const totals = {
    files: entries.length,
    ready: entries.filter((entry) => entry.outcome === "ready").length,
    needsReview: entries.filter((entry) => entry.outcome === "needs-review")
      .length,
    skipped: entries.filter((entry) => entry.outcome === "skipped").length,
    failed: entries.filter((entry) => entry.outcome === "failed").length,
    proposedChanges: entries.filter((entry) => entry.suggestion !== null).length,
    exactDuplicates: entries.filter((entry) =>
      entry.warnings.some((warning) => warning.startsWith("Exact duplicate")),
    ).length,
  };

  externalSignal?.removeEventListener("abort", abortFromCaller);

  return {
    folderName: path.basename(options.rootPath) || options.rootPath,
    generatedAt: new Date().toISOString(),
    model: options.model,
    entries,
    totals,
    durationMs: Math.max(0, Date.now() - startedAt),
    truncated,
    truncationReason: truncated
      ? `Only the first ${maxFiles} supported files were analyzed in this batch. Scan or plan again for the rest.`
      : null,
    rulesVersion: ORGANIZATION_RULES_VERSION,
  };
}

/**
 * Exact duplicate detection is deterministic and independent of the model. It
 * only compares hashes computed by `hashFileSha256`.
 */
function markExactDuplicates(entries: OrganizationPlanEntry[]): void {
  const byHash = new Map<string, OrganizationPlanEntry[]>();

  for (const entry of entries) {
    if (!entry.file.sha256) continue;
    const group = byHash.get(entry.file.sha256) ?? [];
    group.push(entry);
    byHash.set(entry.file.sha256, group);
  }

  for (const group of byHash.values()) {
    if (group.length < 2) continue;

    for (const entry of group) {
      const others = group
        .filter((other) => other !== entry)
        .map((other) => other.file.relativePath)
        .join(", ");
      addWarning(
        entry,
        `Exact duplicate of ${others} (same SHA-256). Review before organizing.`,
      );
      markNeedsReview(entry);
    }
  }
}

function suggestedDestination(entry: OrganizationPlanEntry): string | null {
  if (!entry.suggestion) return null;
  return `${entry.suggestion.suggestedRelativePath}/${entry.suggestion.suggestedFileName}`;
}

/**
 * Conflict detection is deterministic and read-only. It checks the real
 * filesystem and the rest of the batch for the same destination.
 */
async function markDestinationConflicts(
  entries: OrganizationPlanEntry[],
  rootPath: string,
): Promise<void> {
  const byDestination = new Map<string, OrganizationPlanEntry[]>();

  for (const entry of entries) {
    const target = suggestedDestination(entry);
    if (!target) continue;

    const key = destinationKey(target);
    byDestination.set(key, [...(byDestination.get(key) ?? []), entry]);

    if (key === destinationKey(entry.file.relativePath)) continue;

    const check = await checkDestination(rootPath, target);
    if (check.state !== "clear") {
      addWarning(entry, check.reason ?? "The destination is not clear.");
      markNeedsReview(entry);
    }
  }

  for (const group of byDestination.values()) {
    if (group.length < 2) continue;

    for (const entry of group) {
      addWarning(
        entry,
        "Another file in this batch is proposed for the same destination. Review the collision before applying anything.",
      );
      markNeedsReview(entry);
    }
  }
}
