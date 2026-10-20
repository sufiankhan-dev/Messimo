import type { FileKind } from "@/types";

/**
 * Best-effort MIME detection from the file extension only. SlothSort does not
 * open file contents during a scan, so an unknown extension reports null rather
 * than guessing.
 */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  // Documents and text
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  tex: "application/x-tex",
  epub: "application/epub+zip",
  pages: "application/vnd.apple.pages",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  numbers: "application/vnd.apple.numbers",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  key: "application/vnd.apple.keynote",

  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  ico: "image/x-icon",
  psd: "image/vnd.adobe.photoshop",

  // Archives and packages
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  zst: "application/zstd",
  iso: "application/x-iso9660-image",
  dmg: "application/x-apple-diskimage",
  pkg: "application/x-newton-compatible-pkg",
  deb: "application/vnd.debian.binary-package",
  rpm: "application/x-rpm",
  apk: "application/vnd.android.package-archive",

  // Audio and video
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
  avi: "video/x-msvideo",

  // Code and configuration
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  jsx: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  py: "text/x-python",
  java: "text/x-java-source",
  go: "text/x-go",
  rs: "text/x-rust",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++",
  hpp: "text/x-c++",
  sh: "application/x-sh",
  ps1: "text/x-powershell",
  bat: "text/x-msdos-batch",
  cmd: "text/x-msdos-batch",
  yml: "application/yaml",
  yaml: "application/yaml",
  toml: "application/toml",
  xml: "application/xml",
  sql: "application/sql",
  log: "text/plain",

  // Executables and binary formats (listed, never organized automatically)
  exe: "application/vnd.microsoft.portable-executable",
  dll: "application/vnd.microsoft.portable-executable",
  msi: "application/x-msi",
  app: "application/x-macos-application",
  jar: "application/java-archive",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "md",
  "markdown",
  "tex",
  "epub",
  "pages",
  "xls",
  "xlsx",
  "ods",
  "csv",
  "numbers",
  "ppt",
  "pptx",
  "odp",
  "key",
]);

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "avif",
  "ico",
  "psd",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "bz2",
  "xz",
  "zst",
  "iso",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "apk",
]);

export function detectMimeType(extension: string): string | null {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");
  if (!normalized) return null;
  return MIME_BY_EXTENSION[normalized] ?? null;
}

export function kindForFile(extension: string, mimeType: string | null): FileKind {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");

  if (IMAGE_EXTENSIONS.has(normalized) || mimeType?.startsWith("image/")) {
    return "image";
  }
  if (ARCHIVE_EXTENSIONS.has(normalized)) {
    return "archive";
  }
  if (
    DOCUMENT_EXTENSIONS.has(normalized) ||
    mimeType === "application/pdf" ||
    mimeType?.startsWith("text/") ||
    mimeType?.includes("wordprocessingml") ||
    mimeType?.includes("spreadsheetml") ||
    mimeType?.includes("presentationml")
  ) {
    return "document";
  }
  return "other";
}

export function isUnsupportedKind(kind: FileKind): boolean {
  return kind === "other";
}
