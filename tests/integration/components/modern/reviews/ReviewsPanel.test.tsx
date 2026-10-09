import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewRevision, server } from "@/tests/helpers";
import type { AlbumReview } from "@wxyc/shared";

// The Print this review link is gated by the real RequireMD, which resolves the music director tier from the session and the organization role.
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "me", email: "me@wxyc.org", name: "Me", username: "me", role: null, emailVerified: true } },
      isPending: false,
      error: null,
    }),
  },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));
const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/lib/features/authentication/organization-utils", async () => {
  const { Authorization: Role } = await import("@/lib/features/admin/types");
  return {
    fetchOrganizationRoleForUserClient: vi.fn(async () => (mockAuth.authority >= Role.MD ? "musicDirector" : "dj")),
  };
});
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import ReviewsPanel from "@/src/components/experiences/modern/reviews/ReviewsPanel";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const RECORD = { artist: "Juana Molina", album: "DOGA", label: "Sonamos" };
const ALBUM_ID = 7;
const submitted = (id: number, overrides = {}) =>
  review({ id, album_id: ALBUM_ID, intake_item_id: null, status: "submitted", on_cover: false, revision_count: 1, medium: "typed", author: `Reviewer ${id}`, review: `Text ${id}`, ...overrides });

const serve = (reviews: ReturnType<typeof submitted>[], archive: Partial<AlbumReview>[] = []) =>
  fakeReviewsEndpoints({
    mine: [submitted(999)],
    forRelease: { [ALBUM_ID]: reviews },
    archive: { [ALBUM_ID]: archive as AlbumReview[] },
  });

const renderPanel = () => renderWithProviders(<ReviewsPanel albumId={ALBUM_ID} record={RECORD} />);
const headings = () => screen.getAllByRole("heading").map((h) => h.textContent);

