const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Format a byte count with binary units, e.g. 3_355_443 -> "3.2 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unitIndex]}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  // Fixed time zone keeps server and client output identical.
  timeZone: "UTC",
});

/** Format an ISO timestamp as a stable, readable date: "Oct 19, 2026". */
export function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Format an ISO timestamp with time, e.g. "Oct 19, 2026, 2:32 PM". */
export function formatDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Shorten a SHA-256 digest for display without implying it is complete. */
export function formatShortHash(sha256: string): string {
  if (sha256.length <= 20) return sha256;
  return `${sha256.slice(0, 12)}…${sha256.slice(-6)}`;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** Join an approved relative folder with a filename for display. */
export function formatDestination(
  relativeFolder: string,
  fileName: string,
): string {
  const folder = relativeFolder.replace(/[\\/]+$/, "");
  return folder ? `${folder}/${fileName}` : fileName;
}
