import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

import SearchForm from "@/src/components/experiences/classic/catalog/SearchForm";

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams("");
});

describe("Classic catalog SearchForm — live search input", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the live-search input with tubafrenzy's placeholder", () => {
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.placeholder).toMatch(/type to search .*releases/i);
  });

  it("debounces typing and updates the URL with the query", () => {
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "polvo" } });
    expect(mockReplace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/catalog?searchString=polvo"
    );
  });

  it("only fires once for rapid keystrokes (debounce)", () => {
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "p" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "po" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "polvo" } });
    vi.advanceTimersByTime(300);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/catalog?searchString=polvo"
    );
  });

  it("clears the query from the URL when the input is emptied", () => {
    mockSearchParams = new URLSearchParams("searchString=polvo");
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    vi.advanceTimersByTime(300);
    expect(mockReplace).toHaveBeenCalledWith("/dashboard/catalog");
  });

  it("preserves ?exclusive=true when typing while the filter is active", () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "polvo" } });
    vi.advanceTimersByTime(300);
    const pushedUrl = mockReplace.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("searchString=polvo");
    expect(pushedUrl).toContain("exclusive=true");
  });

  it("seeds the input from ?searchString= on mount", () => {
    mockSearchParams = new URLSearchParams("searchString=polvo");
    renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.defaultValue).toBe("polvo");
  });
});

describe("Classic catalog SearchForm — Browse Exclusive Albums", () => {
  it("renders the 'Browse Exclusive Albums' pill", () => {
    renderWithProviders(<SearchForm />);
    const btn = screen.getByRole("button", {
      name: /browse exclusive albums/i,
    });
    expect(btn.classList.contains("browse-exclusive-btn")).toBe(true);
  });

  it("clicking the pill navigates to ?exclusive=true and clears the input", () => {
    mockSearchParams = new URLSearchParams("searchString=polvo");
    renderWithProviders(<SearchForm />);
    fireEvent.click(
      screen.getByRole("button", { name: /browse exclusive albums/i })
    );
    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/catalog?exclusive=true"
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
});

describe("Classic catalog SearchForm — search tips modal", () => {
  it("does not render the tips modal initially", () => {
    renderWithProviders(<SearchForm />);
    expect(screen.queryByText(/search tips/i)).toBeNull();
  });

  it("opens the tips modal from the ? icon and closes it again", () => {
    renderWithProviders(<SearchForm />);
    fireEvent.click(screen.getByTitle(/search tips/i));
    expect(screen.getByText("Search Tips")).toBeDefined();
    expect(screen.getByText(/exact phrase/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText("Search Tips")).toBeNull();
  });
});
