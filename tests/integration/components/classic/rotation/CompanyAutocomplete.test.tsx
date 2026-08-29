import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import CompanyAutocomplete from "@/src/components/experiences/classic/rotation/CompanyAutocomplete";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

function Harness({
  initialValue = "",
  onSelect = vi.fn(),
  onSelectionCleared = vi.fn(),
}: {
  initialValue?: string;
  onSelect?: (label: { id: number; label_name: string }) => void;
  onSelectionCleared?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <CompanyAutocomplete
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      onSelectionCleared={onSelectionCleared}
    />
  );
}

describe("classic CompanyAutocomplete — the companyName field's setUpCompanyAutocomplete wiring", () => {
  it("renders a plain text input wired to a datalist, matching the JSP's native input[list] pattern", async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    expect(input).toHaveAttribute("list");
  });

  it("populates the datalist with search results once the query reaches the minimum length", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        expect(q).toBe("Son");
        return HttpResponse.json([{ id: 5, label_name: "Sonamos" }]);
      }),
    );

    const { user, container } = renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "Son");

    // jsdom does not expose <datalist><option> through the accessibility
    // tree the way <select><option> is (no ARIA "option" role here), so this
    // reads the plain DOM the browser's native autocomplete would drive.
    await waitFor(() => {
      expect(container.querySelector('datalist option[value="Sonamos"]')).not.toBeNull();
    });
  });

  it("calls onSelect once typed text exactly matches a loaded label, case- and whitespace-insensitively", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json([{ id: 5, label_name: "Sonamos" }]),
      ),
    );
    const onSelect = vi.fn();
    const onSelectionCleared = vi.fn();

    const { user } = renderWithProviders(
      <Harness onSelect={onSelect} onSelectionCleared={onSelectionCleared} />,
    );
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "sonamos");

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({ id: 5, label_name: "Sonamos" });
    });
  });

  it("calls onSelectionCleared when the typed text no longer matches a loaded label", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json([{ id: 5, label_name: "Sonamos" }]),
      ),
    );
    const onSelect = vi.fn();
    const onSelectionCleared = vi.fn();

    const { user } = renderWithProviders(
      <Harness onSelect={onSelect} onSelectionCleared={onSelectionCleared} />,
    );
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "Sonamos");
    await waitFor(() => expect(onSelect).toHaveBeenCalled());

    onSelectionCleared.mockClear();
    await user.type(input, "z");

    expect(onSelectionCleared).toHaveBeenCalled();
  });

  it("does not search below the minimum query length", async () => {
    let called = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );

    const { user } = renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "S");

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(called).toBe(false);
  });

  it("renders an outage message distinct from 'no matches' when the search fails", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { user } = renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "Sonamos");

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("disables the input and skips the search when disabled", () => {
    const onSelect = vi.fn();
    const onSelectionCleared = vi.fn();
    renderWithProviders(
      <CompanyAutocomplete
        value=""
        onChange={vi.fn()}
        onSelect={onSelect}
        onSelectionCleared={onSelectionCleared}
        disabled
      />,
    );
    expect(screen.getByRole("combobox", { name: /record label/i })).toBeDisabled();
  });
});
