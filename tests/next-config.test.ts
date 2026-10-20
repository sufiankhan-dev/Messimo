import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("browser hardening headers", () => {
  it("refuses framing so a remote page cannot clickjack an approved batch", async () => {
    const groups = (await nextConfig.headers?.()) ?? [];
    const headers = new Map(
      groups.flatMap((group) =>
        group.headers.map((header) => [
          header.key.toLowerCase(),
          header.value.toLowerCase(),
        ]),
      ),
    );

    expect(groups[0]?.source).toBe("/:path*");
    expect(headers.get("x-frame-options")).toBe("deny");
    expect(headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });
});
