import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

const mockResolve = vi.fn();
vi.mock("@/lib/features/catalog/legacy-permalink.server", () => ({
  resolveLegacyReleaseId: (legacyId: string, cookie: string) =>
    mockResolve(legacyId, cookie),
  albumSerialPath: (serial: number) => `/dashboard/album/${serial}`,
}));

import LegacyAlbumInformation from "@/app/dashboard/@information/album/legacy/[legacyId]/page";
import { renderWithProviders, screen } from "@/tests/helpers";

const COOKIE = "session=test-cookie";

function renderPage(legacyId: string) {
  return LegacyAlbumInformation({ params: Promise.resolve({ legacyId }) });
}

describe("legacy album permalink front door (@information slot)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({ toString: () => COOKIE });
  });

  it("308-redirects to the canonical serial route when the legacy id resolves", async () => {
    mockResolve.mockResolvedValue({ status: "resolved", serial: 7100 });

    await expect(renderPage("65880")).rejects.toThrow(
      "REDIRECT:/dashboard/album/7100",
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith("/dashboard/album/7100");
  });

  it("passes the awaited legacy id and forwarded cookie to the resolver", async () => {
    mockResolve.mockResolvedValue({ status: "resolved", serial: 7100 });

    await expect(renderPage("65880")).rejects.toThrow(/REDIRECT/);
    expect(mockResolve).toHaveBeenCalledWith("65880", COOKIE);
  });

  it("renders a non-redirecting not-found state when the legacy id does not resolve", async () => {
    mockResolve.mockResolvedValue({ status: "not-found" });

    const element = await renderPage("999999999");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();

    renderWithProviders(element);
    expect(screen.getByText(/not in the catalog yet/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /browse the catalog/i });
    expect(link).toHaveAttribute("href", "/dashboard/catalog");
  });
});
