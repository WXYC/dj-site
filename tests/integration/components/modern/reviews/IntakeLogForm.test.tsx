import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";

const moonPix = () => intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador" });

describe("IntakeLogForm", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it("sends the artist, album and format of a record entered in the form", async () => {
    fakeReviewsEndpoints({ open: [] });
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "CD" }));
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ artist_name: "Cat Power", album_title: "Moon Pix" });
  });

  it("shows the Format options as CD and Vinyl while still sending the stored format's id", async () => {
    fakeReviewsEndpoints({ open: [] });
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
        HttpResponse.json([{ id: 1, format_name: "cd" }, { id: 2, format_name: "vinyl" }]),
      ),
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["CD", "Vinyl"]);
    await user.click(options[1]);
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body!.format_id).toBe(2);
  });
});
