import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Link } from "@mui/joy";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import RecordRow from "@/src/components/experiences/modern/reviews/RecordRow";
import RecordHeader from "@/src/components/experiences/modern/reviews/RecordHeader";

const record = { artist: "Juana Molina", album: "DOGA", label: "Sonamos" };
const glyph = (container: HTMLElement) => container.querySelector("[data-tone]");
const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const chipClass = (container: HTMLElement) => container.querySelector(".MuiChip-root")?.className;

/** Serves the library's formats and counts the reads. */
function serveFormats() {
  const reads = { count: 0 };
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/formats`, () => {
      reads.count += 1;
      return HttpResponse.json([{ id: 7, format_name: "Vinyl" }]);
    }),
  );
  return reads;
}

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

  it("resolves a format id through the library's formats when the record carries no name", async () => {
    serveFormats();
    const { container } = renderWithProviders(<RecordRow record={{ ...record, formatId: 7 }} />);
    await waitFor(() => expect(glyph(container)).toHaveAttribute("data-tone", "formatVinyl"));
    expect(screen.getByText("Vinyl")).toBeInTheDocument();
  });

  it("shows the neutral glyph and no tag for a format id the library does not know", async () => {
    const reads = serveFormats();
    const { container } = renderWithProviders(<RecordRow record={{ ...record, formatId: 99 }} />);
    await waitFor(() => expect(reads.count).toBe(1));
    await waitFor(() => expect(glyph(container)).toHaveAttribute("data-tone", "neutral"));
    expect(container.querySelector(".MuiChip-root")).toBeNull();
  });

  it("prefers the record's own format name to the library's, and reads no formats for it", async () => {
    const reads = serveFormats();
    const { container } = renderWithProviders(<RecordRow record={{ ...record, formatId: 7, format: "CD" }} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(glyph(container)).toHaveAttribute("data-tone", "formatCd");
    expect(reads.count).toBe(0);
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

  it("puts meta under the title with the record's parts, the actions in their own region, and the status after both under the divider", () => {
    renderWithProviders(
      <RecordRow
        record={{ ...record, format: "CD" }}
        meta={<span>Asked Aug 31, 2025</span>}
        actions={<button>Accept</button>}
        status={<span>Taken Sep 2</span>}
      />,
    );
    const artist = screen.getByText("Juana Molina");
    const album = screen.getByText("DOGA");
    const meta = screen.getByText("Asked Aug 31, 2025");
    const actions = screen.getByRole("button", { name: "Accept" }).parentElement as HTMLElement;
    const status = screen.getByText("Taken Sep 2");
    const separator = screen.getByRole("separator");
    // Meta shares the record's column, after its last part.
    expect(artist.parentElement).toContainElement(meta);
    expect(follows(album, meta)).toBe(true);
    // The actions sit in a region apart from the record and the meta.
    expect(actions).not.toContainElement(artist);
    expect(actions).not.toContainElement(meta);
    expect(actions).not.toContainElement(status);
    expect(follows(meta, actions)).toBe(true);
    // The status comes last, under the divider.
    expect(follows(actions, separator)).toBe(true);
    expect(follows(separator, status)).toBe(true);
  });

  it("gives a vinyl row and a CD row format tags of different tones, and the tag matches its glyph", () => {
    const vinyl = renderWithProviders(<RecordRow record={{ ...record, format: "Vinyl" }} />);
    const vinylClass = chipClass(vinyl.container);
    vinyl.unmount();
    const cd = renderWithProviders(<RecordRow record={{ ...record, format: "CD" }} />);
    const cdClass = chipClass(cd.container);
    expect(vinylClass).toBeTruthy();
    expect(cdClass).toBeTruthy();
    expect(vinylClass).not.toBe(cdClass);
    expect(vinylClass).toMatch(/MuiChip-colorFormatVinyl/);
    expect(cdClass).toMatch(/MuiChip-colorFormatCd/);
  });

  it("renders a titleSlot link with its id in place of the artist, and a control labelled by that id takes its name from it", () => {
    renderWithProviders(
      <>
        <RecordRow record={record} href="/ignored" titleSlot={<Link id="record-3" href="/dashboard/admin/intake/3">Juana Molina</Link>} />
        <select aria-labelledby="record-3">
          <option>Anyone</option>
        </select>
      </>,
    );
    const link = screen.getByRole("link", { name: "Juana Molina" });
    expect(link).toHaveAttribute("id", "record-3");
    expect(link).toHaveAttribute("href", "/dashboard/admin/intake/3");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Juana Molina" })).toBeInTheDocument();
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

  it("resolves an intake record's format id through the library's formats, for the tag and the toned glyph", async () => {
    serveFormats();
    const { container } = renderWithProviders(<RecordHeader record={{ ...record, formatId: 7 }} />);
    expect(await screen.findByText("Vinyl")).toBeInTheDocument();
    expect(glyph(container)).toHaveAttribute("data-tone", "formatVinyl");
  });
});
