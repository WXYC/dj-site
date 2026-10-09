import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "md-me", authority: Authorization.MD } },
    authenticating: false,
    authenticated: true,
  }),
}));

import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
afterEach(() => vi.unstubAllEnvs());

describe("IntakeLanes props", () => {
  it.each([
    ["neither prop", {}, false, false, false],
    ["logForm", { logForm: true }, true, false, false],
    ["shelf", { shelf: true }, false, true, true],
    ["both", { logForm: true, shelf: true }, true, true, true],
  ])("with %s: form shown %s, shelf lane shown %s, reviewers read %s", async (_label, props, form, shelf, reviewersRead) => {
    let reviewerReads = 0;
    fakeReviewsEndpoints({ open: [moonPix()] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
        reviewerReads += 1;
        return HttpResponse.json({ reviewers: [] });
      }),
    );

    renderWithProviders(<IntakeLanes {...props} />);

    // The Filed lane renders last, so by then every lane the props allow has landed.
    await screen.findByRole("region", { name: "Filed" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("form", { name: "Log an item" }) !== null).toBe(form);
    expect(screen.queryByRole("region", { name: "On the review shelf" }) !== null).toBe(shelf);
    expect(reviewerReads > 0).toBe(reviewersRead);
  });
});

describe("IntakeLogForm", () => {
  it("calls onLog before the request goes out, then logs the typed fields", async () => {
    const order: string[] = [];
    let body: unknown;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        order.push("request");
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm onLog={() => order.push("onLog")} />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "cd" }));
    await user.type(screen.getByLabelText("Discogs release id (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1, discogs_release_id: 123 }),
    );
    expect(order).toEqual(["onLog", "request"]);
  });
});
