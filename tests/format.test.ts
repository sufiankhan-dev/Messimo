import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCount,
  formatDate,
  formatDestination,
  formatShortHash,
  pluralize,
} from "@/lib/format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [291_420, "285 KB"],
    [3_355_443, "3.2 MB"],
    [67_108_864, "64 MB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("rejects invalid input without throwing", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp in a stable UTC form", () => {
    expect(formatDate("2026-10-19T16:05:00.000Z")).toBe("Oct 19, 2026");
  });

  it("returns a placeholder for an invalid timestamp", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatDestination", () => {
  it("joins a folder and a filename", () => {
    expect(
      formatDestination("Finance/Invoices", "2026-03-acme-invoice.pdf"),
    ).toBe("Finance/Invoices/2026-03-acme-invoice.pdf");
  });

  it("ignores trailing separators and empty folders", () => {
    expect(formatDestination("Work/", "notes.txt")).toBe("Work/notes.txt");
    expect(formatDestination("", "notes.txt")).toBe("notes.txt");
  });
});

describe("formatShortHash", () => {
  it("keeps short values intact", () => {
    expect(formatShortHash("abc123")).toBe("abc123");
  });

  it("shortens long digests", () => {
    const digest = "9f2a6c1e4b8d0a7f3c5e9b2d6a1f8c4e7b0d3a9f5c2e8b1d4a7f0c6e3b9d2a5f";
    expect(formatShortHash(digest)).toBe("9f2a6c1e4b8d…9d2a5f");
  });
});

describe("formatCount and pluralize", () => {
  it("formats numbers with grouping", () => {
    expect(formatCount(1234)).toBe("1,234");
  });

  it("pluralizes from the count", () => {
    expect(pluralize(1, "file")).toBe("1 file");
    expect(pluralize(4, "file")).toBe("4 files");
    expect(pluralize(2, "duplicate", "duplicates")).toBe("2 duplicates");
  });
});
