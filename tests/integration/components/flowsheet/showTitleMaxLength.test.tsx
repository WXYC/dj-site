import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import StartShow from "@/src/components/experiences/classic/flowsheet/StartShow";
import ClassicSpecialtyQuestion from "@/src/components/experiences/classic/flowsheet/SpecialtyQuestion";
import ModernSpecialtyQuestion from "@/src/components/experiences/modern/flowsheet/SpecialtyQuestion";
import EditShowDetailsDialog from "@/src/components/experiences/modern/EditShowDetailsDialog";
import { SHOW_TITLE_MAX_LENGTH, specialtyCopy } from "@/lib/features/specialty/copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ goLive: vi.fn(), live: true, currentShow: 7 }),
  useOpenShowHandoff: () => () => null,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ info: { id: "test-user-1", real_name: "Test User", dj_name: "Anonymous" }, loading: false }),
  useLogout: () => ({ handleLogout: vi.fn(), loggingOut: false }),
}));

vi.mock("@/src/hooks/specialtyHooks", () => ({
  useOneTapPrograms: () => [],
  useWarmCurrentShow: () => vi.fn(),
}));

vi.mock("@/src/utils/helpScreen", () => ({ OpenHelp: vi.fn() }));

// Both set-tagging questions show their title box only once a program is
// confirmed, so they read a confirmed program instead of walking the flow.
vi.mock("@/src/hooks/specialtyQuestionHooks", () => ({
  useSpecialtyQuestion: () => ({
    showId: 7,
    showName: null,
    newestEntryId: 100,
    matches: [],
    decline: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/specialtyTaggingHooks", async () => {
  const { SEED_CATALOG } = await import("@/tests/fixtures/specialty");
  return {
    useSpecialtyTagging: () => ({
      confirmed: SEED_CATALOG[0],
      title: "",
      setTitle: vi.fn(),
      refusal: null,
      isLoading: false,
      tag: vi.fn(),
      finish: vi.fn(),
    }),
  };
});

function startShowTitle() {
  renderWithProviders(<StartShow />);
  return document.querySelector<HTMLInputElement>('input[name="showName"]')!;
}

function classicQuestionTitle() {
  renderWithProviders(<ClassicSpecialtyQuestion />);
  return screen.getByLabelText(new RegExp(specialtyCopy.titleLabel));
}

function modernQuestionTitle() {
  renderWithProviders(<ModernSpecialtyQuestion />);
  return screen.getByRole("textbox", { name: new RegExp(specialtyCopy.titleLabel) });
}

function editDialogTitle() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG as SpecialtyShow[]))
  );
  renderWithProviders(
    <EditShowDetailsDialog
      showId={77}
      specialty={null}
      showName={null}
      startTime="2026-10-26T15:00:00Z"
      onClose={() => {}}
    />
  );
  return screen.getByRole("textbox", { name: /title/i });
}

describe("show title inputs", () => {
  it("matches the server's limit", () => {
    expect(SHOW_TITLE_MAX_LENGTH).toBe(128);
  });

  it.each([
    ["classic sign-on", startShowTitle],
    ["classic set-tagging question", classicQuestionTitle],
    ["modern set-tagging question", modernQuestionTitle],
    ["modern edit-details dialog", editDialogTitle],
  ])("caps the %s at the shared limit", (_label, titleInput) => {
    expect(titleInput()).toHaveAttribute("maxlength", String(SHOW_TITLE_MAX_LENGTH));
  });
});