describe("ReviewsPanel", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
  });

  it("lists the review on the cover, then the others, in the server's order", async () => {
    serve([submitted(1, { on_cover: true }), submitted(3), submitted(2)]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["The review on the cover", "Other reviews"]);
    const others = screen.getByText("Other reviews").closest("section")!;
    expect(within(others).getAllByRole("listitem").map((li) => /Reviewer \d+/.exec(li.textContent ?? "")?.[0])).toEqual(["Reviewer 3", "Reviewer 2"]);
    expect(screen.queryByText("Reviewer 999", { exact: false })).not.toBeInTheDocument();
  });

  it("uses the plural heading for two reviews on the cover", async () => {
    serve([submitted(1, { on_cover: true }), submitted(2, { on_cover: true })]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["The reviews on the cover"]);
  });

  it("lists everything under Reviews when none is on the cover", async () => {
    serve([submitted(1), submitted(2)]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["Reviews"]);
  });

  it("lists a review that is in use but not on this cover with the others", async () => {
    serve([submitted(1, { in_use: true, on_cover: false })]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["Reviews"]);
  });

  it("shows a handwritten review without text as on the sleeve, with its author", async () => {
    serve([submitted(1, { medium: "handwritten", review: null, author: "Reviewer One" })]);
    renderPanel();

    expect(await screen.findByText("Reviewer One · on the sleeve")).toBeInTheDocument();
  });

  it("shows the FCC line of a handwritten review without text beside its on the sleeve line", async () => {
    serve([submitted(1, { medium: "handwritten", review: null, author: "Reviewer One", fcc: "Contains no obscenity" })]);
    renderPanel();

    expect(await screen.findByText("Reviewer One · on the sleeve")).toBeInTheDocument();
    expect(screen.getByText("Contains no obscenity")).toBeInTheDocument();
  });

  it("does not name this page's record on the slip of a review of a cited release", async () => {
    serve([submitted(1, { album_id: ALBUM_ID + 1 }), submitted(2)]);
    renderPanel();

    const slips = await screen.findAllByRole("group", { name: REVIEW_COPY.slip.name });
    const cited = slips.find((slip) => within(slip).queryByText("Text 1"))!;
    const own = slips.find((slip) => within(slip).queryByText("Text 2"))!;
    expect(within(cited).queryByText(RECORD.album)).not.toBeInTheDocument();
    expect(within(cited).queryByText(RECORD.artist)).not.toBeInTheDocument();
    expect(within(cited).queryByText(RECORD.label)).not.toBeInTheDocument();
    expect(within(own).getByText(RECORD.album)).toBeInTheDocument();
  });

  it.each([
    ["a music director", Authorization.MD, {}, true],
    ["a DJ", Authorization.DJ, {}, false],
    ["a music director, on a handwritten review without text", Authorization.MD, { medium: "handwritten", review: null }, false],
    ["a music director, on a handwritten review with text", Authorization.MD, { medium: "handwritten", review: "Some text" }, false],
    ["a music director, on a printed review", Authorization.MD, { medium: "printed" }, false],
    ["a music director, on a draft", Authorization.MD, { status: "draft" }, false],
  ])("offers Print this review to %s: %s", async (_who, authority, overrides, offered) => {
    mockAuth.authority = authority;
    serve([submitted(1, overrides)]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    if (offered) {
      expect(await screen.findByRole("link", { name: "Print this review" })).toHaveAttribute("href", `/dashboard/admin/library/${ALBUM_ID}/slip/1`);
    } else {
      // Let the gate resolve the role before asserting the link is absent.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("link", { name: "Print this review" })).not.toBeInTheDocument();
    }
  });

  it("does not offer Print this review on the archive's form-era takes", async () => {
    mockAuth.authority = Authorization.MD;
    serve([], [{ id: 1, reviewer: "Reviewer One", review: "Old take" }]);
    renderPanel();

    await screen.findByText("Reviewer One: Old take");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("link", { name: "Print this review" })).not.toBeInTheDocument();
  });

  it("links to the history only for a review edited after submitting", async () => {
    serve([submitted(1, { revision_count: 2 }), submitted(2, { revision_count: 1 })]);
    renderPanel();

    const link = await screen.findByRole("link", { name: "Edited · see history" });
    expect(link).toHaveAttribute("href", "/dashboard/reviews/1/history");
    expect(screen.getAllByRole("link", { name: "Edited · see history" })).toHaveLength(1);
  });

  it("lists the archive's reviews for the release as earlier takes", async () => {
    serve([], [{ id: 1, reviewer: "Reviewer Old", review: "Archived words" }]);
    renderPanel();

    const section = (await screen.findByText(REVIEW_COPY.albumPanel.archiveTitle)).closest("section")!;
    expect(within(section).getByText("Reviewer Old: Archived words")).toBeInTheDocument();
  });

  it("offers Review this release with the approved nudge beside it", async () => {
    serve([]);
    renderPanel();

    const button = await screen.findByRole("link", { name: "Review this release" });
    expect(button).toHaveAttribute("href", `/dashboard/reviews/new?album_id=${ALBUM_ID}`);
    expect(screen.getByText("New to reviewing? New arrivals on the review shelf need reviews most.")).toBeInTheDocument();
  });

  it("fills the album's FCC notes region with the FCC notes panel", async () => {
    serve([]);
    renderPanel();

    const slot = await screen.findByTestId("fcc-notes-slot");
    expect(await within(slot).findByText("No FCC notes for this record.")).toBeInTheDocument();
    expect(slot).toHaveAttribute("data-album-id", String(ALBUM_ID));
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serve([submitted(1)]);
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => void requested.push(new URL(request.url).pathname);
    server.events.on("request:start", log);

    try {
      const { container } = renderPanel();
      await new Promise((r) => setTimeout(r, 50));
      expect(requested).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });

  it("renders for a music director under staff", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    mockAuth.authority = Authorization.MD;
    serve([]);
    renderPanel();

    expect(await screen.findByTestId("fcc-notes-slot")).toBeInTheDocument();
  });

  it("shows the printed-version note above a printed review, and none above an unprinted one", async () => {
    fakeReviewsEndpoints({
      forRelease: {
        [ALBUM_ID]: [
          submitted(1, { printed_revision_id: 11, printed_at: "2026-10-02T16:00:00Z" }),
          submitted(2),
        ],
      },
      revisions: { "1": [reviewRevision({ id: 11, review_id: 1, revision: 1 })] },
    });
    renderPanel();

    expect(await screen.findAllByText("This is the version printed on the cover.")).toHaveLength(1);
  });
});
