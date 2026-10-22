import type {
  DuplicateGroup,
  OperationRecord,
  OrganizationFile,
  SimilarNameGroup,
  WorkspaceFolder,
} from "@/types";

/**
 * Demo workspace data.
 *
 * Everything in this file is synthetic. It exists so the interface can be built
 * and reviewed before the local scanner, Ollama client, and file operation
 * service are implemented. No screen reads these values from disk, and no screen
 * may use them to modify files. Replace this module with the real data layer
 * (starting in Milestone 2) instead of importing it from production modules.
 */

export const DEMO_FOLDER: WorkspaceFolder = {
  name: "Downloads",
  displayPath: "C:\\Users\\example\\Downloads",
  platform: "Windows",
  lastScannedAt: "2026-10-19T16:05:00.000Z",
};

export const DEMO_FILES_BASE: Omit<OrganizationFile, "mimeType">[] = [
  {
    id: "file-invoice-march",
    name: "invoice_acme_march.pdf",
    relativePath: "invoice_acme_march.pdf",
    extension: "pdf",
    sizeBytes: 291_420,
    modifiedAt: "2026-10-18T09:12:00.000Z",
    kind: "document",
    sha256:
      "9f2a6c1e4b8d0a7f3c5e9b2d6a1f8c4e7b0d3a9f5c2e8b1d4a7f0c6e3b9d2a5f",
    duplicateGroupId: "duplicate-invoice-march",
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Finance",
      suggestedFileName: "2026-03-acme-invoice.pdf",
      suggestedRelativePath: "Finance/Invoices",
      reason:
        "The filename follows an invoice pattern and includes a month and vendor. Contents were not opened.",
      uncertainty: "low",
    },
  },
  {
    id: "file-invoice-march-copy",
    name: "invoice_acme_march (1).pdf",
    relativePath: "invoice_acme_march (1).pdf",
    extension: "pdf",
    sizeBytes: 291_420,
    modifiedAt: "2026-10-18T09:14:00.000Z",
    kind: "document",
    sha256:
      "9f2a6c1e4b8d0a7f3c5e9b2d6a1f8c4e7b0d3a9f5c2e8b1d4a7f0c6e3b9d2a5f",
    duplicateGroupId: "duplicate-invoice-march",
    supported: true,
    status: "needs-review",
    warnings: [
      "Exact duplicate of invoice_acme_march.pdf (same SHA-256).",
    ],
    suggestion: null,
  },
  {
    id: "file-photo-garden",
    name: "IMG_2043.JPG",
    relativePath: "IMG_2043.JPG",
    extension: "JPG",
    sizeBytes: 3_355_443,
    modifiedAt: "2026-10-16T18:40:00.000Z",
    kind: "image",
    sha256:
      "3c81f4a9d2e7b0c5a8f1d6e3b9c2a7f4d0e5b8c1a6f9d2e4b7c0a5f8d1e6b3c9",
    duplicateGroupId: "duplicate-photo-2043",
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Images",
      suggestedFileName: "2026-05-garden-lunch.JPG",
      suggestedRelativePath: "Images/2026",
      reason:
        "A camera photo dated May 2026. The suggestion uses the filename; the image itself was not analyzed.",
      uncertainty: "low",
    },
  },
  {
    id: "file-photo-garden-copy",
    name: "IMG_2043 (1).JPG",
    relativePath: "IMG_2043 (1).JPG",
    extension: "JPG",
    sizeBytes: 3_355_443,
    modifiedAt: "2026-10-16T18:41:00.000Z",
    kind: "image",
    sha256:
      "3c81f4a9d2e7b0c5a8f1d6e3b9c2a7f4d0e5b8c1a6f9d2e4b7c0a5f8d1e6b3c9",
    duplicateGroupId: "duplicate-photo-2043",
    supported: true,
    status: "needs-review",
    warnings: ["Exact duplicate of IMG_2043.JPG (same SHA-256)."],
    suggestion: null,
  },
  {
    id: "file-photo-balcony",
    name: "IMG_2044.JPG",
    relativePath: "IMG_2044.JPG",
    extension: "JPG",
    sizeBytes: 3_201_882,
    modifiedAt: "2026-10-16T18:42:00.000Z",
    kind: "image",
    sha256:
      "7e1b0c4d8a2f6e9b3c5d1a7f0e4b8c2d6a9f3e1c7b5d0a8f2e6c4b9d1a7f3e5c",
    duplicateGroupId: null,
    supported: true,
    status: "needs-review",
    warnings: [
      "Similar filename to IMG_2043.JPG, but the content hash is different. It is not a duplicate.",
    ],
    suggestion: {
      category: "Images",
      suggestedFileName: "2026-05-balcony-view.JPG",
      suggestedRelativePath: "Images/2026",
      reason:
        "A second camera photo from the same day. It is kept separately because its contents differ from IMG_2043.JPG.",
      uncertainty: "medium",
    },
  },
  {
    id: "file-budget-q2",
    name: "Q2-budget-final-v3.xlsx",
    relativePath: "Q2-budget-final-v3.xlsx",
    extension: "xlsx",
    sizeBytes: 98_304,
    modifiedAt: "2026-10-15T11:05:00.000Z",
    kind: "document",
    sha256:
      "1a5c9e3b7d0f4a8c2e6b9d1f5a3c7e0b4d8f2a6c9e1b5d7f0a3c8e4b6d2f9a1c",
    duplicateGroupId: null,
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Work",
      suggestedFileName: "q2-budget-2026.xlsx",
      suggestedRelativePath: "Work/Finance",
      reason:
        "A spreadsheet with a quarter and budget in its name, likely work finance material.",
      uncertainty: "low",
    },
  },
  {
    id: "file-resume",
    name: "resume_latest.docx",
    relativePath: "resume_latest.docx",
    extension: "docx",
    sizeBytes: 43_008,
    modifiedAt: "2026-10-12T08:20:00.000Z",
    kind: "document",
    sha256:
      "5b8d2f6a0c3e9b1d7f4a8c2e6b0d9f3a5c7e1b4d8f0a2c6e9b3d7f1a5c8e0b4d",
    duplicateGroupId: null,
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Documents",
      suggestedFileName: "2026-resume.docx",
      suggestedRelativePath: "Documents/Career",
      reason:
        "A Word document whose name suggests a résumé. Contents were not inspected.",
      uncertainty: "medium",
    },
  },
  {
    id: "file-tax-return",
    name: "tax-return-2025.pdf",
    relativePath: "tax-return-2025.pdf",
    extension: "pdf",
    sizeBytes: 1_466_368,
    modifiedAt: "2026-10-10T20:02:00.000Z",
    kind: "document",
    sha256:
      "2f7a1c5e9b3d0f6a4c8e2b5d9f1a7c3e6b0d4f8a2c5e9b1d7f3a6c0e4b8d2f5a",
    duplicateGroupId: null,
    supported: true,
    status: "needs-review",
    warnings: [
      "Based on the filename only. No document text was extracted.",
    ],
    suggestion: {
      category: "Finance",
      suggestedFileName: "2025-tax-return.pdf",
      suggestedRelativePath: "Finance/Tax",
      reason:
        "The filename suggests a 2025 tax return, but no text was extracted. Treat this as a guess, not a verified fact.",
      uncertainty: "high",
    },
  },
  {
    id: "file-meeting-notes",
    name: "meeting-notes-2026-04-18.txt",
    relativePath: "meeting-notes-2026-04-18.txt",
    extension: "txt",
    sizeBytes: 3_112,
    modifiedAt: "2026-10-09T15:30:00.000Z",
    kind: "document",
    sha256:
      "8c4e0b3d7f1a5c9e2b6d0f4a8c1e5b9d3f7a0c4e8b2d6f9a1c5e3b7d0f4a8c2e",
    duplicateGroupId: null,
    supported: true,
    status: "approved",
    warnings: [],
    suggestion: {
      category: "Work",
      suggestedFileName: "meeting-notes-2026-04-18.txt",
      suggestedRelativePath: "Work/Meeting notes",
      reason:
        "Meeting notes named with a date. The filename already reads well, so only the folder changes.",
      uncertainty: "low",
    },
  },
  {
    id: "file-project-alpha",
    name: "project-alpha-v2.zip",
    relativePath: "project-alpha-v2.zip",
    extension: "zip",
    sizeBytes: 18_874_368,
    modifiedAt: "2026-10-08T10:15:00.000Z",
    kind: "archive",
    sha256:
      "4d8f2a6c0e3b7d1f5a9c2e6b8d0f4a7c1e5b9d3f6a0c2e8b4d7f1a5c9e3b6d0f",
    duplicateGroupId: null,
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Projects",
      suggestedFileName: "project-alpha-v2.zip",
      suggestedRelativePath: "Projects/Alpha",
      reason:
        "A project archive. It stays zipped and keeps its original name.",
      uncertainty: "low",
    },
  },
  {
    id: "file-installer",
    name: "setup-toolkit.exe",
    relativePath: "setup-toolkit.exe",
    extension: "exe",
    sizeBytes: 67_108_864,
    modifiedAt: "2026-10-07T21:48:00.000Z",
    kind: "other",
    sha256:
      "0b6d2f8a4c1e7b3d9f5a0c6e2b8d4f1a7c3e9b5d0f6a2c8e4b7d1f5a3c9e6b0d",
    duplicateGroupId: null,
    supported: false,
    status: "needs-review",
    warnings: [
      "Unsupported file type. Messimo never moves executable files automatically.",
    ],
    suggestion: null,
  },
  {
    id: "file-family-photo",
    name: "family-photo-2024.jpg",
    relativePath: "family-photo-2024.jpg",
    extension: "jpg",
    sizeBytes: 2_516_582,
    modifiedAt: "2026-10-05T17:22:00.000Z",
    kind: "image",
    sha256:
      "6a0c4e8b2d7f1a5c9e3b6d0f4a8c1e5b7d3f9a0c6e2b4d8f1a7c5e9b3d6f0a2c",
    duplicateGroupId: null,
    supported: true,
    status: "approved",
    warnings: [],
    suggestion: {
      category: "Images",
      suggestedFileName: "2024-family-reunion.jpg",
      suggestedRelativePath: "Images/Family",
      reason:
        "A personal photo from 2024. The filename mentions family, so it is grouped with family photos.",
      uncertainty: "low",
    },
  },
  {
    id: "file-design-board",
    name: "design-inspo-board.png",
    relativePath: "design-inspo-board.png",
    extension: "png",
    sizeBytes: 845_210,
    modifiedAt: "2026-10-04T13:08:00.000Z",
    kind: "image",
    sha256:
      "d1e7b3a9c5f0d6e2b8a4c7f1d9e3b0a6c2f8e4b9d5a1c7e0b3f6d2a8c4e9b5d1",
    duplicateGroupId: null,
    supported: true,
    status: "approved",
    warnings: [],
    suggestion: {
      category: "Work",
      suggestedFileName: "design-inspo-board.png",
      suggestedRelativePath: "Work/Design inspiration",
      reason:
        "A screenshot-style PNG named as a design board. The filename already works; only the folder changes.",
      uncertainty: "medium",
    },
  },
  {
    id: "file-old-invoice",
    name: "old-invoice.pdf",
    relativePath: "old-invoice.pdf",
    extension: "pdf",
    sizeBytes: 512_000,
    modifiedAt: "2026-09-28T12:00:00.000Z",
    kind: "document",
    sha256:
      "7f3a9c1e5b0d6f2a8c4e9b3d7f1a5c0e6b2d8f4a9c1e3b7d0f5a2c6e8b4d9f1a",
    duplicateGroupId: null,
    supported: true,
    status: "rejected",
    warnings: ["This suggestion was rejected. The file stays where it is."],
    suggestion: {
      category: "Finance",
      suggestedFileName: "2025-11-old-invoice.pdf",
      suggestedRelativePath: "Finance/Invoices",
      reason:
        "An older invoice PDF. The date is taken from the filename and has not been verified.",
      uncertainty: "low",
    },
  },
  {
    id: "file-archive-2025",
    name: "archive-2025.zip",
    relativePath: "archive-2025.zip",
    extension: "zip",
    sizeBytes: 24_117_248,
    modifiedAt: "2026-09-22T09:45:00.000Z",
    kind: "archive",
    sha256:
      "b4d0f6a2c8e1b5d9f3a7c0e4b8d2f6a9c3e7b1d5f0a4c6e8b2d9f3a5c7e1b0d4",
    duplicateGroupId: null,
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: {
      category: "Archives",
      suggestedFileName: "archive-2025.zip",
      suggestedRelativePath: "Archives/2025",
      reason: "A ZIP archive with a year in its name, likely a backup.",
      uncertainty: "low",
    },
  },
];

