import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTestAlbum } from "@/lib/test-utils";
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

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: () => ({
    selected: [],
    setSelection: vi.fn(),
    orderBy: "title",
  }),
}));

import CatalogResult from "../Result";

describe("CatalogResult plays column (Bug 12)", () => {
  it("should display the actual play count, not hardcoded 0", () => {
    const album = createTestAlbum({ plays: 42 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "42"
    );
    expect(playsCell).toBeDefined();
  });

  it("should display 0 when plays is 0", () => {
    const album = createTestAlbum({ plays: 0 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "0"
    );
    expect(playsCell).toBeDefined();
  });

  it("should display 0 when plays is undefined", () => {
    const album = createTestAlbum({ plays: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "0"
    );
    expect(playsCell).toBeDefined();
  });
});
