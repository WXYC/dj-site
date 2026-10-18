import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import type { IntakeItem, Review } from "@wxyc/shared";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, review } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { search: () => url.search });
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
 * A row drawn by `RecordRow`: the artist is the title at the head of the record's column, and every control (a button, or a link other than the artist's own) sits in the actions region beside that column, never inline with the record's text.
 */
function expectRecordRow(lane: HTMLElement, artist: string, expectActions: boolean) {
  const [row] = within(lane).getAllByRole("listitem");
  const title = within(row).getByText(artist);
  const column = title.parentElement as HTMLElement;
  expect(column.firstElementChild).toBe(title);
  const controls = (scope: HTMLElement) =>
    [...scope.querySelectorAll<HTMLElement>("button, a[href]")].filter((control) => control !== title);
  expect(controls(column)).toHaveLength(0);
  if (!expectActions) {
    expect(controls(row)).toHaveLength(0);
    return;
  }
  expect(controls(row).length).toBeGreaterThan(0);
  const actions = (column.parentElement as HTMLElement).nextElementSibling as HTMLElement;
  for (const control of controls(row)) {
    expect(actions).toContainElement(control);
  }
}

describe("every review lane draws its rows with RecordRow", () => {
  beforeEach(() => {
    url.search = "";
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  // The My reviews tab's lists are stages in a tabpanel named by the selected chip; with no `?stage=`, it opens on Open reviews when anything is there, else on Submitted.
  // My reviews draws a review's record once its own read lands, with Open as its one action.
  it.each<[string, "mine" | "shelf", { role: "region" | "tabpanel"; name: string }, IntakeItem["effective_state"], Partial<IntakeItem>, Review[]]>([
    ["request, under Open reviews", "mine", { role: "tabpanel", name: "Open reviews" }, "requested", { requested_dj_id: ME }, []],
    ["record I'm reviewing, under Open reviews", "mine", { role: "tabpanel", name: "Open reviews" }, "checked_out", { checked_out_by: ME }, []],
    ["draft of a record I no longer have, under Open reviews", "mine", { role: "tabpanel", name: "Open reviews" }, "pool", {}, [review({ id: 40, intake_item_id: 1 })]],
    ["submitted review, under Submitted", "mine", { role: "tabpanel", name: "Submitted" }, "pool", {}, [review({ id: 40, intake_item_id: 1, status: "submitted", in_use: false })]],
    ["review shelf lane", "shelf", { role: "region", name: "The review shelf" }, "pool", {}, []],
  ])("the DJ's %s", async (_case, tab, list, state, overrides, mine) => {
    mockAuth.authority = Authorization.DJ;
    const open = [record(1, { state, effective_state: state, ...overrides })];
    fakeReviewsEndpoints({ open, records: open, mine });

    renderWithProviders(<ReviewsScreen tab={tab} />);

    const lane = await screen.findByRole(list.role, { name: list.name });
    await within(lane).findByText("Juana Molina");
    expectRecordRow(lane, "Juana Molina", true);
  });

  it.each([
    ["waiting", "Review waiting", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", null), submitted_review_count: 1, accepted_review_id: null }],
    ["requested", "Requested", { state: "requested", effective_state: "requested", ...requestedFor(null, "DJ Pat") }],
    ["being_reviewed", "Being reviewed", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", null) }],
    ["reviewed", "Reviewed", { state: "reviewed", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }],
    ["filed", "Filed", { state: "filed", effective_state: "filed", filed_at: new Date().toISOString() }],
  ] as const)("the music directors' %s stage", async (stage, name, overrides) => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    url.search = `?stage=${stage}`;
    const row = record(1, overrides);
    fakeReviewsEndpoints({
      open: row.effective_state === "reviewed" || row.effective_state === "filed" ? [] : [row],
      reviewed: row.effective_state === "reviewed" ? [row] : [],
      filed: row.effective_state === "filed" ? [row] : [],
    });

    renderWithProviders(<IntakeLanes />);

    const lane = await screen.findByRole("tabpanel", { name });
    await within(lane).findByText("Juana Molina");
    // Every stage ends its row's actions with Open.
    expectRecordRow(lane, "Juana Molina", true);
    expect(within(lane).getByRole("link", { name: "Juana Molina" })).toHaveAttribute("href", "/dashboard/admin/intake/1");
  });
});
