import { describe, expect, it, vi } from "vitest";
import {
  buildUnreachableOllamaStatus,
  checkOllamaConnection,
  evaluateOllamaStatus,
  isModelInstalled,
  ollamaStatusSchema,
} from "@/lib/ai/ollama";

const BASE_URL = "http://127.0.0.1:11434";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(
  handler: (url: string) => Response | Promise<Response>,
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) =>
    handler(String(input)),
  ) as unknown as typeof fetch;
}

/** Stub the two local endpoints the health check may read. */
function stubOllamaRuntime({
  models,
  version = "0.40.4",
  versionStatus = 200,
}: {
  models: unknown;
  version?: unknown;
  versionStatus?: number;
}): typeof fetch {
  return stubFetch((url) => {
    if (url.endsWith("/api/tags")) return jsonResponse(models);
    if (url.endsWith("/api/version")) {
      return jsonResponse(
        typeof version === "string" ? { version } : version,
        versionStatus,
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("isModelInstalled", () => {
  it("matches an exact installed model name", () => {
    expect(isModelInstalled("gemma3:4b", ["llama3:8b", "gemma3:4b"])).toBe(true);
  });

  it("matches :latest when the selection has no tag", () => {
    expect(isModelInstalled("gemma3", ["gemma3:latest"])).toBe(true);
  });

  it("does not match a different tag", () => {
    expect(isModelInstalled("gemma3:4b", ["gemma3:12b"])).toBe(false);
  });

  it("compares names case-insensitively and ignores whitespace", () => {
    expect(isModelInstalled("  Gemma3:4B ", ["gemma3:4b"])).toBe(true);
  });

  it("returns false for an empty selection or no installed models", () => {
    expect(isModelInstalled("", ["gemma3:4b"])).toBe(false);
    expect(isModelInstalled("gemma3:4b", [])).toBe(false);
  });
});

describe("evaluateOllamaStatus", () => {
  it("reports a connected state when the model is installed", () => {
    const status = evaluateOllamaStatus({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      installedModels: ["gemma3:4b", "llama3:8b"],
      checkedAt: "2026-10-20T08:00:00.000Z",
    });

    expect(status.state).toBe("connected");
    expect(status.connected).toBe(true);
    expect(status.modelAvailable).toBe(true);
    expect(status.checkedAt).toBe("2026-10-20T08:00:00.000Z");
    expect(status.message).toContain("gemma3:4b");
    expect(ollamaStatusSchema.safeParse(status).success).toBe(true);
  });

  it("stays connected but flags a missing model", () => {
    const status = evaluateOllamaStatus({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      installedModels: ["llama3:8b"],
    });

    expect(status.state).toBe("model-missing");
    expect(status.connected).toBe(true);
    expect(status.modelAvailable).toBe(false);
    expect(status.message).toContain("not installed");
    expect(ollamaStatusSchema.safeParse(status).success).toBe(true);
  });
});

describe("buildUnreachableOllamaStatus", () => {
  it("describes an unreachable runtime without inventing models", () => {
    const status = buildUnreachableOllamaStatus({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      message: "No response.",
      checkedAt: "2026-10-20T08:00:00.000Z",
    });

    expect(status).toEqual({
      state: "unreachable",
      connected: false,
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      runtimeVersion: null,
      installedModels: [],
      modelAvailable: false,
      checkedAt: "2026-10-20T08:00:00.000Z",
      message: "No response.",
    });
    expect(ollamaStatusSchema.safeParse(status).success).toBe(true);
  });
});

describe("checkOllamaConnection", () => {
  it("reads the installed model list and runtime version from local endpoints", async () => {
    const fetchImpl = stubOllamaRuntime({
      models: { models: [{ name: "gemma3:4b" }, { name: "llama3:8b" }] },
    });

    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl,
    });

    expect(status.state).toBe("connected");
    expect(status.installedModels).toEqual(["gemma3:4b", "llama3:8b"]);
    expect(status.runtimeVersion).toBe("0.40.4");
    expect(ollamaStatusSchema.safeParse(status).success).toBe(true);
  });

  it("accepts a model entry that only exposes the model field", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubOllamaRuntime({
        models: { models: [{ model: "gemma3:4b" }] },
      }),
    });

    expect(status.modelAvailable).toBe(true);
    expect(status.installedModels).toEqual(["gemma3:4b"]);
  });

  it("still reports a connection when the version endpoint is unavailable", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubOllamaRuntime({
        models: { models: [{ name: "gemma3:4b" }] },
        versionStatus: 404,
      }),
    });

    expect(status.state).toBe("connected");
    expect(status.runtimeVersion).toBeNull();
  });

  it("normalizes a trailing slash on the base URL", async () => {
    const fetchImpl = stubOllamaRuntime({
      models: { models: [{ name: "gemma3:4b" }] },
    });

    const status = await checkOllamaConnection({
      baseUrl: `${BASE_URL}/`,
      selectedModel: "gemma3:4b",
      fetchImpl,
    });

    expect(status.runtimeVersion).toBe("0.40.4");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a missing model while remaining connected", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubOllamaRuntime({
        models: { models: [{ name: "llama3:8b" }] },
      }),
    });

    expect(status.state).toBe("model-missing");
    expect(status.connected).toBe(true);
    expect(status.modelAvailable).toBe(false);
  });

  it("treats an error response as unreachable", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubFetch(() => jsonResponse({ error: "nope" }, 503)),
    });

    expect(status.state).toBe("unreachable");
    expect(status.connected).toBe(false);
    expect(status.message).toContain("503");
  });

  it("rejects an unexpected response shape", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubFetch(() => jsonResponse({ models: "gemma3:4b" })),
    });

    expect(status.state).toBe("unreachable");
    expect(status.message).toContain("unexpected response");
  });

  it("reports a connection failure with the local endpoint", async () => {
    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      fetchImpl: stubFetch(() => {
        throw new Error("connect ECONNREFUSED");
      }),
    });

    expect(status.state).toBe("unreachable");
    expect(status.installedModels).toEqual([]);
    expect(status.message).toContain(BASE_URL);
  });

  it("times out instead of hanging the interface", async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("The operation was aborted."));
          });
        }),
    ) as unknown as typeof fetch;

    const status = await checkOllamaConnection({
      baseUrl: BASE_URL,
      selectedModel: "gemma3:4b",
      timeoutMs: 10,
      fetchImpl,
    });

    expect(status.state).toBe("unreachable");
    expect(status.connected).toBe(false);
    expect(status.message).toContain("did not respond within");
  });
});
