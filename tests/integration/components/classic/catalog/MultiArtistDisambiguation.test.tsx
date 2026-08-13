import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import MultiArtistDisambiguation from "@/src/components/experiences/classic/catalog/MultiArtistDisambiguation";

describe("classic MultiArtistDisambiguation — multipleArtistsDisplay.jsp", () => {
  it("renders the match table with the JSP's Library Code / Artist Name headers", () => {
    renderWithProviders(
      <MultiArtistDisambiguation
        partialLibraryCode="MO"
        artistLibraryCodes={[
          { id: 1, genreName: "Rock", callLettersAndNumbers: "MO1", presentationName: "Juana Molina" },
          { id: 2, genreName: "Rock", callLettersAndNumbers: "MO2", presentationName: "Stereolab" },
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Library Code" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Artist Name" })).toBeInTheDocument();
    expect(screen.getByText("Juana Molina")).toBeInTheDocument();
    expect(screen.getByText("Stereolab")).toBeInTheDocument();
    expect(screen.getAllByText("Rock")).toHaveLength(2);
    expect(screen.getByText("MO1")).toBeInTheDocument();
    expect(screen.getByText("MO2")).toBeInTheDocument();
  });

  it("links each row to its artist card by id", () => {
    renderWithProviders(
      <MultiArtistDisambiguation
        partialLibraryCode="MO"
        artistLibraryCodes={[
          { id: 42, genreName: "Rock", callLettersAndNumbers: "MO1", presentationName: "Juana Molina" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Juana Molina" })).toHaveAttribute(
      "href",
      "/dashboard/library/artist/42",
    );
  });

  it("shows the JSP's exact no-match copy and a link back to search when there are no matches", () => {
    renderWithProviders(<MultiArtistDisambiguation partialLibraryCode="ZZ" artistLibraryCodes={[]} />);

    expect(
      screen.getByText("There are currently no artists in the catalog that match these criteria."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Do another search" })).toHaveAttribute(
      "href",
      "/dashboard/library",
    );
  });

  it("shows the partial library code as the page title text", () => {
    renderWithProviders(<MultiArtistDisambiguation partialLibraryCode="MO" artistLibraryCodes={[]} />);

    expect(screen.getByText("MO")).toBeInTheDocument();
  });
});
