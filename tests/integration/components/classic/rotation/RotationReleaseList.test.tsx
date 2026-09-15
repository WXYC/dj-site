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

import { ROTATION_STATUS_FACET_RENDER_BATCH } from "@/lib/features/rotation/types";
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

/**
 * Answers `GET /library/rotation` from whichever key matches the request's own
 * `?status=`, so a facet that asks for the wrong one renders nothing rather
 * than quietly reading another facet's rows.
 */
function mockRotationListByStatus(rowsByStatus: Record<string, unknown[]>) {
  server.use(
    http.get(BASE, ({ request }) =>
      HttpResponse.json(rowsByStatus[new URL(request.url).searchParams.get("status") ?? "active"] ?? []),
    ),
  );
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
    renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

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

  // canWrite is a required, server-resolved prop (see
  // app/dashboard/@classic/rotation/page.tsx): a DJ gets no Actions column
  // at all -- header cell included -- and no "Add Rotation Release" link,
  // while everything read-only (facet chips, Format Tallysheets, Main Menu)
  // stays exactly as it is for every role.
  describe("canWrite=false (DJ)", () => {
    it("omits the Add Rotation Release link but keeps the other header links and facet chips", () => {
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={false} />);

      expect(screen.queryByRole("link", { name: "Add Rotation Release" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Format Tallysheets" })).toHaveAttribute(
        "href",
        "/dashboard/rotation/tallysheet",
      );
      expect(screen.getByRole("link", { name: "Main Menu" })).toHaveAttribute("href", "/dashboard/catalog");
      expect(screen.getByRole("link", { name: "Active" })).toBeInTheDocument();
    });

    it("drops the Actions column entirely -- header cell included -- rather than rendering it empty", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={false} />);

      await screen.findByText("Juana Molina");

      expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
      const headerCells = screen.getAllByRole("columnheader");
      expect(headerCells).toHaveLength(8);
      expect(headerCells.map((cell) => cell.textContent)).toEqual([
        "Artist",
        "Title",
        "Label",
        "Type",
        "Format",
        "Added",
        "Killed",
        "Library",
      ]);

      const juanaRow = screen.getByText("Juana Molina").closest("tr") as HTMLElement;
      expect(juanaRow.children).toHaveLength(8);
    });

    it("offers no row Edit, Import, Kill or Unkill affordance", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={false} />);

      await screen.findByText("Juana Molina");

      expect(screen.queryByRole("link", { name: /^Edit: / })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Import: / })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Kill: / })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Unkill: / })).not.toBeInTheDocument();
    });

    it("drops the Actions column on the Awaiting Cataloging facet too", async () => {
      mockUncatalogued([
        {
          id: 6001,
          album_id: null,
          rotation_bin: "M",
          add_date: "2026-08-10",
          kill_date: null,
          artist_name: "LOS THUTHANAKA",
          album_title: "Wak'a",
          record_label: "self-released",
          format_id: 3,
          label_id: null,
        },
      ]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={false} />);

      await screen.findByText("LOS THUTHANAKA");
      expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    });
  });

  it("marks the current facet's chip active", () => {
    renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);
    expect(screen.getByRole("link", { name: "Awaiting Cataloging" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Active" })).not.toHaveClass("active");
  });

  describe("Active facet", () => {
    it("renders the JSP's nine columns for a linked and an unlinked row", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

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

    // The JSP renders Import only where its Library column reads
    // "Uncataloged" -- a killed row that never linked. A row still in
    // rotation has not been through a cataloging decision yet, and a linked
    // one has nothing left to import.
    it("offers Import exactly where the Library column reads Uncataloged", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

      await screen.findByText("Juana Molina");
      const chuquiRow = screen.getByText("Chuquimamani-Condori").closest("tr") as HTMLElement;
      expect(within(chuquiRow).getByRole("link", { name: "Import: Edits" })).toHaveAttribute(
        "href",
        "/dashboard/rotation/5002/import",
      );

      const juanaRow = screen.getByText("Juana Molina").closest("tr") as HTMLElement;
      expect(within(juanaRow).queryByRole("link", { name: /^Import: / })).not.toBeInTheDocument();
    });

    // Unlike Import, Edit is offered on every row: a catalogued release's
    // artist, title, label and format belong to the library release, but its
    // two rotation dates stay editable here.
    it("offers Edit on every row, catalogued or not", async () => {
      mockActiveList([JUANA, CHUQUI_UNLINKED]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

      await screen.findByText("Juana Molina");
      expect(screen.getByRole("link", { name: "Edit: DOGA" })).toHaveAttribute(
        "href",
        "/dashboard/rotation/5001",
      );
      expect(screen.getByRole("link", { name: "Edit: Edits" })).toHaveAttribute(
        "href",
        "/dashboard/rotation/5002",
      );
    });

    // The JSP keys Kill/Unkill and its Killed column on `killDate == 0`, not
    // on whether the kill has landed. A kill scheduled for next week is
    // already a kill.
    it("shows a future kill date and offers Unkill, not a green Active and Kill", async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      mockActiveList([{ ...JUANA, rotation_kill_date: future }]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

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
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

      await screen.findByText("Stereolab");
      const artists = screen.getAllByRole("row").slice(1).map((row) => row.children[1]?.textContent);
      expect(artists).toEqual(["Stereolab", "Jessica Pratt"]);
    });

    it("reports a failed kill instead of leaving the row looking killed", async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.error).mockClear();
      mockActiveList([JUANA]);
      server.use(http.patch(BASE, () => new HttpResponse(null, { status: 503 })));

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);
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
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

      await screen.findByText("Juana Molina");
      expect(screen.getAllByText("Juana Molina")).toHaveLength(1);
    });

    it("shows the JSP's empty-state message for a genuinely empty result", async () => {
      mockActiveList([]);
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

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
      renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);

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

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);
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

      const { user } = renderWithProviders(<RotationReleaseList statusFilter="active" canWrite={true} />);
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
      format_id: 3,
      label_id: null,
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
      format_id: null,
      label_id: null,
    };

    it("names the row's own format instead of the em dash when the formats list can", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
          HttpResponse.json([{ id: 3, format_name: "CD" }]),
        ),
      );
      mockUncatalogued([ACTIVE_UNCATALOGUED]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      const row = (await screen.findByText("LOS THUTHANAKA")).closest("tr") as HTMLElement;
      // The sixth cell is the JSP's Format column; the em dash also lives in
      // the Library column, so the assertion has to name the cell.
      await waitFor(() => expect(row.children[5]).toHaveTextContent("CD"));
    });

    it("keeps the em dash for a row that carries no format at all", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
          HttpResponse.json([{ id: 3, format_name: "CD" }]),
        ),
      );
      mockUncatalogued([{ ...ACTIVE_UNCATALOGUED, format_id: null }]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      const row = (await screen.findByText("LOS THUTHANAKA")).closest("tr") as HTMLElement;
      expect(row.children[5]).toHaveTextContent("\u2014");
    });

    it("funnels the killed backlog into the import screen and leaves the active rows alone", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED, KILLED_UNCATALOGUED]);
      const { user } = renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      await screen.findByText("LOS THUTHANAKA");
      expect(screen.queryByRole("link", { name: /^Import: / })).not.toBeInTheDocument();

      await user.click(screen.getByRole("checkbox"));
      expect(
        await screen.findByRole("link", { name: "Import: Rumspringa" }),
      ).toHaveAttribute("href", "/dashboard/rotation/6002/import");
    });

    it("defaults to active-only, hiding the killed backlog", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED, KILLED_UNCATALOGUED]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      expect(await screen.findByText("LOS THUTHANAKA")).toBeInTheDocument();
      expect(screen.queryByText("ear")).not.toBeInTheDocument();
    });

    it("reveals the killed backlog when the toggle is switched on", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED, KILLED_UNCATALOGUED]);
      const { user } = renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);
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
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      expect(await screen.findByText(/older entries in the backlog are not listed here/i)).toBeInTheDocument();
    });

    it("says nothing about truncation for a short page", async () => {
      mockUncatalogued([ACTIVE_UNCATALOGUED]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      await screen.findByText("LOS THUTHANAKA");
      expect(screen.queryByText(/older entries in the backlog are not listed here/i)).not.toBeInTheDocument();
    });

    it("does NOT dedupe by artist and title -- every uncatalogued row is real cataloging work", async () => {
      mockUncatalogued([
        { ...ACTIVE_UNCATALOGUED, id: 1 },
        { ...ACTIVE_UNCATALOGUED, id: 2 },
      ]);
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

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
      renderWithProviders(<RotationReleaseList statusFilter="uncataloged" canWrite={true} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
      expect(screen.queryByText("No rotation releases found for this filter.")).not.toBeInTheDocument();
    });
  });

  describe("All and Killed facets", () => {
    const KILLED_CATALOGUED = {
      ...JUANA,
      rotation_id: 5003,
      artist_name: "Jessica Pratt",
      alphabetical_name: "Pratt, Jessica",
      album_title: "On Your Own Love Again",
      record_label: "Drag City",
      rotation_add_date: "2026-07-01",
      rotation_kill_date: "2026-08-15",
    };

    it.each(["all", "killed"] as const)(
      "shows on status=%s the catalogued-and-killed rows neither other facet reaches",
      async (statusFilter) => {
        mockRotationListByStatus({ all: [KILLED_CATALOGUED] });
        renderWithProviders(<RotationReleaseList statusFilter={statusFilter} canWrite={true} />);

        const row = (await screen.findByText("Drag City")).closest("tr")!;
        expect(within(row).getByText("Jessica Pratt")).toBeInTheDocument();
        expect(within(row).getByText("08/15/26")).toBeInTheDocument();
        expect(within(row).getByText("Cataloged")).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: /^Unkill: / })).toBeInTheDocument();
      },
    );

    it("keeps two rows that share an artist and title, unlike the Active facet", async () => {
      mockRotationListByStatus({
        all: [
          { ...KILLED_CATALOGUED, rotation_id: 1 },
          { ...KILLED_CATALOGUED, rotation_id: 2, rotation_bin: "L" },
        ],
      });
      renderWithProviders(<RotationReleaseList statusFilter="killed" canWrite={true} />);

      expect(await screen.findAllByText("Jessica Pratt")).toHaveLength(2);
    });

    it("narrows Killed to the rows carrying a kill date, where All keeps both", async () => {
      mockRotationListByStatus({ all: [JUANA, KILLED_CATALOGUED] });
      const { unmount } = renderWithProviders(
        <RotationReleaseList statusFilter="killed" canWrite={true} />,
      );

      await screen.findByText("Jessica Pratt");
      expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
      unmount();

      renderWithProviders(<RotationReleaseList statusFilter="all" canWrite={true} />);
      expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
      expect(screen.getByText("Jessica Pratt")).toBeInTheDocument();
    });

    it("drops an unkilled row from Killed without refetching the history", async () => {
      let listRequests = 0;
      server.use(
        http.get(BASE, () => {
          listRequests += 1;
          return HttpResponse.json([KILLED_CATALOGUED, CHUQUI_UNLINKED]);
        }),
        http.patch(`${BASE}/:id`, () => HttpResponse.json({ ...CHUQUI_UNLINKED, kill_date: null })),
      );
      const { user } = renderWithProviders(
        <RotationReleaseList statusFilter="killed" canWrite={true} />,
      );

      await screen.findByText("Chuquimamani-Condori");
      expect(listRequests).toBe(1);

      await user.click(screen.getByRole("button", { name: "Unkill: Edits" }));

      await waitFor(() =>
        expect(screen.queryByText("Chuquimamani-Condori")).not.toBeInTheDocument(),
      );
      // The row left the facet because the write patched the cached history in
      // place; a refetch of thousands of rows per unkill is what that buys.
      expect(listRequests).toBe(1);
      expect(screen.getByText("Jessica Pratt")).toBeInTheDocument();
    });

    it("orders rows most-recently-added first, whatever order the response arrives in", async () => {
      mockRotationListByStatus({
        all: [
          { ...KILLED_CATALOGUED, rotation_id: 1, artist_name: "Stereolab", rotation_add_date: "2026-07-01" },
          { ...KILLED_CATALOGUED, rotation_id: 2, artist_name: "Cat Power", rotation_add_date: "2026-08-20" },
        ],
      });
      renderWithProviders(<RotationReleaseList statusFilter="all" canWrite={true} />);

      await screen.findByText("Cat Power");
      const artists = screen.getAllByRole("row").slice(1).map((row) => row.children[1]?.textContent);
      expect(artists).toEqual(["Cat Power", "Stereolab"]);
    });

    it("orders Killed by kill date, so a recent kill on an old add is at the top", async () => {
      mockRotationListByStatus({
        all: [
          // Added most recently, killed longest ago. Add-date order puts this
          // first; kill-date order puts it last.
          {
            ...KILLED_CATALOGUED,
            rotation_id: 1,
            artist_name: "Stereolab",
            rotation_add_date: "2026-09-01",
            rotation_kill_date: "2026-09-02",
          },
          // The librarian's case: entered rotation long ago, killed this week,
          // and sitting in the for-library bin right now.
          {
            ...KILLED_CATALOGUED,
            rotation_id: 2,
            artist_name: "Cat Power",
            rotation_add_date: "2025-10-01",
            rotation_kill_date: "2026-09-14",
          },
        ],
      });
      renderWithProviders(<RotationReleaseList statusFilter="killed" canWrite={true} />);

      await screen.findByText("Cat Power");
      const artists = screen.getAllByRole("row").slice(1).map((row) => row.children[1]?.textContent);
      expect(artists).toEqual(["Cat Power", "Stereolab"]);
    });

    it("keeps All on add-date order, where a kill date is not a property every row has", async () => {
      mockRotationListByStatus({
        all: [
          { ...KILLED_CATALOGUED, rotation_id: 1, artist_name: "Stereolab", rotation_add_date: "2026-09-01", rotation_kill_date: "2026-09-02" },
          { ...KILLED_CATALOGUED, rotation_id: 2, artist_name: "Cat Power", rotation_add_date: "2025-10-01", rotation_kill_date: "2026-09-14" },
        ],
      });
      renderWithProviders(<RotationReleaseList statusFilter="all" canWrite={true} />);

      await screen.findByText("Stereolab");
      const artists = screen.getAllByRole("row").slice(1).map((row) => row.children[1]?.textContent);
      expect(artists).toEqual(["Stereolab", "Cat Power"]);
    });

    it("offers Import on a killed row that was never catalogued", async () => {
      mockRotationListByStatus({ all: [{ ...CHUQUI_UNLINKED }] });
      renderWithProviders(<RotationReleaseList statusFilter="killed" canWrite={true} />);

      const row = (await screen.findByText("Chuquimamani-Condori")).closest("tr")!;
      expect(within(row).getByText("Uncataloged")).toBeInTheDocument();
      expect(within(row).getByRole("link", { name: /^Import: / })).toHaveAttribute(
        "href",
        "/dashboard/rotation/5002/import",
      );
    });

    it("shows the JSP's empty-state message for a genuinely empty facet", async () => {
      mockRotationListByStatus({ all: [] });
      renderWithProviders(<RotationReleaseList statusFilter="killed" canWrite={true} />);

      expect(await screen.findByText("No rotation releases found for this filter.")).toBeInTheDocument();
    });

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
      renderWithProviders(<RotationReleaseList statusFilter="killed" canWrite={true} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
      expect(screen.queryByText("No rotation releases found for this filter.")).not.toBeInTheDocument();
    });

    it("mounts one batch of a long history and reveals the rest on request", async () => {
      const overflow = 3;
      const history = Array.from({ length: ROTATION_STATUS_FACET_RENDER_BATCH + overflow }, (_, index) => ({
        ...KILLED_CATALOGUED,
        rotation_id: index + 1,
        album_title: `Buried Treasure ${index}`,
        // Descending, so the mounted batch is the newest and the overflow the oldest.
        rotation_add_date: `2026-07-${String(28 - (index % 28)).padStart(2, "0")}`,
      }));
      mockRotationListByStatus({ all: history });
      const { user } = renderWithProviders(<RotationReleaseList statusFilter="all" canWrite={true} />);

      await screen.findByRole("button", { name: `Show ${overflow} more` });
      const mountedRows = () => screen.getAllByRole("row").length - 1;
      expect(mountedRows()).toBe(ROTATION_STATUS_FACET_RENDER_BATCH);
      // The count names the whole history, so a capped view never reads as a complete one.
      expect(
        screen.getByText(
          `Showing ${ROTATION_STATUS_FACET_RENDER_BATCH} of ${history.length} rotation releases.`,
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: `Show ${overflow} more` }));

      expect(mountedRows()).toBe(history.length);
      expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
    });
  });
});
