import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/config/env";

describe("getServerEnv", () => {
  it("defaults to local Ollama with gemma3:4b", () => {
    expect(getServerEnv({})).toEqual({
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OLLAMA_MODEL: "gemma3:4b",
    });
  });

  it("accepts an explicit local configuration", () => {
    expect(
      getServerEnv({
        OLLAMA_BASE_URL: "http://localhost:11434",
        OLLAMA_MODEL: "gemma3:4b",
      }),
    ).toEqual({
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "gemma3:4b",
    });
  });

  it("rejects an invalid endpoint", () => {
    expect(() =>
      getServerEnv({ OLLAMA_BASE_URL: "not-a-url" }),
    ).toThrowError();
  });
});
