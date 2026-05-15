import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import SearchForm from "../SearchForm";

beforeEach(() => {
  mockPush.mockClear();
  mockSearchParams = new URLSearchParams("");
});

describe("Classic catalog SearchForm — Browse Exclusive Albums", () => {
  it("renders a 'Browse Exclusive Albums' button", () => {
    renderWithProviders(<SearchForm />);
    expect(
      screen.getByRole("button", { name: /browse exclusive albums/i })
    ).toBeDefined();
  });

  it("clicking the button navigates to ?exclusive=true", async () => {
    const { user } = renderWithProviders(<SearchForm />);
    await user.click(
      screen.getByRole("button", { name: /browse exclusive albums/i })
    );
    expect(mockPush).toHaveBeenCalledWith("/dashboard/catalog?exclusive=true");
  });

  it("preserves ?exclusive=true on submit when the URL already carries it", async () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
    const { user } = renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    await user.type(input, "polvo");
    const submit = screen.getByRole("button", {
      name: /search the wxyc library/i,
    });
    await user.click(submit);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("searchString=polvo");
    expect(pushedUrl).toContain("exclusive=true");
  });

  it("omits exclusive=true on submit when the URL does not carry it", async () => {
    const { user } = renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    await user.type(input, "polvo");
    const submit = screen.getByRole("button", {
      name: /search the wxyc library/i,
    });
    await user.click(submit);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("searchString=polvo");
    expect(pushedUrl).not.toContain("exclusive=true");
  });

  it("seeds the input from ?searchString= on mount", () => {
    mockSearchParams = new URLSearchParams("searchString=polvo");
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.defaultValue).toBe("polvo");
  });
});

describe("Classic catalog SearchForm — track-search help text", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED = "true";
  });

  describe("when CATALOG_TRACK_SEARCH_UI_ENABLED is on", () => {
    it("omits the 'Coming later' line", () => {
      renderWithProviders(<SearchForm />);
      expect(screen.queryByText(/Coming later/i)).toBeNull();
    });

    it("renders a track-search worked example with a clickable hyperlink", () => {
      renderWithProviders(<SearchForm />);
      const link = screen.getByRole("link", { name: /vi scose poise/i });
      expect(link.getAttribute("href")).toBe(
        "/dashboard/catalog?searchString=vi+scose+poise"
      );
      expect(link.textContent).toMatch(/vi scose poise/i);
    });

    it("mentions both compilation and general track lookup", () => {
      renderWithProviders(<SearchForm />);
      const notes = screen.getByText(/Confield by Autechre/i);
      const text = notes.textContent ?? "";
      expect(text).toMatch(/track/i);
      expect(text).toMatch(/compilation|various[- ]artists/i);
    });
  });

  describe.each(["false", "0", undefined] as const)(
    "when CATALOG_TRACK_SEARCH_UI_ENABLED is %s",
    (value) => {
      beforeEach(() => {
        if (value === undefined) {
          delete process.env.NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED;
        } else {
          process.env.NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED = value;
        }
      });

      it("retains the legacy 'Coming later' line", () => {
        renderWithProviders(<SearchForm />);
        expect(screen.getByText(/Coming later/i)).toBeDefined();
      });

      it("does not render the new track-search example", () => {
        renderWithProviders(<SearchForm />);
        expect(
          screen.queryByRole("link", { name: /vi scose poise/i })
        ).toBeNull();
      });
    }
  );
});
