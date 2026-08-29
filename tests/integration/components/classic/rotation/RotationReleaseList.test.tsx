import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import RotationReleaseList from "@/src/components/experiences/classic/rotation/RotationReleaseList";

const BASE = `${TEST_BACKEND_URL}/library/rotation`;

const JUANA = {
  id: 42,
  code_letters: "MOL",
  code_artist_number: 1,
  code_number: 1,
  artist_name: "Juana Molina",
  alphabetical_name: "Molina, Juana",
  album_title: "DOGA",
  record_label: "Sonamos",
  label_id: 5,
  genre_name: "Rock",
  format_name: "CD",
  rotation_id: 5001,
  add_date: "2026-08-01",
  rotation_add_date: "2026-08-01",
  rotation_bin: "H",
  rotation_kill_date: null,
  plays: 3,
  legacy_release_id: 7001,
};

const CHUQUI_UNLINKED = {
  id: null,
  code_letters: null,
  code_artist_number: null,
  code_number: null,
  artist_name: "Chuquimamani-Condori",
  alphabetical_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  label_id: null,
  genre_name: null,
  format_name: null,
  rotation_id: 5002,
  add_date: null,
  rotation_add_date: "2026-08-02",
  rotation_bin: "M",
  rotation_kill_date: "2026-01-01",
  plays: null,
  legacy_release_id: null,
};

function mockActiveList(rows: unknown[]) {
  server.use(http.get(BASE, () => HttpResponse.json(rows)));
}

function mockUncatalogued(rows: unknown[]) {
  server.use(http.get(`${BASE}/uncatalogued`, () => HttpResponse.json(rows)));
}

