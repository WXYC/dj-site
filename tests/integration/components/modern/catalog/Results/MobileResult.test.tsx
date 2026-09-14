import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist, renderWithProviders } from "@/tests/helpers";
import { RotationBin } from "@/lib/features/rotation/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useLiveStatus: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
}));

// The bin control reaches useRegistry -> useAuthentication -> the better-auth
// session store, whose deferred teardown outlives this file's jsdom environment.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

import CatalogMobileResult from "@/src/components/experiences/modern/catalog/Results/MobileResult";

describe("CatalogMobileResult", () => {
  const album = createTestAlbum({
    title: "On Your Own Love Again",
    artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 87 }),
    entry: 4,
    format: "Vinyl",
    plays: 42,
    label: "Drag City",
  });

  it("renders album title, artist, and the stacked metadata line", () => {
    renderWithProviders(<CatalogMobileResult album={album} live={false} addToQueue={vi.fn()} />);

    expect(screen.getByText("On Your Own Love Again")).toBeDefined();
    expect(screen.getByText("Jessica Pratt")).toBeDefined();
    // call # · plays · label all on one stacked metadata line
    const meta = screen.getByText(/RO 87\/4/);
    expect(meta.textContent).toContain("42 plays");
    expect(meta.textContent).toContain("Drag City");
  });

  it("renders genre and format chips", () => {
    renderWithProviders(<CatalogMobileResult album={album} live={false} addToQueue={vi.fn()} />);
    expect(screen.getByText(album.artist.genre)).toBeDefined();
    expect(screen.getByText("Vinyl")).toBeDefined();
  });

  it("omits empty metadata segments", () => {
    renderWithProviders(
      <CatalogMobileResult album={createTestAlbum({ ...album, plays: 0, label: "" })} live={false} addToQueue={vi.fn()} />
    );
    const meta = screen.getByText(/RO 87\/4/);
    expect(meta.textContent).not.toContain("plays");
    expect(meta.textContent?.trim()).toBe("RO 87/4");
  });

  it("does not render a selection checkbox on mobile", () => {
    renderWithProviders(<CatalogMobileResult album={album} live={false} addToQueue={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows the WXYC EXCLUSIVE chip when not on streaming", () => {
    renderWithProviders(
      <CatalogMobileResult album={createTestAlbum({ ...album, on_streaming: false })} live={false} addToQueue={vi.fn()} />
    );
    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
  });
});

