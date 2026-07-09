import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { renderWithProviders } from "@/lib/test-utils/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
}));

const setSelection = vi.fn();
vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQuerySearch: () => ({
    selected: [],
    setSelection,
    sortBy: "album",
  }),
}));

import CatalogMobileResult from "../MobileResult";

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
    renderWithProviders(<CatalogMobileResult album={album} />);

    expect(screen.getByText("On Your Own Love Again")).toBeDefined();
    expect(screen.getByText("Jessica Pratt")).toBeDefined();
    // call # · plays · label all on one stacked metadata line
    const meta = screen.getByText(/RO 87\/4/);
    expect(meta.textContent).toContain("42 plays");
    expect(meta.textContent).toContain("Drag City");
  });

  it("renders genre and format chips", () => {
    renderWithProviders(<CatalogMobileResult album={album} />);
    expect(screen.getByText(album.artist.genre)).toBeDefined();
    expect(screen.getByText("Vinyl")).toBeDefined();
  });

  it("omits empty metadata segments", () => {
    renderWithProviders(
      <CatalogMobileResult album={createTestAlbum({ ...album, plays: 0, label: "" })} />
    );
    const meta = screen.getByText(/RO 87\/4/);
    expect(meta.textContent).not.toContain("plays");
    expect(meta.textContent?.trim()).toBe("RO 87/4");
  });

  it("toggles selection via the checkbox without opening the detail panel", () => {
    renderWithProviders(<CatalogMobileResult album={album} />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(setSelection).toHaveBeenCalledWith([album.id]);
  });

  it("shows the WXYC EXCLUSIVE chip when not on streaming", () => {
    renderWithProviders(
      <CatalogMobileResult album={createTestAlbum({ ...album, on_streaming: false })} />
    );
    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
  });
});
