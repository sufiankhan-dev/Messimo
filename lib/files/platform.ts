import type { Platform } from "@/types";

export function platformLabel(): Platform {
  switch (process.platform) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    default:
      return "Linux";
  }
}
