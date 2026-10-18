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

// The label field renders only for a music director; this form is theirs, so the gate is open here.
vi.mock("@/src/components/shared/Authorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RequireMD: ({ children }: { children: React.ReactNode }) => children,
}));

import { fakeDiscogsPrefillEndpoint, MOLINA_DISCOGS_PREFILL } from "@/tests/fakes/discogsPrefill";
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
  describe("filling the record's details from the Discogs field", () => {
    const FILLED_LINE = "Filled in the artist, album and label from Discogs. Check them before you add the record.";
    const LINK = "https://www.discogs.com/release/24216789-Juana-Molina-DOGA";

    it("makes one request on paste and fills the empty artist, album and label", async () => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint({ prefill: { ...MOLINA_DISCOGS_PREFILL, label_id: 7 } });
      let body: Record<string, unknown> | undefined;
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(moonPix());
        }),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
      expect(screen.getByLabelText(/^Album/)).toHaveValue("DOGA");
      expect(screen.getByDisplayValue("Sonamos")).toBeInTheDocument();
      expect(prefill.urls()).toEqual([LINK]);

      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Log item" }));
      await waitFor(() => expect(body).toBeDefined());
      expect(body).toMatchObject({ record_label: "Sonamos", label_id: 7, discogs_release_id: 24216789 });
    });

    it("leaves a field the music director already typed in alone", async () => {
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Album/), "Doga (promo)");
      await user.click(screen.getByLabelText(/^Discogs link/));
      await user.paste(LINK);

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Album/)).toHaveValue("Doga (promo)");
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
    });

    it("makes no request while digits are typed, and one when the field loses focus", async () => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Discogs link/), "24216789");
      expect(prefill.urls()).toEqual([]);

      await user.tab();
      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(prefill.urls()).toEqual(["24216789"]);
    });

    it("shows the server's line for a named 4xx and keeps the form usable", async () => {
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint({
        respond: () => HttpResponse.json({ message: "Discogs has no release for that link", code: "release_not_found" }, { status: 404 }),
      });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);

      expect(await screen.findByText("Discogs has no release for that link")).toBeInTheDocument();
      await user.type(screen.getByLabelText(/^Album/), "Doga");
      expect(screen.getByLabelText(/^Album/)).toHaveValue("Doga");
    });

    it("shows the generic line for a 5xx", async () => {
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint({ respond: () => HttpResponse.json({ message: "boom" }, { status: 502 }) });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);

      expect(await screen.findByText(/^Couldn't autopopulate from that link/)).toBeInTheDocument();
    });
  });
});
