import { describe, expect, it } from "vitest";
import {
  aiSuggestionSchema,
  safeFileNameSchema,
  safeRelativePathSchema,
} from "@/lib/validation/organization";

describe("safeFileNameSchema", () => {
  it.each([
    "report.pdf",
    "Q3 invoice - paid.pdf",
    "notes_2026.md",
    "résumé.docx",
  ])("accepts %s", (name) => {
    expect(safeFileNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    "../secret.pdf",
    "folder/report.pdf",
    "C:\\temp\\report.pdf",
    "report|final.pdf",
    "CON",
    "report.",
    "",
    "..",
  ])("rejects %s", (name) => {
    expect(safeFileNameSchema.safeParse(name).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = safeFileNameSchema.safeParse("  report.pdf  ");

    expect(result.success).toBe(true);
    expect(result.data).toBe("report.pdf");
  });
});

describe("safeRelativePathSchema", () => {
  it.each([
    "Documents",
    "Finance/Invoices",
    "Projects\\2026\\Q1",
    "Images/2026",
  ])("accepts %s", (destination) => {
    expect(safeRelativePathSchema.safeParse(destination).success).toBe(true);
  });

  it.each([
    "/etc/passwd",
    "C:\\Windows",
    "..\\outside",
    "Documents/../secret",
    "Documents//Q1",
    "Documents/",
    "Documents/./Q1",
    "",
  ])("rejects %s", (destination) => {
    expect(safeRelativePathSchema.safeParse(destination).success).toBe(false);
  });
});

describe("aiSuggestionSchema", () => {
  const validSuggestion = {
    category: "Finance",
    suggestedFileName: "2026-03-invoice-acme.pdf",
    suggestedRelativePath: "Finance/Invoices",
    reason: "The document is an invoice dated March 2026.",
    uncertainty: "low",
  };

  it("accepts a complete suggestion", () => {
    expect(aiSuggestionSchema.safeParse(validSuggestion).success).toBe(true);
  });

  it("rejects an absolute destination", () => {
    expect(
      aiSuggestionSchema.safeParse({
        ...validSuggestion,
        suggestedRelativePath: "C:\\Users\\someone\\Desktop",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      aiSuggestionSchema.safeParse({
        ...validSuggestion,
        category: "Important",
      }).success,
    ).toBe(false);
  });

  it("rejects a suggestion without a reason", () => {
    expect(
      aiSuggestionSchema.safeParse({
        ...validSuggestion,
        reason: "",
      }).success,
    ).toBe(false);
  });
});
