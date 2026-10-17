import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() });
});

const ME = "dj-me";
const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

const record = (id: number, overrides = {}) =>
  intakeItem({ id, artist_name: "Juana Molina", album_title: `DOGA ${id}`, record_label: "Sonamos", ...overrides });

/**
 * A row drawn by `RecordRow`: the artist is the title at the head of the record's column, and every button sits in the actions region beside that column, never inline with the record's text.
 */
function expectRecordRow(lane: HTMLElement, artist: string, expectButtons: boolean) {
  const [row] = within(lane).getAllByRole("listitem");
  const title = within(row).getByText(artist);
  const column = title.parentElement as HTMLElement;
  expect(column.firstElementChild).toBe(title);
  expect(within(column).queryAllByRole("button")).toHaveLength(0);
  const buttons = within(row).queryAllByRole("button");
  if (!expectButtons) {
    expect(buttons).toHaveLength(0);
    return;
  }
  expect(buttons.length).toBeGreaterThan(0);
  const actions = (column.parentElement as HTMLElement).nextElementSibling as HTMLElement;
  for (const button of buttons) {
    expect(actions).toContainElement(button);
  }
}

describe("every review lane draws its rows with RecordRow", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["Requests for me", "requested", { requested_dj_id: ME }],
    ["Records I'm reviewing", "checked_out", { checked_out_by: ME }],
    ["The review shelf", "pool", {}],
  ] as const)("the DJ's %s lane", async (name, state, overrides) => {
    mockAuth.authority = Authorization.DJ;
    const open = [record(1, { state, effective_state: state, ...overrides })];
    fakeReviewsEndpoints({ open, records: open });

    renderWithProviders(<ReviewsScreen />);

    expectRecordRow(await screen.findByRole("region", { name }), "Juana Molina", true);
  });

  it.each([
    ["Review waiting (1)", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", null), submitted_review_count: 1, accepted_review_id: null }, false],
    ["Requested", { state: "requested", effective_state: "requested", ...requestedFor(null, "DJ Pat") }, true],
    ["Being reviewed", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", null) }, true],
    ["Reviewed (1)", { state: "reviewed", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }, true],
    ["Filed", { state: "filed", effective_state: "filed" }, false],
  ] as const)("the music directors' %s lane", async (name, overrides, expectButtons) => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    const row = record(1, overrides);
    fakeReviewsEndpoints({
      open: row.effective_state === "reviewed" || row.effective_state === "filed" ? [] : [row],
      reviewed: row.effective_state === "reviewed" ? [row] : [],
      filed: row.effective_state === "filed" ? [row] : [],
      awaiting: name === "Review waiting (1)" ? [row] : [],
    });

    renderWithProviders(<IntakeLanes />);

    const lane = await screen.findByRole("region", { name });
    expectRecordRow(lane, "Juana Molina", expectButtons);
    if (name !== "Review waiting (1)") {
      expect(within(lane).getByRole("link", { name: "Juana Molina" })).toHaveAttribute("href", "/dashboard/admin/intake/1");
    }
  });
});