describe("CatalogMobileResult album artwork", () => {
  const artworkAlbum = createTestAlbum({
    title: "On Your Own Love Again",
    artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 87 }),
  });

  it("renders album artwork when artwork_url is provided", () => {
    const withArtwork = createTestAlbum({
      ...artworkAlbum,
      artwork_url: "https://i.discogs.com/on-your-own-love-again.jpg",
    });

    renderWithProviders(<CatalogMobileResult album={withArtwork} live={false} addToQueue={vi.fn()} />);

    const img = screen.getByAltText(`${withArtwork.artist.name} - ${withArtwork.title}`);
    expect(img.getAttribute("src")).toBe("https://i.discogs.com/on-your-own-love-again.jpg");
  });

  it("falls back to the lettercode placeholder when artwork_url is absent", () => {
    renderWithProviders(
      <CatalogMobileResult
        album={createTestAlbum({ ...artworkAlbum, artwork_url: undefined })}
        live={false}
        addToQueue={vi.fn()}
      />
    );

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the Not on Discogs badge instead of artwork when discogsUnavailable is true", () => {
    const flagged = createTestAlbum({
      ...artworkAlbum,
      artwork_url: "https://i.discogs.com/on-your-own-love-again.jpg",
      discogsUnavailable: true,
    });

    renderWithProviders(<CatalogMobileResult album={flagged} live={false} addToQueue={vi.fn()} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Not on Discogs")).toBeInTheDocument();
  });

  // Catalog search shares the mail bin's queue conversion, so the
  // compilation-credit rule reaches this surface too — a V/A release queued
  // from a search result must arrive blank and unlinked, ready for the DJ to
  // name the performer in the queue row.
  describe("adding a compilation to the queue", () => {
    const compilation = createTestAlbum({
      title: "Edits",
      artist: createTestArtist({ name: "Various Artists" }),
      label: "self-released",
    });
    const credited = createTestAlbum({
      title: "On Your Own Love Again",
      artist: createTestArtist({ name: "Jessica Pratt" }),
      label: "Drag City",
    });

    it("queues a blank artist and withholds the library linkage", async () => {
      const addToQueue = vi.fn();
      renderWithProviders(
        <CatalogMobileResult album={compilation} live={true} addToQueue={addToQueue} />
      );

      await userEvent.click(screen.getByRole("button", { name: "Add to Queue" }));

      expect(addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ artist: "", album_id: undefined })
      );
    });

    it("leaves a normally-credited release linked", async () => {
      const addToQueue = vi.fn();
      renderWithProviders(
        <CatalogMobileResult album={credited} live={true} addToQueue={addToQueue} />
      );

      await userEvent.click(screen.getByRole("button", { name: "Add to Queue" }));

      expect(addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          artist: "Jessica Pratt",
          album_id: credited.id,
        })
      );
    });
  });

  describe("album detail navigation", () => {
    it("navigates to the album detail route when the card is tapped", async () => {
      mockPush.mockClear();
      const tappable = createTestAlbum({ id: 42 });
      renderWithProviders(
        <CatalogMobileResult album={tappable} live={false} addToQueue={vi.fn()} />
      );

      await userEvent.click(screen.getByText(tappable.title));
      expect(mockPush).toHaveBeenCalledWith("/dashboard/album/42");
    });

    it("navigates from the More information button", async () => {
      mockPush.mockClear();
      const tappable = createTestAlbum({ id: 42 });
      renderWithProviders(
        <CatalogMobileResult album={tappable} live={false} addToQueue={vi.fn()} />
      );

      await userEvent.click(
        screen.getByRole("button", { name: "More information" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard/album/42");
    });

    it("does not navigate for a card without a library id", async () => {
      mockPush.mockClear();
      const unlinked = createTestAlbum({ id: null });
      renderWithProviders(
        <CatalogMobileResult album={unlinked} live={false} addToQueue={vi.fn()} />
      );

      await userEvent.click(screen.getByText(unlinked.title));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe("CatalogMobileResult rotation location", () => {
  const ENV_KEY = "NEXT_PUBLIC_ROTATION_ADMIN_ENABLED";
  const locationAlbum = createTestAlbum({
    title: "On Your Own Love Again",
    artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 87 }),
    entry: 4,
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("renders the location as its own pill, tooltip scoped to it, hiding the call number, when the flag is on", () => {
    process.env[ENV_KEY] = "true";
    const rotating = createTestAlbum({
      ...locationAlbum,
      plays: 42,
      label: "Drag City",
      rotation_bin: RotationBin.H,
      card: { id: 1, bin: RotationBin.H, number: 1, name: "Late Aug" },
    });

    renderWithProviders(
      <CatalogMobileResult album={rotating} live={false} addToQueue={vi.fn()} />
    );

    // The tooltip element IS the location, nothing more: hovering plays or
    // the label must never pop rotation facts over them.
    const pill = screen.getByTitle("Heavy rotation, card 1 “Late Aug”");
    expect(pill.textContent).toBe("H · card 1");
    // The location never joins the " · "-separated meta line — its internal
    // separator is the same character, so `H · card 1 · 42 plays` would read
    // as three peer items — and the call number is withheld entirely.
    const meta = screen.getByText(/42 plays/);
    expect(meta.textContent).toBe("42 plays · Drag City");
    expect(meta.getAttribute("title")).toBeNull();
    expect(screen.queryByText(/RO 87\/4/)).toBeNull();
  });

  it("degrades to a bin-only pill when the row is rotating but carries no card", () => {
    process.env[ENV_KEY] = "true";
    const rotating = createTestAlbum({
      ...locationAlbum,
      rotation_bin: RotationBin.S,
      card: undefined,
    });

    renderWithProviders(
      <CatalogMobileResult album={rotating} live={false} addToQueue={vi.fn()} />
    );

    const pill = screen.getByTitle("Singles rotation");
    expect(pill.textContent).toBe("S");
    expect(screen.queryByText(/RO 87\/4/)).toBeNull();
  });

  it("keeps the call number in the meta line for a non-rotating row when the flag is on", () => {
    process.env[ENV_KEY] = "true";
    const notRotating = createTestAlbum({
      ...locationAlbum,
      rotation_bin: undefined,
    });

    renderWithProviders(
      <CatalogMobileResult album={notRotating} live={false} addToQueue={vi.fn()} />
    );

    expect(screen.getByText(/RO 87\/4/)).toBeDefined();
    expect(screen.queryByTitle(/rotation/)).toBeNull();
  });

  it("leaves a rotating row unchanged when the flag is off", () => {
    delete process.env[ENV_KEY];
    const rotating = createTestAlbum({
      ...locationAlbum,
      rotation_bin: RotationBin.M,
      card: { id: 2, bin: RotationBin.M, number: 2 },
    });

    renderWithProviders(
      <CatalogMobileResult album={rotating} live={false} addToQueue={vi.fn()} />
    );

    expect(screen.getByText(/RO 87\/4/)).toBeDefined();
    expect(screen.queryByText(/M · card 2/)).toBeNull();
  });
});
