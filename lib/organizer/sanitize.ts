import {
  safeFileNameSchema,
  stripUnsafeNameFormatting,
} from "@/lib/validation/organization";

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_NAME_CHARACTERS = /[<>:"|?*]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const TRAILING_DOTS_OR_SPACES = /[. ]+$/;
const EXTENSION_LIKE = /^[a-z0-9]{1,12}$/i;
const MAX_BASE_LENGTH = 120;

export type SanitizedFileName =
  | { ok: true; value: string; adjusted: boolean }
  | { ok: false; reason: string };

function splitExtension(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return { base: name, extension: "" };
  }

  const candidate = name.slice(dot + 1);
  if (!EXTENSION_LIKE.test(candidate)) {
    return { base: name, extension: "" };
  }

  return { base: name.slice(0, dot), extension: candidate };
}

/**
 * Turn a model-proposed filename into a safe single path segment while
 * preserving the original file extension.
 *
 * Anything that looks like an attempt to address a folder or another path is
 * rejected outright rather than silently rewritten. Benign invalid characters
 * are replaced so a useful suggestion is not lost.
 */
export function sanitizeSuggestedFileName(
  rawName: string,
  originalName: string,
  originalExtension: string,
): SanitizedFileName {
  const normalized = stripUnsafeNameFormatting(rawName.normalize("NFC").trim());
  let candidate = normalized;
  let adjusted = normalized !== rawName.normalize("NFC").trim();

  if (!candidate) {
    return { ok: false, reason: "The model returned an empty filename." };
  }
  if (candidate.includes("\0")) {
    return {
      ok: false,
      reason: "The proposed filename contains an invalid character.",
    };
  }
  if (candidate.includes("/") || candidate.includes("\\")) {
    return {
      ok: false,
      reason:
        "The proposed filename contains a path separator. SlothSort accepts only a single file name.",
    };
  }
  if (/^[a-zA-Z]:/.test(candidate)) {
    return {
      ok: false,
      reason: "The proposed filename looks like an absolute path.",
    };
  }

  const cleaned = candidate
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVALID_NAME_CHARACTERS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_DOTS_OR_SPACES, "");

  if (cleaned !== candidate) adjusted = true;
  candidate = cleaned;

  if (!candidate || candidate === "." || candidate === "..") {
    return {
      ok: false,
      reason: "The proposed filename is not a usable file name.",
    };
  }

  const original = splitExtension(originalName);
  const expectedExtension = originalExtension.trim().replace(/^\./, "");
  const proposed = splitExtension(candidate);

  if (expectedExtension) {
    if (proposed.extension) {
      if (proposed.extension.toLowerCase() !== expectedExtension.toLowerCase()) {
        return {
          ok: false,
          reason: `The model proposed a different file extension. Only the original .${expectedExtension} extension is accepted.`,
        };
      }
      candidate = `${proposed.base}.${expectedExtension}`;
    } else {
      candidate = `${candidate}.${expectedExtension}`;
      adjusted = true;
    }
  } else if (original.extension && !proposed.extension) {
    // A file that originally had an extension should keep one.
    candidate = `${candidate}.${original.extension}`;
    adjusted = true;
  }

  let { base } = splitExtension(candidate);
  if (base.length > MAX_BASE_LENGTH) {
    base = base.slice(0, MAX_BASE_LENGTH).replace(TRAILING_DOTS_OR_SPACES, "");
    adjusted = true;
  }

  if (!base) {
    return {
      ok: false,
      reason: "The proposed filename is not a usable file name.",
    };
  }

  const extension = splitExtension(candidate).extension;
  candidate = extension ? `${base}.${extension}` : base;

  if (WINDOWS_RESERVED_NAME.test(candidate)) {
    candidate = `file-${candidate}`;
    adjusted = true;
  }

  const parsed = safeFileNameSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "The proposed filename is not safe on this system.",
    };
  }

  return { ok: true, value: parsed.data, adjusted };
}
