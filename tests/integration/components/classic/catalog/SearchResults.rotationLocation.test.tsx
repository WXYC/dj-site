import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist, renderWithProviders } from "@/tests/helpers";
import { RotationBin } from "@/lib/features/rotation/types";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("searchString=test"),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

const ENV_KEY = "NEXT_PUBLIC_ROTATION_ADMIN_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("Classic SearchResults rotation location", () => {
  it("shows bin + card with a tooltip carrying the card name, and hides the call number, when the flag is on", () => {
    process.env[ENV_KEY] = "true";
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 8 }),
      entry: 6,
      rotation_bin: RotationBin.H,
      card: { id: 1, bin: RotationBin.H, number: 1, name: "Late Aug" },
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults canModify={false} />);

    const location = screen.getByText("H · card 1");
    expect(location.tagName).toBe("B");
    expect(location.getAttribute("title")).toBe("Heavy rotation, card 1 “Late Aug”");
    // The location outsizes the call numbers the Code column was sized for;
    // without nowrap it can wrap mid-token and rag the column.
    expect(location.closest("td")!.style.whiteSpace).toBe("nowrap");
    expect(screen.queryByText("MO 8/6")).toBeNull();
  });

  it("degrades to the bin alone when the row is rotating but carries no card", () => {
    process.env[ENV_KEY] = "true";
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Hermanos Gutiérrez", lettercode: "GU", numbercode: 11 }),
      entry: 4,
      rotation_bin: RotationBin.S,
      card: undefined,
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults canModify={false} />);

    const location = screen.getByText("S");
    expect(location.tagName).toBe("B");
    expect(location.getAttribute("title")).toBe("Singles rotation");
    expect(screen.queryByText("GU 11/4")).toBeNull();
  });

  it("leaves a non-rotating row unchanged", () => {
    process.env[ENV_KEY] = "true";
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Cat Power", lettercode: "CA", numbercode: 9 }),
      entry: 2,
      rotation_bin: undefined,
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults canModify={false} />);

    expect(screen.getByText("CA 9/2")).toBeDefined();
  });

  it("leaves a rotating row unchanged when the flag is off", () => {
    delete process.env[ENV_KEY];
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Duke Ellington & John Coltrane", lettercode: "EL", numbercode: 1 }),
      entry: 5,
      rotation_bin: RotationBin.M,
      card: { id: 2, bin: RotationBin.M, number: 2 },
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults canModify={false} />);

    expect(screen.getByText("EL 1/5")).toBeDefined();
    expect(screen.queryByText("M · card 2")).toBeNull();
  });
});
