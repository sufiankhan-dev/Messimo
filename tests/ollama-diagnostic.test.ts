import { describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTIC_SAMPLE,
  runOllamaDiagnostic,
} from "@/lib/ai/diagnostic";
import { OllamaClientError } from "@/lib/ai/ollama-client";
import { ollamaDiagnosticResultSchema } from "@/lib/validation/ollama";

const BASE_URL = "http://127.0.0.1:11434";

const VALID_SUGGESTION = {
  category: "Finance",
  suggestedFileName: "northwind-invoice-2026-03.pdf",
  suggestedRelativePath: "Finance/Invoices",
  reason: "The filename points to a March 2026 invoice.",
  uncertainty: "low",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chatEnvelope(content: unknown): Response {
  return jsonResponse({
    model: "gemma3:4b",
    created_at: "2026-10-20T08:00:00.000Z",
    message: {
      role: "assistant",
      content:
        typeof content === "string" ? content : JSON.stringify(content),
    },
    done: true,
    done_reason: "stop",
  });
}

interface FetchFixture {
  models?: unknown;
  version?: unknown;
  chat?: (init?: RequestInit) => Response | Promise<Response>;
}

function runtimeFetch(fixture: FetchFixture = {}): typeof fetch {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/tags")) {
        return jsonResponse(
          fixture.models ?? { models: [{ name: "gemma3:4b" }] },
        );
      }
      if (url.endsWith("/api/version")) {
        return jsonResponse({ version: fixture.version ?? "0.40.4" });
      }
      if (url.endsWith("/api/chat")) {
        if (!fixture.chat) throw new Error("No chat stub configured");
        return fixture.chat(init);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  ) as unknown as typeof fetch;
}

function expectOllamaError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  return promise.then(
    () => {
      throw new Error(`Expected an OllamaClientError with code ${code}`);
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(OllamaClientError);
      expect((error as OllamaClientError).code).toBe(code);
    },
  );
}

describe("runOllamaDiagnostic", () => {
  it("returns a schema-validated suggestion from a local completion", async () => {
    let chatInit: RequestInit | undefined;
    const fetchImpl = runtimeFetch({
      chat: (init) => {
        chatInit = init;
        return chatEnvelope(VALID_SUGGESTION);
      },
    });

    const result = await runOllamaDiagnostic({
      baseUrl: BASE_URL,
      model: "gemma3:4b",
      fetchImpl,
    });

    expect(result.suggestion).toEqual(VALID_SUGGESTION);
    expect(result.extensionNormalized).toBe(false);
    expect(result.sample).toEqual(DIAGNOSTIC_SAMPLE);
    expect(result.model).toBe("gemma3:4b");
    expect(result.runtimeVersion).toBe("0.40.4");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(ollamaDiagnosticResultSchema.safeParse(result).success).toBe(true);

    const body = JSON.parse(String(chatInit?.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
      format: Record<string, unknown>;
    };

    expect(chatInit?.method).toBe("POST");
    expect(body.model).toBe("gemma3:4b");
    expect(body.stream).toBe(false);
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]?.role).toBe("user");
    expect(body.messages[1]?.content).toContain(DIAGNOSTIC_SAMPLE.fileName);
    expect(body.messages[1]?.content).toContain("synthetic diagnostic sample");
    expect(body.format).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(body.format).not.toHaveProperty("$schema");
    expect(body.format.required).toEqual(
      expect.arrayContaining([
        "category",
        "suggestedFileName",
        "suggestedRelativePath",
        "reason",
        "uncertainty",
      ]),
    );
  });

  it("restores the original extension when the model omits it", async () => {
    const fetchImpl = runtimeFetch({
      chat: () =>
        chatEnvelope({
          ...VALID_SUGGESTION,
          suggestedFileName: "northwind-invoice-2026-03",
        }),
    });

    const result = await runOllamaDiagnostic({
      baseUrl: BASE_URL,
      model: "gemma3:4b",
      fetchImpl,
    });

    expect(result.suggestion.suggestedFileName).toBe(
      "northwind-invoice-2026-03.pdf",
    );
    expect(result.extensionNormalized).toBe(true);
    expect(ollamaDiagnosticResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects a reply that changes the file extension", async () => {
    const fetchImpl = runtimeFetch({
      chat: () =>
        chatEnvelope({
          ...VALID_SUGGESTION,
          suggestedFileName: "northwind-invoice.docx",
        }),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "invalid_response",
    );
  });

  it("rejects model content that is not JSON", async () => {
    const fetchImpl = runtimeFetch({
      chat: () => chatEnvelope("Here is the file category: Finance."),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "malformed_json",
    );
  });

  it.each([
    ["an unknown category", { ...VALID_SUGGESTION, category: "Invoices" }],
    [
      "a filename with a path separator",
      { ...VALID_SUGGESTION, suggestedFileName: "Finance/invoice.pdf" },
    ],
    [
      "an absolute destination",
      { ...VALID_SUGGESTION, suggestedRelativePath: "C:\\Finance" },
    ],
    ["a missing reason", { ...VALID_SUGGESTION, reason: "" }],
    ["an unknown uncertainty", { ...VALID_SUGGESTION, uncertainty: "sure" }],
    ["an undeclared field only", { confidence: 0.9 }],
  ])("rejects a reply with %s", async (_label, content) => {
    const fetchImpl = runtimeFetch({
      chat: () => chatEnvelope(content),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "invalid_response",
    );
  });

  it("reports an unavailable Ollama without attempting a prompt", async () => {
    const chat = vi.fn(() => chatEnvelope(VALID_SUGGESTION));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/tags")) throw new Error("connect ECONNREFUSED");
      return chat();
    }) as unknown as typeof fetch;

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "unavailable",
    );

    expect(chat).not.toHaveBeenCalled();
  });

  it("stops with a model-missing error before sending a prompt", async () => {
    const chat = vi.fn(() => chatEnvelope(VALID_SUGGESTION));
    const fetchImpl = runtimeFetch({
      models: { models: [{ name: "llama3:8b" }] },
      chat,
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "model_missing",
    );

    expect(chat).not.toHaveBeenCalled();
  });

  it("maps an Ollama model-not-found response to model_missing", async () => {
    const fetchImpl = runtimeFetch({
      chat: () =>
        jsonResponse(
          { error: "model 'gemma3:4b' not found, try pulling it first" },
          404,
        ),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "model_missing",
    );
  });

  it("rejects an HTTP response that is not JSON", async () => {
    const fetchImpl = runtimeFetch({
      chat: () =>
        new Response("<html>proxy error</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "malformed_json",
    );
  });

  it("rejects an unexpected chat envelope", async () => {
    const fetchImpl = runtimeFetch({
      chat: () => jsonResponse({ message: "nope" }),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        fetchImpl,
      }),
      "invalid_response",
    );
  });

  it("times out instead of hanging the request", async () => {
    const fetchImpl = runtimeFetch({
      chat: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("The operation was aborted."));
          });
        }),
    });

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: BASE_URL,
        model: "gemma3:4b",
        timeoutMs: 20,
        fetchImpl,
      }),
      "timeout",
    );
  });

  it("refuses a non-loopback endpoint before making any request", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expectOllamaError(
      runOllamaDiagnostic({
        baseUrl: "https://api.example.com",
        model: "gemma3:4b",
        fetchImpl,
      }),
      "unsafe_endpoint",
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
