import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import CompanyAutocomplete from "@/src/components/experiences/classic/rotation/CompanyAutocomplete";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

function Harness({
  initialValue = "",
  onSelect = vi.fn(),
}: {
  initialValue?: string;
  onSelect?: (label: { id: number; label_name: string }) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return <CompanyAutocomplete value={value} onChange={setValue} onSelect={onSelect} />;
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

    const { user } = renderWithProviders(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "sonamos");

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({ id: 5, label_name: "Sonamos" });
    });
  });

  it("stops reporting a match once the typed text no longer names a loaded label", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json([{ id: 5, label_name: "Sonamos" }]),
      ),
    );
    const onSelect = vi.fn();

    const { user } = renderWithProviders(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "Sonamos");
    await waitFor(() => expect(onSelect).toHaveBeenCalled());

    onSelect.mockClear();
    await user.type(input, "z");

    expect(onSelect).not.toHaveBeenCalled();
  });

  // `data` holds the last result for ANY args, so a widened query that is
  // still in flight would go on offering the previous query's labels as
  // matches for a prefix they no longer match.
  it("stops offering the previous query's labels while a widened query is still in flight", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? "";
        if (q === "Son") return HttpResponse.json([{ id: 5, label_name: "Sonamos" }]);
        await delay("infinite");
        return HttpResponse.json([]);
      }),
    );

    const { user, container } = renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: /record label/i });
    await user.type(input, "Son");
    await waitFor(() => {
      expect(container.querySelector('datalist option[value="Sonamos"]')).not.toBeNull();
    });

    await user.type(input, "x");

    await waitFor(() => {
      expect(container.querySelector('datalist option[value="Sonamos"]')).toBeNull();
    });
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

  it("disables the input and issues no search when disabled", async () => {
    let called = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(
      <CompanyAutocomplete value="Sonamos" onChange={vi.fn()} onSelect={vi.fn()} disabled />,
    );

    expect(screen.getByRole("combobox", { name: /record label/i })).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(called).toBe(false);
  });
});