const DEMO_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  zip: "application/zip",
  exe: "application/vnd.microsoft.portable-executable",
};

export const DEMO_FILES: OrganizationFile[] = DEMO_FILES_BASE.map((file) => ({
  ...file,
  mimeType: DEMO_MIME_BY_EXTENSION[file.extension.toLowerCase()] ?? null,
}));

export const DEMO_DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    id: "duplicate-invoice-march",
    sha256:
      "9f2a6c1e4b8d0a7f3c5e9b2d6a1f8c4e7b0d3a9f5c2e8b1d4a7f0c6e3b9d2a5f",
    sizeBytes: 291_420,
    fileIds: ["file-invoice-march", "file-invoice-march-copy"],
  },
  {
    id: "duplicate-photo-2043",
    sha256:
      "3c81f4a9d2e7b0c5a8f1d6e3b9c2a7f4d0e5b8c1a6f9d2e4b7c0a5f8d1e6b3c9",
    sizeBytes: 3_355_443,
    fileIds: ["file-photo-garden", "file-photo-garden-copy"],
  },
];

export const DEMO_SIMILAR_NAME_GROUPS: SimilarNameGroup[] = [
  {
    id: "similar-photo-2043-2044",
    fileIds: ["file-photo-garden", "file-photo-balcony"],
    note: "The names are nearly identical, but the content hashes differ. These are separate photos, not duplicates.",
  },
];

