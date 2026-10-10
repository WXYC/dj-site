import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import RecordRow from "@/src/components/experiences/modern/reviews/RecordRow";
import RecordHeader from "@/src/components/experiences/modern/reviews/RecordHeader";

const record = { artist: "Juana Molina", album: "DOGA", label: "Sonamos" };
const glyph = (container: HTMLElement) => container.querySelector("[data-tone]");

describe("RecordRow", () => {
  it.each([
    ["Vinyl", "formatVinyl", "Vinyl"],
    ["CD", "formatCd", "CD"],
    ["cd", "formatCd", "CD"],
    ["Cassette", "neutral", "Cassette"],
    [undefined, "neutral", null],
  ])("tones the glyph for format %s as %s and tags it %s", (format, tone, tag) => {
    const { container } = renderWithProviders(<RecordRow record={{ ...record, format }} />);
    expect(glyph(container)).toHaveAttribute("data-tone", tone);
    expect(glyph(container)).toHaveAttribute("aria-hidden", "true");
    if (tag) expect(screen.getByText(tag)).toBeInTheDocument();
    else expect(container.querySelector(".MuiChip-root")).toBeNull();
  });

  it("resolves a format id through the formats list when the record carries no name", () => {
    const { container } = renderWithProviders(
      <RecordRow record={{ ...record, formatId: 7 }} formats={[{ id: 7, format_name: "Vinyl" }]} />,
    );
    expect(glyph(container)).toHaveAttribute("data-tone", "formatVinyl");
  });

  it("shows the artist, album and label as separate elements, and omits an empty label", () => {
    const { rerender } = renderWithProviders(<RecordRow record={{ ...record, format: "CD" }} />);
    for (const part of ["Juana Molina", "DOGA", "Sonamos"]) {
      expect(screen.getByText(part).textContent).toBe(part);
    }
    rerender(<RecordRow record={{ ...record, label: "", format: "CD" }} />);
    expect(screen.queryByText("Sonamos")).not.toBeInTheDocument();
  });

  it("places meta, actions and status in their slots, and no divider without a status", () => {
    const { rerender } = renderWithProviders(
      <RecordRow record={record} meta={<span>Asked Aug 31, 2025</span>} actions={<button>Accept</button>} />,
    );
    expect(screen.getByText("Asked Aug 31, 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    rerender(<RecordRow record={record} status={<span>Taken Sep 2</span>} />);
    expect(screen.getByText("Taken Sep 2")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("links the artist when given an href", () => {
    renderWithProviders(<RecordRow record={record} href="/dashboard/admin/intake/3" />);
    expect(screen.getByRole("link", { name: "Juana Molina" })).toHaveAttribute("href", "/dashboard/admin/intake/3");
  });
});

describe("RecordHeader", () => {
  it("renders the artist as a heading with the album, label, format tag and chip slot", () => {
    renderWithProviders(<RecordHeader record={{ ...record, format: "Vinyl" }} chip={<span>On the review shelf</span>} />);
    expect(screen.getByRole("heading", { level: 3, name: "Juana Molina" })).toBeInTheDocument();
    const text = within(document.body);
    expect(text.getByText("DOGA")).toBeInTheDocument();
    expect(text.getByText("Sonamos")).toBeInTheDocument();
    expect(text.getByText("Vinyl")).toBeInTheDocument();
    expect(text.getByText("On the review shelf")).toBeInTheDocument();
  });
});
