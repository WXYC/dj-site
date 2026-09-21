import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

import MultipleArtistsDisplay from "@/src/components/experiences/classic/catalog/MultipleArtistsDisplay";

const OWNERS = [
  {
    id: 2,
    artist_name: "Various Artists - Rock - B",
    code_letters: "V/A",
    code_number: 0,
    genre_id: 11,
  },
  {
    id: 1,
    artist_name: "Various Artists - Rock - A",
    code_letters: "V/A",
    code_number: 0,
    genre_id: 11,
  },
];

describe("classic MultipleArtistsDisplay — multipleArtistsDisplay.jsp", () => {
  it("renders the Library Code / Artist Name columns in the order the response provided", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="V/A"
        codeNumber={0}
        artists={OWNERS}
        onChooseAgain={vi.fn()}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: /library code/i })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /artist name/i })).toBeInTheDocument();

    const rows = within(table).getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    // Ordering is the response's own order (server-sorted by artist_name,
    // then id) -- this component does not re-sort.
    expect(within(rows[0]).getByText("Various Artists - Rock - B")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Various Artists - Rock - A")).toBeInTheDocument();

    // Genre name + the no-punctuation call letters/numbers, per row.
    expect(within(rows[0]).getByText("Rock")).toBeInTheDocument();
    expect(within(rows[0]).getByText("V/A")).toBeInTheDocument();
  });

  // The browse is the case the per-row projection exists for. A bucket holds
  // many numbers, and the librarian reads the highest one off the bottom to
  // find the next free slot -- so a row showing the searched number (there
  // isn't one) or the first row's number would answer the wrong question
  // while looking entirely correct. The fixture carries DISTINCT numbers for
  // exactly that reason: repeating one would pass against a hoisted value.
  it("renders each row's own call number when browsing a whole call-letters bucket", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="MA"
        codeNumber={null}
        artists={[
          { id: 40, artist_name: "Magnetic Fields", code_letters: "MA", code_number: 3, genre_id: 11 },
          { id: 41, artist_name: "Mary Lattimore", code_letters: "MA", code_number: 11, genre_id: 11 },
          { id: 42, artist_name: "Mdou Moctar", code_letters: "MA", code_number: 24, genre_id: 11 },
        ]}
        onChooseAgain={vi.fn()}
      />,
    );

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("MA 3")).toBeInTheDocument();
    expect(within(rows[1]).getByText("MA 11")).toBeInTheDocument();
    expect(within(rows[2]).getByText("MA 24")).toBeInTheDocument();
  });

  // The servlet's own header is `genre.getReferenceName() + " " + artistLetters`
  // -- the partial code, with no number, because a browse has none. Composing
  // one here would put a number on screen that names a row the librarian never
  // asked about.
  it("titles a browse with the partial code, carrying no number", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="MA"
        codeNumber={null}
        artists={[
          { id: 40, artist_name: "Magnetic Fields", code_letters: "MA", code_number: 3, genre_id: 11 },
        ]}
        onChooseAgain={vi.fn()}
      />,
    );

    expect(screen.getByText("Rock MA")).toBeInTheDocument();
  });

  // `multipleArtistsDisplay.jsp`'s own `<c:otherwise>`. It was unreachable
  // while every caller was a fully-specified lookup (an unassigned code is a
  // 404, and a zero-length 200 was refused as untrustworthy), and the browse
  // is what reaches it: unused call letters answer 200 with no rows, and that
  // is a normal thing for a librarian to check.
  it("reproduces the JSP's no-results branch for an empty bucket, with no table", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="QZ"
        codeNumber={null}
        artists={[]}
        onChooseAgain={vi.fn()}
      />,
    );

    expect(
      screen.getByText("There are currently no artists in the catalog that match these criteria."),
    ).toBeInTheDocument();
    expect(screen.getByText("Rock QZ")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /artist name/i })).not.toBeInTheDocument();
  });

  it("offers another search from the empty branch, landing back on the chooser", async () => {
    const onChooseAgain = vi.fn();
    const { user } = renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="QZ"
        codeNumber={null}
        artists={[]}
        onChooseAgain={onChooseAgain}
      />,
    );

    await user.click(screen.getByRole("button", { name: /do another search/i }));

    expect(onChooseAgain).toHaveBeenCalledTimes(1);
  });

  it("renders an ordinary code's letters and number, not the V/A form", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="KU"
        codeNumber={7}
        artists={[
          { id: 10, artist_name: "Kurt Vile", code_letters: "KU", code_number: 7, genre_id: 11 },
          { id: 11, artist_name: "Kurupt", code_letters: "KU", code_number: 7, genre_id: 11 },
        ]}
        onChooseAgain={vi.fn()}
      />,
    );

    expect(screen.getAllByText("KU 7")).toHaveLength(2);
  });

  // The JSP's row link says `mode=view`, but ArtistViewServlet never reads
  // `mode` and forwards to the modify card for an admin -- the only role that
  // can reach this screen. So the affordance is the same destination a
  // single-match code search lands on, not the DJ-facing display card. Which
  // modify card it forwards to is decided by the row: these owners collide on
  // one code precisely because they are compilation buckets, and a bucket is
  // edited as a shelf section rather than as a performer.
  it("links each compilation bucket to the bucket card its filing model belongs to", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="V/A"
        codeNumber={0}
        artists={OWNERS}
        onChooseAgain={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Various Artists - Rock - A" });
    expect(link).toHaveAttribute("href", "/dashboard/library/various/1");
    const other = screen.getByRole("link", { name: "Various Artists - Rock - B" });
    expect(other).toHaveAttribute("href", "/dashboard/library/various/2");
  });

  it("links an ordinary artist sharing a code to the artist card instead", () => {
    renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="KU"
        codeNumber={7}
        artists={[
          { id: 31, artist_name: "Stereolab", code_letters: "KU", code_number: 7, genre_id: 3 },
        ]}
        onChooseAgain={vi.fn()}
      />,
    );

    // Scoped to the row's own genre. This screen exists because one code
    // reached several artists, so an unscoped link would undo the
    // disambiguation it was rendered to perform.
    expect(screen.getByRole("link", { name: "Stereolab" })).toHaveAttribute(
      "href",
      "/dashboard/library/artist/31?genre_id=3",
    );
  });

  it("returns to the chooser via the Choose/Add Library Codes affordance", async () => {
    const onChooseAgain = vi.fn();
    const { user } = renderWithProviders(
      <MultipleArtistsDisplay
        genreName="Rock"
        codeLetters="V/A"
        codeNumber={0}
        artists={OWNERS}
        onChooseAgain={onChooseAgain}
      />,
    );

    await user.click(screen.getByRole("button", { name: /choose\/add library codes/i }));

    expect(onChooseAgain).toHaveBeenCalledTimes(1);
  });
});
