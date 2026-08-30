import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { adminSlice } from "@/lib/features/admin/frontend";
import type { OnboardingFilter } from "@/lib/features/admin/roster-filter";
import { createTestAccountResult, renderWithProviders } from "@/tests/helpers";
import ExportDJsButton, {
  escapeCSVField,
  buildCSVContent,
} from "@/src/components/experiences/modern/admin/roster/ExportCSV";

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

describe("ExportDJsButton", () => {
  const accounts = [
    createTestAccountResult({
      realName: "Juana Molina",
      userName: "jmolina",
      djName: "DJ Sonamos",
      email: "juana@wxyc.org",
    }),
  ];

  const WHOLE_ROSTER_NAME = /^wxyc-roster-\d{4}-\d{2}-\d{2}\.csv$/;
  const NARROWED_NAME = /^wxyc-roster-filtered-\d{4}-\d{2}-\d{2}\.csv$/;

  const objectURLs = {
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };

  let downloadNames: string[] = [];

  // The filename is the export's only signal about what it contains, and it
  // reaches the user through an anchor jsdom never navigates. Read it off the
  // click instead, and suppress the unimplemented default action.
  const captureDownload = (event: MouseEvent) => {
    const anchor = event.target;
    if (anchor instanceof HTMLAnchorElement && anchor.hasAttribute("download")) {
      downloadNames.push(anchor.getAttribute("download") ?? "");
      event.preventDefault();
    }
  };

  beforeEach(() => {
    downloadNames = [];
    // jsdom ships no object-URL implementation; the export mints one per click.
    URL.createObjectURL = vi.fn(() => "blob:roster");
    URL.revokeObjectURL = vi.fn();
    document.addEventListener("click", captureDownload);
  });

  afterEach(() => {
    document.removeEventListener("click", captureDownload);
    URL.createObjectURL = objectURLs.create;
    URL.revokeObjectURL = objectURLs.revoke;
  });

  const exportRoster = async () => {
    const { user, store } = renderWithProviders(
      <ExportDJsButton accounts={accounts} loading={false} disabled={false} />
    );
    return {
      store,
      click: () => user.click(screen.getByRole("button", { name: "Export Roster as CSV" })),
    };
  };

  it("names the file for the whole roster when nothing is narrowed", async () => {
    const { click } = await exportRoster();
    await click();

    expect(downloadNames).toHaveLength(1);
    expect(downloadNames[0]).toMatch(WHOLE_ROSTER_NAME);
  });

  // The button is handed the accounts passing every filter, so an onboarding
  // filter narrows the file without touching search or role. A partial export
  // named for the whole roster reads to its recipient as the whole station.
  it.each<OnboardingFilter>(["incomplete", "complete"])(
    "marks the file as filtered when only onboarding is narrowed to %s",
    async (onboarding) => {
      const { store, click } = await exportRoster();
      store.dispatch(adminSlice.actions.setOnboardingFilter(onboarding));
      await click();

      expect(adminSlice.selectors.getSearchString(store.getState())).toBe("");
      expect(adminSlice.selectors.getRoleFilter(store.getState())).toEqual([]);
      expect(downloadNames).toHaveLength(1);
      expect(downloadNames[0]).toMatch(NARROWED_NAME);
    }
  );

  it("marks the file as filtered when a search narrows it", async () => {
    const { store, click } = await exportRoster();
    store.dispatch(adminSlice.actions.setSearchString("juana"));
    await click();

    expect(downloadNames[0]).toMatch(NARROWED_NAME);
  });

  it("marks the file as filtered when a role narrows it", async () => {
    const { store, click } = await exportRoster();
    store.dispatch(adminSlice.actions.setRoleFilter([Authorization.SM]));
    await click();

    expect(downloadNames[0]).toMatch(NARROWED_NAME);
  });
});
