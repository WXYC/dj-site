import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AlbumSearchResultJSON } from "@/lib/features/catalog/types";
import { CATALOG_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";
import {
  createTestAlbumSearchResult,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// The auth gate is covered against the real skip logic in the hook's own
// spec; here a settled, authenticated session is the precondition for
// everything under test.
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import { toast } from "sonner";
import MissingReleases from "@/src/components/experiences/classic/library/MissingReleases";

const mockToastError = toast.error as ReturnType<typeof vi.fn>;

function libraryQueryPage(rows: AlbumSearchResultJSON[], total = rows.length) {
  return {
    results: rows,
    total,
    page: 0,
    totalPages: Math.max(1, Math.ceil(total / CATALOG_QUERY_MAX_LIMIT)),
  };
}

/** Serve `/library/query`, advancing through `pages` one request at a time. */
function mockMissingReleasePages(...pages: AlbumSearchResultJSON[][]) {
  let call = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/query`, () => {
      const rows = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return HttpResponse.json(libraryQueryPage(rows));
    }),
  );
}

function missingRow(overrides: Partial<AlbumSearchResultJSON> = {}) {
  return createTestAlbumSearchResult({
    id: 4201,
    album_title: "On Your Own Love Again",
    artist_name: "Jessica Pratt",
    code_letters: "RO",
    code_artist_number: 55,
    code_number: 3,
    format_name: "Vinyl",
    genre_name: "Rock",
    label: "Drag City",
    date_lost: "2026-07-01",
    ...overrides,
  });
}

async function renderAndSettle() {
  const view = renderWithProviders(<MissingReleases />);
  // The uninitialized substate renders as loading; nothing may claim anything
  // about the stacks before the request has resolved — not an empty shelf,
  // and not a count.
  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(
    screen.queryByText("There are currently no missing releases."),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Total missing:/)).toHaveTextContent(
    "Total missing: —",
  );
  await waitFor(() =>
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument(),
  );
  return view;
}

function markFoundButton(title: string) {
  return screen.getByRole("button", { name: `Mark as Found: ${title}` });
}

describe("Classic MissingReleases — missingReleases.jsp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("load states", () => {
    it("renders the empty state only once the request has resolved with no rows", async () => {
      mockMissingReleasePages([]);

      await renderAndSettle();

      expect(
        screen.getByText("There are currently no missing releases."),
      ).toBeInTheDocument();
      expect(screen.getByText("Total missing: 0")).toBeInTheDocument();
    });

    it("renders an error, not an empty shelf, when the request fails", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/query`, () =>
          HttpResponse.json({ message: null }, { status: 500 }),
        ),
      );

      renderWithProviders(<MissingReleases />);

      await waitFor(() =>
        expect(
          screen.getByText("Error loading missing releases. Please try again."),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByText("There are currently no missing releases."),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Total missing:/)).toHaveTextContent(
        "Total missing: —",
      );
    });
  });

  describe("row rendering", () => {
    it("lists each missing release with its format, library code, artist, title, and missing-since date", async () => {
      mockMissingReleasePages([missingRow()]);

      await renderAndSettle();

      expect(screen.getByText("Vinyl")).toBeInTheDocument();
      expect(screen.getByText("Jessica Pratt")).toBeInTheDocument();
      expect(screen.getByText("On Your Own Love Again")).toBeInTheDocument();
      expect(screen.getByText("RO 55/3")).toBeInTheDocument();
      expect(screen.getByText("Total missing: 1")).toBeInTheDocument();
    });

    it("shows 'Various Artists' for compilation rows, matching the search-results convention", async () => {
      mockMissingReleasePages([
        missingRow({ artist_name: "Autechre", album_artist: "Various Artists" }),
      ]);

      await renderAndSettle();

      expect(screen.getByText("Various Artists")).toBeInTheDocument();
      expect(screen.queryByText("Autechre")).not.toBeInTheDocument();
    });

    it("falls back to 'Unknown' for an empty artist name, as the classic search results do", async () => {
      mockMissingReleasePages([missingRow({ artist_name: "" })]);

      await renderAndSettle();

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("prints the row's genre verbatim, inventing no fallback of its own", async () => {
      mockMissingReleasePages([
        missingRow({ genre_name: "Rock" }),
        missingRow({ id: 4202, album_title: "Edits", genre_name: "" }),
      ]);

      await renderAndSettle();

      const genreCellOf = (title: string) =>
        within(screen.getByText(title).closest("tr")!).getAllByRole("cell")[1];
      expect(genreCellOf("On Your Own Love Again")).toHaveTextContent("Rock");
      // The JSP's <c:out> prints nothing for a genre it has no value for, and
      // this screen must not substitute a word for it. ("Unknown" can still
      // reach the cell — the wire adapter maps a null genre_name to that
      // sentinel for every catalog screen alike — but it is never invented
      // here.)
      expect(genreCellOf("Edits")).toBeEmptyDOMElement();
    });

    it("shows 'Unknown' rather than a formatted date when date_lost is absent", async () => {
      mockMissingReleasePages([missingRow({ date_lost: undefined })]);

      await renderAndSettle();

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("truncation", () => {
    it("says the list is capped, and points at catalog search, when the server total exceeds the rows served", async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        missingRow({ id: 4300 + i, album_title: `Missing ${i}` }),
      );
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/query`, () =>
          HttpResponse.json(libraryQueryPage(rows, 512)),
        ),
      );

      await renderAndSettle();

      expect(
        screen.getByText(/Showing the first 3 of 512 missing releases/),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("link", { name: "Search Card Catalog" }).length,
      ).toBeGreaterThan(1);
    });

    it("says nothing about a cap when every missing release was served", async () => {
      mockMissingReleasePages([missingRow()]);

      await renderAndSettle();

      expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
    });
  });

  describe("Mark as Found — DJ-accessible, in place", () => {
    it("names the release in each button's accessible name, so N rows aren't N identical actions", async () => {
      mockMissingReleasePages([
        missingRow(),
        missingRow({ id: 4202, album_title: "DOGA", artist_name: "Juana Molina" }),
      ]);

      await renderAndSettle();

      expect(markFoundButton("On Your Own Love Again")).toBeInTheDocument();
      expect(markFoundButton("DOGA")).toBeInTheDocument();
    });

    it("PATCHes the release found and drops the row once the server confirms it", async () => {
      const patchedIds: string[] = [];
      mockMissingReleasePages([missingRow()], []);
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/:id/found`, ({ params }) => {
          patchedIds.push(String(params.id));
          return HttpResponse.json(missingRow({ date_found: "2026-08-13" }));
        }),
      );

      const { user } = await renderAndSettle();
      await user.click(markFoundButton("On Your Own Love Again"));

      await waitFor(() =>
        expect(
          screen.getByText("There are currently no missing releases."),
        ).toBeInTheDocument(),
      );
      expect(patchedIds).toEqual(["4201"]);
    });

    it("disables the action while its PATCH is in flight, so one click cannot become two", async () => {
      let releasePatch: (() => void) | undefined;
      const patchHeld = new Promise<void>((resolve) => {
        releasePatch = resolve;
      });
      let patchCalls = 0;
      mockMissingReleasePages([missingRow()], []);
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/:id/found`, async () => {
          patchCalls += 1;
          await patchHeld;
          return HttpResponse.json(missingRow({ date_found: "2026-08-13" }));
        }),
      );

      const { user } = await renderAndSettle();
      await user.click(markFoundButton("On Your Own Love Again"));

      await waitFor(() =>
        expect(markFoundButton("On Your Own Love Again")).toBeDisabled(),
      );
      await user.click(markFoundButton("On Your Own Love Again"));
      expect(patchCalls).toBe(1);

      releasePatch!();
      await waitFor(() =>
        expect(
          screen.getByText("There are currently no missing releases."),
        ).toBeInTheDocument(),
      );
    });

    it("tells the DJ when a mark-found fails, and leaves the row actionable", async () => {
      mockMissingReleasePages([missingRow()]);
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/:id/found`, () =>
          HttpResponse.json({ message: null }, { status: 500 }),
        ),
      );

      const { user } = await renderAndSettle();
      await user.click(markFoundButton("On Your Own Love Again"));

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      expect(mockToastError.mock.calls[0][0]).toContain("On Your Own Love Again");
      await waitFor(() =>
        expect(markFoundButton("On Your Own Love Again")).toBeEnabled(),
      );
    });

    it("offers no action on a row with no server-issued id", async () => {
      mockMissingReleasePages([
        { ...missingRow(), id: null } as unknown as AlbumSearchResultJSON,
      ]);

      await renderAndSettle();

      expect(screen.getByText("On Your Own Love Again")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Mark as Found/ }),
      ).not.toBeInTheDocument();
    });
  });
});
