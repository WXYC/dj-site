import { describe, it, expect } from "vitest";
import { Authorization } from "@/lib/features/admin/types";
import { createTestAccountResult } from "@/lib/test-utils";
import { escapeCSVField, buildCSVContent } from "../ExportCSV";

describe("CSV export (Bug 13)", () => {
  describe("escapeCSVField", () => {
    it("should wrap fields containing commas in double quotes", () => {
      expect(escapeCSVField("Last, First")).toBe('"Last, First"');
    });

    it("should wrap fields containing double quotes and escape them", () => {
      expect(escapeCSVField('He said "hello"')).toBe('"He said ""hello"""');
    });

    it("should wrap fields containing newlines in double quotes", () => {
      expect(escapeCSVField("line1\nline2")).toBe('"line1\nline2"');
    });

    it("should neutralize formula injection with = prefix", () => {
      const result = escapeCSVField('=CMD("calc")');
      expect(result).not.toMatch(/^=/);
    });

    it("should neutralize formula injection with + prefix", () => {
      const result = escapeCSVField("+1234");
      expect(result).not.toMatch(/^\+/);
    });

    it("should neutralize formula injection with - prefix", () => {
      const result = escapeCSVField("-1234");
      expect(result).not.toMatch(/^-/);
    });

    it("should neutralize formula injection with @ prefix", () => {
      const result = escapeCSVField("@SUM(A1)");
      expect(result).not.toMatch(/^@/);
    });

    it("should leave normal strings unchanged", () => {
      expect(escapeCSVField("John Doe")).toBe("John Doe");
    });

    it("should handle empty strings", () => {
      expect(escapeCSVField("")).toBe("");
    });
  });

  describe("buildCSVContent", () => {
    it("should produce valid CSV with header row", () => {
      const csv = buildCSVContent([]);
      expect(csv).toContain("Name,Username,DJ Name,Email,Admin\n");
    });

    it("should include account data in rows", () => {
      const account = createTestAccountResult({
        realName: "Jane Doe",
        userName: "jdoe",
        djName: "Jazzy Jane",
        email: "jane@wxyc.org",
        authorization: Authorization.DJ,
      });

      const csv = buildCSVContent([account]);
      const lines = csv.split("\n");
      expect(lines[1]).toContain("Jane Doe");
      expect(lines[1]).toContain("jdoe");
      expect(lines[1]).toContain("Jazzy Jane");
      expect(lines[1]).toContain("jane@wxyc.org");
      expect(lines[1]).toContain("false");
    });

    it("should mark station managers as admin=true", () => {
      const account = createTestAccountResult({
        authorization: Authorization.SM,
      });

      const csv = buildCSVContent([account]);
      expect(csv).toContain("true");
    });

    it("should properly escape fields with commas", () => {
      const account = createTestAccountResult({
        realName: "Doe, Jane",
      });

      const csv = buildCSVContent([account]);
      expect(csv).toContain('"Doe, Jane"');
    });

    it("should neutralize formula injection in any field", () => {
      const account = createTestAccountResult({
        realName: '=CMD("calc")',
        djName: "+EVIL()",
        email: "@SUM(A1:A10)",
      });

      const csv = buildCSVContent([account]);
      expect(csv).not.toMatch(/,=CMD/);
      expect(csv).not.toMatch(/,\+EVIL/);
      expect(csv).not.toMatch(/,@SUM/);
    });
  });
});
