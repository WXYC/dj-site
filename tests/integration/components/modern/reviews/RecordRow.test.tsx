import { beforeEach, describe, it, expect, vi } from "vitest";
import { toast } from "sonner";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Link } from "@mui/joy";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import RecordRow from "@/src/components/experiences/modern/reviews/RecordRow";
import RecordHeader from "@/src/components/experiences/modern/reviews/RecordHeader";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

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

const ALL_LINKS = [
  { label: "Spotify", href: "https://open.spotify.com/album/1" },
  { label: "Apple Music", href: "https://music.apple.com/us/album/2" },
  { label: "Bandcamp", href: "https://juanamolina.bandcamp.com/album/doga" },
  { label: "Discogs", href: "https://www.discogs.com/release/42" },
];
const LINKS = [ALL_LINKS[0], ALL_LINKS[3]];
/** A link's full accessible name: the service, then the record's artist and album, then the new-tab hint. */
const linkName = (service: string, artist: string, album: string) => `${service} ${artist} ${album} ${REVIEW_COPY.listen.newTab}`;

describe("RecordRow", () => {
  it("draws the lead-in and the links in order, each opening in a new tab with noopener", () => {
    renderWithProviders(<RecordRow record={{ ...record, links: LINKS }} />);
    expect(screen.getByText("Preview:")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Spotify", "Discogs"]);
    links.forEach((l, i) => {
      expect(l).toHaveAttribute("href", LINKS[i].href);
      expect(l).toHaveAttribute("target", "_blank");
      expect(l.getAttribute("rel")).toContain("noopener");
    });
  });

  it.each([[undefined], [[]]])("draws no group and no lead-in for links %j", (links) => {
    renderWithProviders(<RecordRow record={{ ...record, links }} />);
    expect(screen.queryByText("Preview:")).toBeNull();
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it.each([
    ["a row", <RecordRow key="row" record={{ ...record, links: LINKS }} />],
    ["a row with a caller's album id", <RecordRow key="album-id" record={{ ...record, links: LINKS }} albumId="album-1" />],
    ["a row with its own title link", <RecordRow key="title" record={{ ...record, links: LINKS }} titleSlot={<Link id="record-3" href="/dashboard/admin/intake/3">Juana Molina</Link>} titleId="record-3" />],
    ["the record's header", <RecordHeader key="header" record={{ ...record, links: LINKS }} />],
  ])("names each link on %s by its service, the record and the new tab", (_where, ui) => {
    renderWithProviders(ui);
    expect(screen.getByRole("link", { name: linkName("Spotify", "Juana Molina", "DOGA") })).toHaveAttribute("href", LINKS[0].href);
    expect(screen.getByRole("link", { name: linkName("Discogs", "Juana Molina", "DOGA") })).toHaveAttribute("href", LINKS[1].href);
  });

  it("names two rows' links apart by their records", () => {
    renderWithProviders(
      <>
        <RecordRow record={{ ...record, links: LINKS }} />
        <RecordRow record={{ artist: "Cat Power", album: "Moon Pix", label: "Matador", links: LINKS }} />
      </>,
    );
    expect(screen.getByRole("link", { name: linkName("Spotify", "Juana Molina", "DOGA") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: linkName("Spotify", "Cat Power", "Moon Pix") })).toBeInTheDocument();
  });

  it.each([
    [1, ["Preview:", "Spotify"]],
    [2, ["Preview:", "Spotify", "·", "Apple Music"]],
    [4, ["Preview:", "Spotify", "·", "Apple Music", "·", "Bandcamp", "·", "Discogs"]],
  ])("puts an unspoken middle dot between each of %i links, and none at either end", (count, parts) => {
    renderWithProviders(<RecordRow record={{ ...record, links: ALL_LINKS.slice(0, count) }} />);
    const group = screen.getByText("Preview:").parentElement!;
    const shown = Array.from(group.children).filter((el) => !(el as HTMLElement).hidden);
    expect(shown.map((el) => el.textContent)).toEqual(parts);
    shown.filter((el) => el.textContent === "·").forEach((dot) => expect(dot).toHaveAttribute("aria-hidden", "true"));
  });

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

  it("puts the id it is given on the album line, and on no other part", () => {
    renderWithProviders(<RecordRow record={{ ...record, format: "CD" }} albumId="album-1" />);
    expect(screen.getByText("DOGA")).toHaveAttribute("id", "album-1");
    expect(screen.getByText("Juana Molina")).not.toHaveAttribute("id");
    expect(screen.getByText("Sonamos")).not.toHaveAttribute("id");
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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Answers the metadata proxy's album read and counts the reads. */
function serveArtwork(respond: (releaseTitle: string | null) => Response | Promise<Response>) {
  const reads = { count: 0 };
  server.use(
    http.get(`${TEST_BACKEND_URL}/proxy/metadata/album`, ({ request }) => {
      reads.count += 1;
      return respond(new URL(request.url).searchParams.get("releaseTitle"));
    }),
  );
  return reads;
}

describe("RecordRow cover", () => {
  const COVER_URL = "https://img.example/doga.jpg";
  const cover = (container: HTMLElement) => container.querySelector("img");

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it.each([72, 56] as const)("shows the record's cover at %i px with an empty alt", async (size) => {
    serveArtwork(() => HttpResponse.json({ artworkUrl: COVER_URL }));
    const { container } = renderWithProviders(<RecordRow record={record} cover={size} />);
    await waitFor(() => expect(cover(container)).toHaveAttribute("src", COVER_URL));
    expect(cover(container)).toHaveAttribute("alt", "");
    expect(cover(container)).toHaveAttribute("loading", "lazy");
    expect(cover(container)).toHaveStyle({ width: `${size}px`, height: `${size}px` });
    expect(glyph(container)).toBeNull();
  });

  it.each([
    ["while loading", () => new Promise<Response>(() => {})],
    // A body with a `message` is one the shared error middleware would toast, so only the read's own scoping keeps it quiet.
    ["on an error", () => HttpResponse.json({ message: "Metadata service unavailable" }, { status: 500 })],
    ["on a network failure", () => HttpResponse.error()],
    ["with no artwork", () => HttpResponse.json({ artworkUrl: null })],
  ])("keeps the format glyph at the cover's size %s, never the cassette", async (_case, respond) => {
    const reads = serveArtwork(respond);
    const { container } = renderWithProviders(<RecordRow record={{ ...record, format: "Vinyl" }} cover={56} />);
    await waitFor(() => expect(reads.count).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cover(container)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(glyph(container)).toHaveStyle({ width: "56px", height: "56px" });
  });

  it("falls back to the glyph at the cover's size when the cover will not load, and shows the next record's cover in the same row", async () => {
    const covers: Record<string, string> = { DOGA: COVER_URL, "Aluminum Tunes": "https://img.example/aluminum-tunes.jpg" };
    serveArtwork((title) => HttpResponse.json({ artworkUrl: (title && covers[title]) ?? null }));
    const { container, rerender } = renderWithProviders(<RecordRow record={{ ...record, format: "Vinyl" }} cover={72} />);
    await waitFor(() => expect(cover(container)).toHaveAttribute("src", COVER_URL));

    fireEvent.error(cover(container)!);

    expect(cover(container)).toBeNull();
    expect(glyph(container)).toHaveStyle({ width: "72px", height: "72px" });

    rerender(<RecordRow record={{ artist: "Stereolab", album: "Aluminum Tunes", label: "Duophonic", format: "Vinyl" }} cover={72} />);
    await waitFor(() => expect(cover(container)).toHaveAttribute("src", covers["Aluminum Tunes"]));
    expect(glyph(container)).toBeNull();
  });

  // RTK Query keeps the previous argument's answer in `data` while the next read is pending or after it fails; the row must not draw it.
  it.each([
    ["is pending", () => new Promise<Response>(() => {})],
    ["fails", () => HttpResponse.json({ message: "Metadata service unavailable" }, { status: 500 })],
  ])("shows the glyph, not the previous record's cover, when the row is drawn for another record whose read %s", async (_case, respond) => {
    const reads = serveArtwork((title) => (title === "DOGA" ? HttpResponse.json({ artworkUrl: COVER_URL }) : respond()));
    const { container, rerender } = renderWithProviders(<RecordRow record={{ ...record, format: "Vinyl" }} cover={72} />);
    await waitFor(() => expect(cover(container)).toHaveAttribute("src", COVER_URL));

    rerender(<RecordRow record={{ artist: "Stereolab", album: "Aluminum Tunes", label: "Duophonic", format: "Vinyl" }} cover={72} />);

    expect(cover(container)).toBeNull();
    await waitFor(() => expect(reads.count).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cover(container)).toBeNull();
    expect(glyph(container)).toHaveStyle({ width: "72px", height: "72px" });
  });

  it("makes no metadata read for a blank album, and keeps the glyph", async () => {
    const reads = serveArtwork(() => HttpResponse.json({ artworkUrl: COVER_URL }));
    const { container } = renderWithProviders(<RecordRow record={{ ...record, album: "" }} cover={72} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads.count).toBe(0);
    expect(glyph(container)).toBeInTheDocument();
  });

  it("asks for no cover, and reads nothing, when no cover size is given", async () => {
    const reads = serveArtwork(() => HttpResponse.json({ artworkUrl: COVER_URL }));
    const { container } = renderWithProviders(<RecordRow record={record} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads.count).toBe(0);
    expect(cover(container)).toBeNull();
    expect(glyph(container)).toHaveStyle({ width: "40px" });
  });
});

describe("RecordHeader", () => {
  it.each([[true, 2], [false, 0]])("with withLinks %s draws %i links", (withLinks, count) => {
    renderWithProviders(<RecordHeader record={{ ...record, links: LINKS }} withLinks={withLinks} />);
    expect(screen.queryAllByRole("link")).toHaveLength(count);
  });

  it("renders the artist as a heading with the album, label, format tag and chip slot", () => {
    renderWithProviders(<RecordHeader record={{ ...record, format: "Vinyl" }} chip={<span>On the review shelf</span>} />);
    expect(screen.getByRole("heading", { level: 2, name: "Juana Molina" })).toBeInTheDocument();
    const text = within(document.body);
    expect(text.getByText("DOGA")).toBeInTheDocument();
    expect(text.getByText("Sonamos")).toBeInTheDocument();
    expect(text.getByText("Vinyl")).toBeInTheDocument();
    expect(text.getByText("On the review shelf")).toBeInTheDocument();
  });

  it.each([
    { headingLevel: undefined, level: 2 },
    { headingLevel: 2 as const, level: 2 },
    { headingLevel: 3 as const, level: 3 },
  ])("renders the artist at level $level when headingLevel is $headingLevel", ({ headingLevel, level }) => {
    renderWithProviders(<RecordHeader record={record} headingLevel={headingLevel} />);
    expect(screen.getByRole("heading", { name: "Juana Molina" })).toHaveProperty("tagName", `H${level}`);
  });

  it("resolves an intake record's format id through the library's formats, for the tag and the toned glyph", async () => {
    serveFormats();
    const { container } = renderWithProviders(<RecordHeader record={{ ...record, formatId: 7 }} />);
    expect(await screen.findByText("Vinyl")).toBeInTheDocument();
    expect(glyph(container)).toHaveAttribute("data-tone", "formatVinyl");
  });
});
