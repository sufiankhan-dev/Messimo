import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The DOCX extraction test loads Mammoth and parses a zip archive. Under a
    // full parallel run that can take longer than Vitest's 5s default on slower
    // machines, even though the extraction itself is bounded to 8s.
    testTimeout: 20_000,
  },
});
