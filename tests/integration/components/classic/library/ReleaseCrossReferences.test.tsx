import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReleaseCrossReferenceRow } from "@/lib/features/catalog/types";
import {
  createTestReleaseCrossReference,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import ReleaseCrossReferences from "@/src/components/experiences/classic/library/ReleaseCrossReferences";

const RELEASE_XREF_URL = `${TEST_BACKEND_URL}/library/crossreferences/releases`;
const GENRES_URL = `${TEST_BACKEND_URL}/library/genres`;

function mockCrossReferences(
  rows: ReleaseCrossReferenceRow[],
  total = rows.length,
) {
  server.use(
    http.get(GENRES_URL, () =>
      HttpResponse.json([
        { id: TEST_ENTITY_IDS.GENRE.JAZZ, genre_name: "Jazz", plays: 0 },
      ]),
    ),
    http.get(RELEASE_XREF_URL, () =>
      HttpResponse.json({
        results: rows,
        total,
        page: 0,
        totalPages: Math.max(1, Math.ceil(total / 500)),
      }),
    ),
  );
}

async function cellsOfFirstRow(): Promise<HTMLElement[]> {
  const row = await screen.findByTestId("release-crossreference-row");
  return within(row).getAllByRole("cell");
}

describe("classic library-release cross-references — xrefsToLibraryReleases.jsp", () => {
  it("renders the JSP's title row", async () => {
    mockCrossReferences([createTestReleaseCrossReference()]);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(
      await screen.findByText("Cross-References to Library Releases"),
    ).toBeInTheDocument();
  });

  // Four of the JSP's five column headers. Time Last Modified is absent
  // because `artist_library_crossreference` carries no timestamp column.
  it("renders the reproducible column headers, and no Time Last Modified", async () => {
    mockCrossReferences([createTestReleaseCrossReference()]);

    renderWithProviders(<ReleaseCrossReferences />);

    await screen.findByText("Cross-Referencing Artist");
    expect(screen.getByText("Cross-Referenced Release Code")).toBeInTheDocument();
    expect(screen.getByText("Cross-Referenced Release Name")).toBeInTheDocument();
    expect(screen.getByText("Comment")).toBeInTheDocument();
    expect(screen.queryByText(/time last modified/i)).not.toBeInTheDocument();
  });

  it("links the cross-referencing artist to its own card", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({
        artist_id: 4102,
        artist_name: "Duke Ellington & John Coltrane",
      }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(
      await screen.findByRole("link", { name: "Duke Ellington & John Coltrane" }),
    ).toHaveAttribute("href", "/dashboard/library/artist/4102");
  });

  // `getEntireLibraryCode()`: the genre, the artist half with its punctuation,
  // then the release half.
  it("renders the whole call number, linked to the release", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({ library_id: 20114, code_volume_letters: null }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(await screen.findByRole("link", { name: "Jazz CO 7/3" })).toHaveAttribute(
      "href",
      "/dashboard/library/release/20114",
    );
  });

  // `getEntireArtistTitleString()` — the release's own artist, which is
  // whoever it is filed under, not the artist the cross-reference hangs off.
  it("renders the release's own artist and title, then its format", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({
        library_id: 20114,
        album_artist_name: "John Coltrane",
        album_title: "A Love Supreme",
        format_name: "Vinyl",
      }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    const [, , nameCell] = await cellsOfFirstRow();
    expect(nameCell).toHaveTextContent("John Coltrane - A Love Supreme (Vinyl)");
    expect(
      within(nameCell).getByRole("link", {
        name: /John Coltrane - A Love Supreme/,
      }),
    ).toHaveAttribute("href", "/dashboard/library/release/20114");
  });

  it("prefers the release's alternate artist name over the artist it is filed under", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({
        alternate_artist_name: "Duke Ellington & John Coltrane",
        album_artist_name: "John Coltrane",
        album_title: "A Love Supreme",
      }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    const [, , nameCell] = await cellsOfFirstRow();
    expect(nameCell).toHaveTextContent(
      "Duke Ellington & John Coltrane - A Love Supreme (Vinyl)",
    );
  });

  // The endpoint LEFT joins `genre_artist_crossreference` so a frozen legacy
  // row can never vanish, which is where a null artist number comes from.
  it("renders a call number for a release whose artist has no genre code", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({ code_artist_number: null }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(await screen.findByRole("link", { name: "Jazz CO/3" })).toBeInTheDocument();
  });

  it("renders the comment", async () => {
    mockCrossReferences([
      createTestReleaseCrossReference({ comment: "See also Barry Black" }),
    ]);

    renderWithProviders(<ReleaseCrossReferences />);

    const cells = await cellsOfFirstRow();
    expect(cells[3]).toHaveTextContent("See also Barry Black");
  });

  it("renders the JSP's empty state for an empty collection", async () => {
    mockCrossReferences([]);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(
      await screen.findByText("There are no Library Release Cross-References"),
    ).toBeInTheDocument();
  });

  it("reports an outage instead of claiming the collection is empty", async () => {
    server.use(http.get(RELEASE_XREF_URL, () => HttpResponse.error()));

    renderWithProviders(<ReleaseCrossReferences />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be loaded/i,
    );
    expect(
      screen.queryByText("There are no Library Release Cross-References"),
    ).not.toBeInTheDocument();
  });

  it("states the cap when the collection is larger than one page", async () => {
    mockCrossReferences([createTestReleaseCrossReference()], 640);

    renderWithProviders(<ReleaseCrossReferences />);

    expect(await screen.findByText(/showing the first 1 of 640/i)).toBeInTheDocument();
  });

  it("offers no control that could write to the collection", async () => {
    mockCrossReferences([createTestReleaseCrossReference()]);

    renderWithProviders(<ReleaseCrossReferences />);

    await screen.findByTestId("release-crossreference-row");
    await waitFor(() => {
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
