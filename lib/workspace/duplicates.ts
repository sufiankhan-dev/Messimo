import type {
  DuplicateGroup,
  DuplicateGroupView,
  OrganizationFile,
  SimilarNameGroup,
} from "@/types";

/** Join duplicate hashes with the scanned files they refer to. */
export function buildDuplicateGroups(
  files: OrganizationFile[],
  groups: DuplicateGroup[],
): DuplicateGroupView[] {
  const filesById = new Map(files.map((file) => [file.id, file]));

  return groups
    .map((group) => {
      const groupFiles = group.fileIds
        .map((id) => filesById.get(id))
        .filter((file): file is OrganizationFile => file !== undefined);
      const sizeBytes = groupFiles[0]?.sizeBytes ?? 0;

      return {
        id: group.id,
        sha256: group.sha256,
        sizeBytes,
        files: groupFiles,
        recoverableBytes: sizeBytes * Math.max(groupFiles.length - 1, 0),
      };
    })
    .filter((group) => group.files.length > 1);
}

export function getDuplicateFileCount(groups: DuplicateGroup[]): number {
  return new Set(groups.flatMap((group) => group.fileIds)).size;
}

export function getRecoverableBytes(groups: DuplicateGroupView[]): number {
  return groups.reduce((total, group) => total + group.recoverableBytes, 0);
}

export function buildSimilarNameGroups(
  files: OrganizationFile[],
  groups: SimilarNameGroup[],
) {
  const filesById = new Map(files.map((file) => [file.id, file]));

  return groups
    .map((group) => ({
      ...group,
      files: group.fileIds
        .map((id) => filesById.get(id))
        .filter((file): file is OrganizationFile => file !== undefined),
    }))
    .filter((group) => group.files.length > 1);
}
