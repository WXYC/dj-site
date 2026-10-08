import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, review, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const DRAFT = review();

const PRIVACY = "Only you can read this draft. Music directors can see that you have one in progress, not what it says.";

const RECORD = intakeItem({ id: 2 });

function serve(served: Review = DRAFT) {
  fakeReviewsEndpoints({ reviews: [served], open: [RECORD] });
}

describe("ReviewEditor", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("shows the draft-privacy line and the five slip fields with their help text", async () => {
    serve();
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByText(PRIVACY)).toBeInTheDocument();
    for (const { label, help } of Object.values(REVIEW_COPY.fields)) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      expect(screen.getByText(help)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
  });

  it("reflects each field in the slip preview as it is typed", async () => {
    serve();
    const { user } = renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
    expect(await within(preview).findByText("Stereolab")).toBeInTheDocument();
    expect(within(preview).getByText("Duophonic")).toBeInTheDocument();

    // Every typed value differs from every value the fixtures carry, so a
    // preview that shows the saved review instead of the typing cannot pass.
    const typed = [
      ["buzzwords", "hushed"],
      ["artist_blurb", "A Paris band"],
      ["review", "Bright."],
      ["recommended_tracks", "A1, B4"],
      ["fcc", "Track two"],
    ] as const;
    const fixtureValues = [...Object.values(DRAFT), ...Object.values(RECORD)].map(String);
    for (const [name, text] of typed) {
      expect(fixtureValues).not.toContain(text);
      const field = screen.getByLabelText(REVIEW_COPY.fields[name].label);
      await user.clear(field);
      await user.type(field, text);
      expect(within(preview).getByText(text)).toBeInTheDocument();
    }
    expect(within(preview).queryByText("Warm.")).not.toBeInTheDocument();
  });

  it("labels the slip's rows from the copy module, in the printed slip's order", async () => {
    serve();
    renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });

    const { slip, fields } = REVIEW_COPY;
    expect(Array.from(preview.querySelectorAll("strong"), (el) => el.textContent)).toEqual([
      slip.artist,
      slip.album,
      slip.label,
      fields.buzzwords.label,
      slip.artistBlurb,
      slip.review,
      slip.reviewer,
      slip.recommended,
      fields.fcc.label,
    ]);
  });

  it.each([
    ["shows", "draft", true],
    ["does not show", "submitted", false],
  ] as const)("%s the draft-privacy line for a %s review", async (_verb, status, shown) => {
    serve({ ...DRAFT, status } as Review);
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByLabelText(REVIEW_COPY.fields.review.label)).toHaveValue("Warm.");
    if (shown) expect(screen.getByText(PRIVACY)).toBeInTheDocument();
    else expect(screen.queryByText(PRIVACY)).not.toBeInTheDocument();
  });

  it("saves the draft with a PATCH of the fields", async () => {
    serve();
    let seen: { path: string; body: unknown } | undefined;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => {
        seen = { path: new URL(request.url).pathname, body: await request.json() };
        return HttpResponse.json(DRAFT);
      }),
    );

    const { user } = renderWithProviders(<ReviewEditor id={40} />);
    await user.type(await screen.findByLabelText("Buzzwords"), "hushed");
    await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(REVIEW_COPY.saved));
    expect(seen).toEqual({
      path: "/reviews/40",
      body: { buzzwords: "hushed", artist_blurb: "", review: "Warm.", recommended_tracks: "", fcc: "" },
    });
  });

  it("says the review could not load on an outage", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.couldNotLoad);
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serve();
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => void requested.push(new URL(request.url).pathname);
    server.events.on("request:start", log);

    try {
      const { container } = renderWithProviders(<ReviewEditor id={40} />);
      await new Promise((r) => setTimeout(r, 50));
      expect(requested.filter((p) => p.startsWith("/reviews"))).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });
});
