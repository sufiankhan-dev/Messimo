import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OllamaClient } from "@/lib/ai/ollama-client";
import { describeFile } from "@/lib/files/metadata";
import { planOrganization } from "@/lib/organizer/planner";

/**
 * Opt-in smoke test against the real local model. It is skipped unless the
 * developer explicitly enables it, because it requires Ollama and a pulled
 * model.
 *
 * PowerShell:
 *   $env:SLOTHSORT_OLLAMA_INTEGRATION=1; npx vitest run tests/integration-ollama-planner.test.ts
 */
const runIntegration =
  process.env.SLOTHSORT_OLLAMA_INTEGRATION === "1" ? describe : describe.skip;

const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

runIntegration("real local Gemma planner integration", () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "messimo-gemma-"));
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it(
    "returns a validated suggestion for a synthetic invoice",
    async () => {
      const relativePath = "northwind-invoice-march.txt";
      const absolute = path.join(root, relativePath);
      await fs.writeFile(
        absolute,
        [
          "NORTHWIND SUPPLIES",
          "Invoice 2026-03",
          "Billed to: Acme Studio",
          "Amount due: $420.00",
          "Due date: March 31, 2026",
        ].join("\n"),
      );

      const stats = await fs.stat(absolute);
      const file = describeFile(relativePath, relativePath, stats);
      const plan = await planOrganization({
        rootPath: root,
        files: [file],
        client: new OllamaClient({
          baseUrl: BASE_URL,
          model: MODEL,
          timeoutMs: 120_000,
        }),
        model: MODEL,
        requestTimeoutMs: 120_000,
        maxAttempts: 2,
      });

      expect(plan.entries).toHaveLength(1);
      expect(plan.entries[0].suggestion).not.toBeNull();
      expect(plan.entries[0].extraction.status).toBe("extracted");
      expect(plan.entries[0].file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(plan.entries[0].suggestion?.category).toBeTruthy();
      expect(plan.entries[0].outcome).toMatch(/ready|needs-review/);

      const before = await fs.readFile(absolute, "utf8");
      expect(before).toContain("NORTHWIND SUPPLIES");
    },
    180_000,
  );
});
