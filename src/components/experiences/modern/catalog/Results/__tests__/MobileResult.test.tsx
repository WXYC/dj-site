import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

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