describe("classic RotationReleaseList — rotationReleaseList.jsp", () => {
  beforeEach(() => {
    mockActiveList([]);
    mockUncatalogued([]);
  });

  it("renders the JSP's header links, heading, and facet chip bar", () => {
    renderWithProviders(<RotationReleaseList statusFilter="active" />);

    expect(screen.getByRole("link", { name: "Add Rotation Release" })).toHaveAttribute(
      "href",
      "/dashboard/rotation/new",
    );
    expect(screen.getByRole("link", { name: "Main Menu" })).toHaveAttribute("href", "/dashboard/catalog");
    expect(screen.getByRole("heading", { name: "Rotation Releases" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/dashboard/rotation?status=all");
    expect(screen.getByRole("link", { name: "Active" })).toHaveAttribute(
      "href",
      "/dashboard/rotation?status=active",
    );
    expect(screen.getByRole("link", { name: "Killed" })).toHaveAttribute(
      "href",
      "/dashboard/rotation?status=killed",
    );
    expect(screen.getByRole("link", { name: "Awaiting Cataloging" })).toHaveAttribute(
      "href",
      "/dashboard/rotation?status=uncataloged",
    );
  });

  it("marks the current facet's chip active", () => {
    renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);
    expect(screen.getByRole("link", { name: "Awaiting Cataloging" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Active" })).not.toHaveClass("active");
  });

  describe("Active facet", () => {
    it("renders the JSP's nine columns for a linked and an unlinked row", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
      const juanaRow = screen.getByText("Juana Molina").closest("tr") as HTMLElement;
      expect(within(juanaRow).getByText("DOGA")).toBeInTheDocument();
      expect(within(juanaRow).getByText("Sonamos")).toBeInTheDocument();
      expect(within(juanaRow).getByText("H")).toBeInTheDocument();
      expect(within(juanaRow).getByText("CD")).toBeInTheDocument();
      expect(within(juanaRow).getByText("08/01/26")).toBeInTheDocument();
      expect(within(juanaRow).getByText("Active")).toBeInTheDocument();
      expect(within(juanaRow).getByText("Cataloged")).toBeInTheDocument();
      expect(within(juanaRow).getByRole("button", { name: /^Kill: / })).toBeInTheDocument();

      const chuquiRow = screen.getByText("Chuquimamani-Condori").closest("tr") as HTMLElement;
      expect(within(chuquiRow).getByText("Uncataloged")).toBeInTheDocument();
      expect(within(chuquiRow).getByRole("button", { name: /^Unkill: / })).toBeInTheDocument();
    });

    // Both destinations are later slices and no route answers either path,
    // so rendering the JSP's row links would put a 404 under every row.
    it("renders no Edit or Import link while their destinations do not exist", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      await screen.findByText("Juana Molina");
      expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Import" })).not.toBeInTheDocument();
    });

    // The JSP keys Kill/Unkill and its Killed column on `killDate == 0`, not
    // on whether the kill has landed. A kill scheduled for next week is
    // already a kill.
    it("shows a future kill date and offers Unkill, not a green Active and Kill", async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      mockActiveList([{ ...JUANA, rotation_kill_date: future }]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      const row = (await screen.findByText("Juana Molina")).closest("tr") as HTMLElement;
      expect(within(row).getByRole("button", { name: /^Unkill: / })).toBeInTheDocument();
      expect(within(row).queryByRole("button", { name: /^Kill: / })).not.toBeInTheDocument();
      expect(within(row).queryByText("Active")).not.toBeInTheDocument();
    });

    it("orders rows most-recently-added first, matching the JSP, not the order the response arrives in", async () => {
      mockActiveList([
        { ...JUANA, rotation_id: 1, artist_name: "Jessica Pratt", album_title: "On Your Own Love Again", rotation_add_date: "2026-08-01" },
        { ...JUANA, rotation_id: 2, artist_name: "Stereolab", album_title: "Dots and Loops", rotation_add_date: "2026-08-20" },
      ]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      await screen.findByText("Stereolab");
      const artists = screen.getAllByRole("row").slice(1).map((row) => row.children[1]?.textContent);
      expect(artists).toEqual(["Stereolab", "Jessica Pratt"]);
    });

    it("reports a failed kill instead of leaving the row looking killed", async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.error).mockClear();
      mockActiveList([JUANA]);
      server.use(http.patch(BASE, () => new HttpResponse(null, { status: 503 })));

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" />);
      await screen.findByText("Juana Molina");
      await user.click(screen.getByRole("button", { name: /^Kill: / }));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: /^Kill: / })).toBeEnabled();
    });

    it("dedupes rows sharing an artist and title, keeping the first", async () => {
      mockActiveList([
        { ...JUANA, rotation_id: 1 },
        { ...JUANA, rotation_id: 2 },
      ]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      await screen.findByText("Juana Molina");
      expect(screen.getAllByText("Juana Molina")).toHaveLength(1);
    });

    it("shows the JSP's empty-state message for a genuinely empty result", async () => {
      mockActiveList([]);
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      expect(await screen.findByText("No rotation releases found for this filter.")).toBeInTheDocument();
    });

    // A query-fed list must never render an unissued or failed request as
    // "there are none".
    it("never renders the empty-state message on an outage", async () => {
      server.use(
        http.get(
          BASE,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );
      renderWithProviders(<RotationReleaseList statusFilter="active" />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
      expect(screen.queryByText("No rotation releases found for this filter.")).not.toBeInTheDocument();
    });

    it("kills an active row", async () => {
      mockActiveList([JUANA]);
      let killedBody: unknown;
      server.use(
        http.patch(BASE, async ({ request }) => {
          killedBody = await request.json();
          return HttpResponse.json({ ...JUANA, rotation_kill_date: "2026-08-29" });
        }),
      );

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" />);
      await screen.findByText("Juana Molina");
      await user.click(screen.getByRole("button", { name: /^Kill: / }));

      await waitFor(() => expect(killedBody).toEqual({ rotation_id: 5001 }));
    });

    it("unkills a killed row", async () => {
      mockActiveList([CHUQUI_UNLINKED]);
      let unkilledUrl: string | undefined;
      let unkilledBody: unknown;
      server.use(
        http.patch(`${BASE}/:id`, async ({ request, params }) => {
          unkilledUrl = params.id as string;
          unkilledBody = await request.json();
          return HttpResponse.json({ ...CHUQUI_UNLINKED, kill_date: null });
        }),
      );

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" />);
      await screen.findByText("Chuquimamani-Condori");
      await user.click(screen.getByRole("button", { name: /^Unkill: / }));

      await waitFor(() => {
        expect(unkilledUrl).toBe("5002");
        expect(unkilledBody).toEqual({ kill_date: null });
      });
    });
  });

  describe("Awaiting Cataloging facet", () => {
    const ACTIVE_UNCATALOGUED = {
      id: 6001,
      album_id: null,
      rotation_bin: "M",
      add_date: "2026-08-10",
      kill_date: null,
      artist_name: "LOS THUTHANAKA",
      album_title: "Wak'a",
      record_label: "self-released",
    };
    const KILLED_UNCATALOGUED = {
      id: 6002,
      album_id: null,
      rotation_bin: "L",
      add_date: "2026-01-10",
      kill_date: "2026-02-01",
      artist_name: "ear",
      album_title: "Rumspringa",
      record_label: null,
    };

    it("defaults to active-only, hiding the killed backlog", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED, KILLED_UNCATALOGUED]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);

      expect(await screen.findByText("LOS THUTHANAKA")).toBeInTheDocument();
      expect(screen.queryByText("ear")).not.toBeInTheDocument();
    });

    it("reveals the killed backlog when the toggle is switched on", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED, KILLED_UNCATALOGUED]);
      const { user } = renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);
      await screen.findByText("LOS THUTHANAKA");

      await user.click(screen.getByRole("checkbox", { name: /show killed/i }));

      expect(await screen.findByText("ear")).toBeInTheDocument();
      expect(screen.getByText("LOS THUTHANAKA")).toBeInTheDocument();
    });

    it("says so when the response fills a whole page, rather than showing a partial backlog as complete", async () => {
      const full = Array.from({ length: 500 }, (_, index) => ({
        ...ACTIVE_UNCATALOGUED,
        id: index + 1,
        artist_name: `Artist ${index}`,
      }));
      mockUncatalogued(full);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);

      expect(await screen.findByText(/older entries in the backlog are not listed here/i)).toBeInTheDocument();
    });

    it("says nothing about truncation for a short page", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);

      await screen.findByText("LOS THUTHANAKA");
      expect(screen.queryByText(/older entries in the backlog are not listed here/i)).not.toBeInTheDocument();
    });

    it("does NOT dedupe by artist and title -- every uncatalogued row is real cataloging work", async () => {
      mockUncatalogued([
        { ...ACTIVE_UNCATALOGUED, id: 1 },
        { ...ACTIVE_UNCATALOGUED, id: 2 },
      ]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);

      expect(await screen.findAllByText("LOS THUTHANAKA")).toHaveLength(2);
    });

    it("never renders the empty-state message on an outage", async () => {
      server.use(
        http.get(
          `${BASE}/uncatalogued`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
      expect(screen.queryByText("No rotation releases found for this filter.")).not.toBeInTheDocument();
    });
  });

  describe("All and Killed facets — no Backend source for catalogued+killed rotation rows", () => {
    it.each(["all", "killed"] as const)(
      "states the Backend gap honestly for status=%s rather than rendering wrong data",
      (statusFilter) => {
        renderWithProviders(<RotationReleaseList statusFilter={statusFilter} />);
        expect(screen.getByText(/doesn't expose|does not expose/i)).toBeInTheDocument();
      },
    );
  });
});
