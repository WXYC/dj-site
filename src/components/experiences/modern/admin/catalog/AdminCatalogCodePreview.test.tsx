import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminCatalogCodePreview from "./AdminCatalogCodePreview";

describe("AdminCatalogCodePreview", () => {
  it("renders placeholders when draft is empty", () => {
    const { container } = render(
      <AdminCatalogCodePreview
        genreName={null}
        codeLetters=""
        artistNumber={null}
        albumEntry={null}
        formatLabel={null}
      />
    );
    expect(container.textContent).toContain("&&");
    expect(container.textContent).toContain("?");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows artist number and vinyl abbreviation when set", () => {
    const { container } = render(
      <AdminCatalogCodePreview
        genreName="Rock"
        codeLetters="RO"
        artistNumber={12}
        albumEntry="?"
        formatLabel="Vinyl"
      />
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(container.textContent).toContain("VI");
  });
});
