import type {
  AiSuggestion,
  FileCategory,
  Uncertainty,
} from "@/lib/validation/organization";

export type { AiSuggestion, FileCategory, Uncertainty };

export type FileKind = "document" | "image" | "archive" | "other";

/** Metadata collected during a read-only folder scan. */
export interface ScannedFile {
  id: string;
  name: string;
  /** Path relative to the approved root. Absolute paths stay on the server. */
  relativePath: string;
  extension: string;
  sizeBytes: number;
  /** ISO 8601 timestamp. */
  modifiedAt: string;
  kind: FileKind;
  /** SHA-256 of the file contents, used for exact duplicate detection. */
  sha256?: string;
  warnings: string[];
}

export interface DuplicateGroup {
  id: string;
  sha256: string;
  fileIds: string[];
}

export interface SkippedFile {
  relativePath: string;
  reason: string;
}

export interface ScanResult {
  rootName: string;
  /** ISO 8601 timestamp. */
  scannedAt: string;
  files: ScannedFile[];
  duplicateGroups: DuplicateGroup[];
  skipped: SkippedFile[];
}

/** Where a file stands in the human review workflow. */
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs-review";

/** What approving a suggestion would actually do. */
export type ProposedAction = "move" | "rename" | "move-and-rename" | "none";

/** A scanned file joined with the (optional) local AI suggestion. */
export interface OrganizationFile extends ScannedFile {
  suggestion: AiSuggestion | null;
  status: ReviewStatus;
  duplicateGroupId: string | null;
  /** False when SlothSort declines to propose a destination for this type. */
  supported: boolean;
}

export interface WorkspaceFolder {
  name: string;
  displayPath: string;
  platform: "Windows" | "macOS" | "Linux";
  lastScannedAt: string;
}

export interface WorkspaceSummary {
  scannedFiles: number;
  proposedChanges: number;
  duplicateFiles: number;
  needsReview: number;
  approved: number;
  rejected: number;
  totalBytes: number;
}

export interface CategoryCount {
  category: FileCategory;
  count: number;
}

export interface DuplicateGroupView {
  id: string;
  sha256: string;
  sizeBytes: number;
  files: OrganizationFile[];
  recoverableBytes: number;
}

export interface SimilarNameGroup {
  id: string;
  fileIds: string[];
  note: string;
}

export type OperationKind = "move" | "rename" | "mixed";
export type OperationStatus = "completed" | "partial" | "failed" | "undone";

export interface OperationItem {
  from: string;
  to: string;
}

/** A locally recorded batch of approved file operations. */
export interface OperationRecord {
  id: string;
  kind: OperationKind;
  summary: string;
  /** ISO 8601 timestamp. */
  appliedAt: string;
  status: OperationStatus;
  itemCount: number;
  items: OperationItem[];
  note: string;
  undoable: boolean;
  undoUnavailableReason?: string;
}

export type OllamaState = "connected" | "model-missing" | "unreachable";

/** Result of the local-only Ollama health check. */
export interface OllamaStatus {
  state: OllamaState;
  connected: boolean;
  baseUrl: string;
  selectedModel: string;
  installedModels: string[];
  modelAvailable: boolean;
  /** ISO 8601 timestamp. */
  checkedAt: string;
  message: string;
}
