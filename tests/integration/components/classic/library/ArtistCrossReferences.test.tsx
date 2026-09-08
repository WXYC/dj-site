import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ArtistCrossReferenceRow } from "@/lib/features/catalog/types";
import {
  createTestArtistCrossReference,
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

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import ArtistCrossReferences from "@/src/components/experiences/classic/library/ArtistCrossReferences";

const ARTIST_XREF_URL = `${TEST_BACKEND_URL}/library/crossreferences/artists`;

function mockCrossReferences(
  rows: ArtistCrossReferenceRow[],
  total = rows.length,
) {
  server.use(
    http.get(ARTIST_XREF_URL, () =>
      HttpResponse.json({
        results: rows,
        total,
        page: 0,
        totalPages: Math.max(1, Math.ceil(total / 500)),
      }),
    ),
  );
}

/** The row cells, in the order `xrefsToLibraryCodes.jsp` renders them. */
async function cellsOfFirstRow(): Promise<HTMLElement[]> {
  const row = await screen.findByTestId("artist-crossreference-row");
  return within(row).getAllByRole("cell");
}

describe("classic library-code cross-references — xrefsToLibraryCodes.jsp", () => {
  it("renders the JSP's title row", async () => {
    mockCrossReferences([createTestArtistCrossReference()]);

    renderWithProviders(<ArtistCrossReferences />);

    expect(
      await screen.findByText("Cross-References to Library Codes"),
    ).toBeInTheDocument();
  });

  // Three of the JSP's four column headers. Time Last Modified is absent
  // because `artist_crossreference` carries no timestamp column to render.
  it("renders the reproducible column headers, and no Time Last Modified", async () => {
    mockCrossReferences([createTestArtistCrossReference()]);

    renderWithProviders(<ArtistCrossReferences />);

    await screen.findByText("Cross-Referencing Artist");
    expect(screen.getByText("Cross-Referenced Library Code")).toBeInTheDocument();
    expect(screen.getByText("Comment")).toBeInTheDocument();
    expect(screen.queryByText(/time last modified/i)).not.toBeInTheDocument();
  });

  it("links the cross-referencing artist to its own card", async () => {
    mockCrossReferences([
      createTestArtistCrossReference({
        source_artist_id: 4102,
        source_artist_name: "Duke Ellington & John Coltrane",
      }),
    ]);

    renderWithProviders(<ArtistCrossReferences />);

    expect(
      await screen.findByRole("link", { name: "Duke Ellington & John Coltrane" }),
    ).toHaveAttribute("href", "/dashboard/library/artist/4102");
  });

  // The JSP's second column is the target's `fullLibraryCode`, then its
  // presentation name.
  it("renders the cross-referenced code and name, with the code linked", async () => {
    mockCrossReferences([
      createTestArtistCrossReference({
        target_artist_id: 991,
        target_artist_name: "Duke Ellington",
        target_code_letters: "EL",
        target_code_artist_number: 12,
      }),
    ]);

    renderWithProviders(<ArtistCrossReferences />);

    expect(await screen.findByRole("link", { name: "EL 12" })).toHaveAttribute(
      "href",
      "/dashboard/library/artist/991",
    );
    const [, codeCell] = await cellsOfFirstRow();
    expect(codeCell).toHaveTextContent("EL 12 - Duke Ellington");
  });

  // The card a compilation bucket belongs on is decided structurally, on
  // `code_letters`, wherever a link to an artist is built.
  it("routes a Various Artists target to the bucket card", async () => {
    mockCrossReferences([
      createTestArtistCrossReference({
        target_artist_id: 777,
        target_artist_name: "Various Artists - Rock - K",
        target_code_letters: "V/A",
        target_code_artist_number: null,
      }),
    ]);

    renderWithProviders(<ArtistCrossReferences />);

    expect(await screen.findByRole("link", { name: "V/A" })).toHaveAttribute(
      "href",
      "/dashboard/library/various/777",
    );
  });

  it("renders the comment", async () => {
    mockCrossReferences([
      createTestArtistCrossReference({ comment: "Filed with Duke Ellington" }),
    ]);

    renderWithProviders(<ArtistCrossReferences />);

    const cells = await cellsOfFirstRow();
    expect(cells[2]).toHaveTextContent("Filed with Duke Ellington");
  });

  it("leaves the comment cell empty when the row carries none", async () => {
    mockCrossReferences([createTestArtistCrossReference({ comment: null })]);

    renderWithProviders(<ArtistCrossReferences />);

    const cells = await cellsOfFirstRow();
    expect(cells[2]).toHaveTextContent("");
  });

  it("renders the JSP's empty state for an empty collection", async () => {
    mockCrossReferences([]);

    renderWithProviders(<ArtistCrossReferences />);

    expect(
      await screen.findByText("There are no Library Code Cross-References"),
    ).toBeInTheDocument();
  });

  // A failed read must never render as the empty state: that state is a
  // positive claim about a frozen collection this screen is the only way to
  // see, and the endpoint answers a genuinely empty one 200 with `total: 0`.
  it("reports an outage instead of claiming the collection is empty", async () => {
    server.use(http.get(ARTIST_XREF_URL, () => HttpResponse.error()));

    renderWithProviders(<ArtistCrossReferences />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be loaded/i,
    );
    expect(
      screen.queryByText("There are no Library Code Cross-References"),
    ).not.toBeInTheDocument();
  });

  it("states the cap when the collection is larger than one page", async () => {
    mockCrossReferences([createTestArtistCrossReference()], 640);

    renderWithProviders(<ArtistCrossReferences />);

    expect(await screen.findByText(/showing the first 1 of 640/i)).toBeInTheDocument();
  });

  it("says nothing about a cap when the whole collection arrived", async () => {
    mockCrossReferences([createTestArtistCrossReference()]);

    renderWithProviders(<ArtistCrossReferences />);

    await screen.findByTestId("artist-crossreference-row");
    expect(screen.queryByText(/showing the first/i)).not.toBeInTheDocument();
  });

  // WXYC/wiki#89 freezes this collection: the screen exists so it can be
  // seen, and nothing on it may offer to change it.
  it("offers no control that could write to the collection", async () => {
    mockCrossReferences([createTestArtistCrossReference()]);

    renderWithProviders(<ArtistCrossReferences />);

    await screen.findByTestId("artist-crossreference-row");
    await waitFor(() => {
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
