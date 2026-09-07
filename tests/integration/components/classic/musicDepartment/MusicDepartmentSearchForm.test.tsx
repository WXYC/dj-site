import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import MusicDepartmentSearchForm from "@/src/components/experiences/classic/musicDepartment/MusicDepartmentSearchForm";

beforeEach(() => {
  mockPush.mockClear();
});

describe("classic Music Department search form — mainmenu.jsp", () => {
  it("sends the term to the card catalog as searchString", async () => {
    const { user } = renderWithProviders(<MusicDepartmentSearchForm />);

    await user.type(screen.getByRole("textbox"), "stereolab");
    await user.click(screen.getByRole("button", { name: /search!/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/catalog?searchString=stereolab");
  });

  it("trims the term before sending it", async () => {
    const { user } = renderWithProviders(<MusicDepartmentSearchForm />);

    await user.type(screen.getByRole("textbox"), "  juana molina  ");
    await user.click(screen.getByRole("button", { name: /search!/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/catalog?searchString=juana+molina");
  });

  // The JSP's submit carries no term when the box is empty, landing on the
  // catalog's own empty state. Sending `searchString=` instead would put an
  // empty query in the URL the catalog then has to special-case.
  it.each(["", "   "])("navigates without a query for %j", async (term) => {
    const { user } = renderWithProviders(<MusicDepartmentSearchForm />);

    if (term.trim().length === 0 && term.length > 0) {
      await user.type(screen.getByRole("textbox"), term);
    }
    await user.click(screen.getByRole("button", { name: /search!/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/catalog");
  });

  // <input type=reset> in the JSP: clears the box, never submits.
  it("clears the box without navigating when Clear Box is pressed", async () => {
    const { user } = renderWithProviders(<MusicDepartmentSearchForm />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    await user.type(input, "cat power");
    await user.click(screen.getByRole("button", { name: /clear box/i }));

    expect(input.value).toBe("");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