export const DEMO_OPERATIONS: OperationRecord[] = [
  {
    id: "operation-2026-10-19",
    kind: "mixed",
    summary: "Organized 6 files from Downloads",
    folderName: "Downloads",
    appliedAt: "2026-10-19T14:32:00.000Z",
    updatedAt: "2026-10-19T14:32:07.000Z",
    status: "completed",
    itemCount: 6,
    items: [
      {
        from: "invoice_acme_march.pdf",
        to: "Finance/Invoices/2026-03-acme-invoice.pdf",
        status: "completed",
      },
      {
        from: "Q2-budget-final-v3.xlsx",
        to: "Work/Finance/q2-budget-2026.xlsx",
        status: "completed",
      },
    ],
    changedCount: 6,
    failedCount: 0,
    skippedCount: 0,
    attemptedCount: 6,
    interrupted: false,
    note: "Six files were moved or renamed. Destination folders were created.",
    undoable: true,
    undoAttemptedAt: null,
  },
  {
    id: "operation-2026-10-17",
    kind: "move",
    summary: "Photo cleanup stopped after a locked file",
    folderName: "Downloads",
    appliedAt: "2026-10-17T19:04:00.000Z",
    updatedAt: "2026-10-17T19:05:12.000Z",
    status: "partial",
    itemCount: 3,
    items: [
      {
        from: "IMG_2043.JPG",
        to: "Images/2026/2026-05-garden-lunch.JPG",
        status: "completed",
      },
      {
        from: "IMG_2044.JPG",
        to: "Images/2026/2026-05-balcony-view.JPG",
        status: "completed",
      },
      {
        from: "IMG_2045.JPG",
        to: "Images/2026/2026-05-market.JPG",
        status: "failed",
        error: "The file is locked by another application.",
      },
    ],
    changedCount: 3,
    failedCount: 1,
    skippedCount: 0,
    attemptedCount: 4,
    interrupted: false,
    note: "Three files were organized. One file was locked by another application, so the batch stopped.",
    undoable: false,
    undoUnavailableReason:
      "One file was locked during the original batch. Reversing the partial batch could overwrite newer edits, so undo is disabled.",
    undoAttemptedAt: null,
  },
  {
    id: "operation-2026-10-12",
    kind: "rename",
    summary: "Renamed 2 invoice files",
    folderName: "Documents",
    appliedAt: "2026-10-12T10:18:00.000Z",
    updatedAt: "2026-10-13T09:12:00.000Z",
    status: "undone",
    itemCount: 2,
    items: [
      {
        from: "invoice-1182.pdf",
        to: "Finance/Invoices/2025-11-invoice-1182.pdf",
        status: "completed",
      },
      {
        from: "invoice-1183.pdf",
        to: "Finance/Invoices/2025-11-invoice-1183.pdf",
        status: "completed",
      },
    ],
    changedCount: 2,
    failedCount: 0,
    skippedCount: 0,
    attemptedCount: 2,
    interrupted: false,
    note: "This operation was undone on Oct 13, 2026. The original filenames were restored.",
    undoable: false,
    undoUnavailableReason: "This operation has already been undone.",
    undoAttemptedAt: "2026-10-13T09:12:00.000Z",
  },
  {
    id: "operation-2026-10-08",
    kind: "move",
    summary: "Move cancelled: destination already exists",
    folderName: "Downloads",
    appliedAt: "2026-10-08T08:05:00.000Z",
    updatedAt: "2026-10-08T08:05:00.000Z",
    status: "failed",
    itemCount: 0,
    items: [
      {
        from: "resume_final.docx",
        to: "Documents/Career/resume.docx",
        status: "failed",
        error: "A file already exists at this destination.",
      },
    ],
    changedCount: 0,
    failedCount: 1,
    skippedCount: 0,
    attemptedCount: 1,
    interrupted: false,
    note: "Nothing was changed. An existing file at the destination prevented the move.",
    undoable: false,
    undoUnavailableReason: "Nothing was changed, so there is nothing to undo.",
    undoAttemptedAt: null,
  },
];
