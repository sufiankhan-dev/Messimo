import { describe, expect, it } from "vitest";
import { describeOllamaModel } from "@/lib/ai/model-info";

describe("describeOllamaModel", () => {
  it("reports known details for the documented Gemma tag", () => {
    expect(describeOllamaModel("gemma3:4b")).toEqual({
      family: "Gemma 3",
      parameters: "4B",
      quantization: "Q4_K_M",
      approximateSize: "about 3.4 GB",
      summary: "Gemma 3 · 4B parameters · Q4_K_M",
    });
  });

  it("matches a known tag case-insensitively", () => {
    expect(describeOllamaModel("  GEMMA3:4B  ").summary).toBe(
      "Gemma 3 · 4B parameters · Q4_K_M",
    );
  });

  it("does not invent size or parameter details for other tags", () => {
    const info = describeOllamaModel("gemma3:27b");

    expect(info.family).toBe("Gemma 3");
    expect(info.parameters).toBeNull();
    expect(info.quantization).toBeNull();
    expect(info.approximateSize).toBeNull();
    expect(info.summary).toContain("depend on the installed tag");
  });

  it("describes a non-Gemma local model generically", () => {
    const info = describeOllamaModel("llama3.2:3b");

    expect(info.family).toBe("Configured local instruction model");
    expect(info.approximateSize).toBeNull();
  });
});
