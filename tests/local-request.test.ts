import { describe, expect, it } from "vitest";
import {
  ApiInputError,
  checkLocalRequestHeaders,
  isLoopbackHostname,
  readJsonBody,
} from "@/lib/server/local-request";

describe("isLoopbackHostname", () => {
  it.each(["localhost", "127.0.0.1", "127.1.2.3", "::1", "[::1]"])(
    "accepts %s",
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each([
    "192.168.1.20",
    "10.0.0.5",
    "evil.com",
    "localhost.evil.com",
    "0.0.0.0",
  ])("rejects %s", (hostname) => {
    expect(isLoopbackHostname(hostname)).toBe(false);
  });
});

describe("checkLocalRequestHeaders", () => {
  it("accepts a same-origin localhost request", () => {
    expect(
      checkLocalRequestHeaders({
        host: "localhost:3000",
        origin: "http://localhost:3000",
        secFetchSite: "same-origin",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a request without an origin header from the local app", () => {
    expect(
      checkLocalRequestHeaders({
        host: "127.0.0.1:3000",
        origin: null,
        secFetchSite: null,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a non-loopback host", () => {
    expect(
      checkLocalRequestHeaders({
        host: "192.168.1.20:3000",
        origin: null,
        secFetchSite: null,
      }),
    ).toMatchObject({ ok: false, code: "forbidden_local_only" });
  });

  it("rejects a cross-site origin", () => {
    expect(
      checkLocalRequestHeaders({
        host: "localhost:3000",
        origin: "https://evil.example",
        secFetchSite: "cross-site",
      }),
    ).toMatchObject({ ok: false, code: "forbidden_origin" });
  });

  it("rejects a cross-site fetch even without an origin header", () => {
    expect(
      checkLocalRequestHeaders({
        host: "localhost:3000",
        origin: null,
        secFetchSite: "cross-site",
      }),
    ).toMatchObject({ ok: false, code: "forbidden_origin" });
  });
});

describe("readJsonBody", () => {
  it("parses a small JSON body", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/tmp/example" }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      path: "/tmp/example",
    });
  });

  it("rejects a non-JSON content type", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "invalid_content_type",
      status: 415,
    });
  });

  it("rejects an oversized body", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "a".repeat(200) }),
    });

    await expect(readJsonBody(request, 20)).rejects.toMatchObject({
      code: "request_too_large",
      status: 413,
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    await expect(readJsonBody(request)).rejects.toBeInstanceOf(ApiInputError);
  });

  it("rejects a non-JSON media type that merely starts with application/json", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/jsonp" },
      body: "{}",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "invalid_content_type",
      status: 415,
    });
  });

  it("accepts a JSON media type with a charset parameter", async () => {
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ path: "/tmp/example" }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      path: "/tmp/example",
    });
  });

  it("stops reading a chunked body as soon as the limit is exceeded", async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 50) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(16).fill(97));
      },
      cancel() {
        cancelled = true;
      },
    });

    // A streamed body has no Content-Length, so the limit can only be enforced
    // while reading. The reader must not drain the whole body first.
    const request = new Request("http://localhost/api/folders/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);

    await expect(readJsonBody(request, 32)).rejects.toMatchObject({
      code: "request_too_large",
      status: 413,
    });

    expect(pulled).toBeLessThan(10);
    expect(cancelled).toBe(true);
  });
});
