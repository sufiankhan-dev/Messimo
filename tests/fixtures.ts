import type { OrganizationFile } from "@/types";

/** Build an organization file for tests, overriding only the fields under test. */
export function makeFile(
  overrides: Partial<OrganizationFile> = {},
): OrganizationFile {
  return {
    id: "file-test",
    name: "report.pdf",
    relativePath: "report.pdf",
    extension: "pdf",
    sizeBytes: 1024,
    modifiedAt: "2026-10-01T10:00:00.000Z",
    kind: "document",
    duplicateGroupId: null,
    supported: true,
    status: "pending",
    warnings: [],
    suggestion: null,
    ...overrides,
  };
}
