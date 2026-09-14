import { describe, it, expect } from "vitest";
import { useState } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

import UrlListInput from "@/src/components/shared/inputs/UrlListInput";

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div>
      <span data-testid="value">{JSON.stringify(value)}</span>
      <UrlListInput value={value} onChange={setValue} />
    </div>
  );
}

function value() {
  return JSON.parse(screen.getByTestId("value").textContent ?? "[]");
}

function urlInputs() {
  return screen.getAllByPlaceholderText("bandcamp.com, discogs.com, etc.");
}

describe("UrlListInput", () => {
  it("renders a single row with no remove button when empty", () => {
    renderWithProviders(<Harness />);

    expect(urlInputs()).toHaveLength(1);
    expect(screen.queryByLabelText("Remove this URL")).toBeNull();
    expect(screen.getByLabelText("Add another URL")).toBeDefined();
  });

  it("adds a row from the last row's + button", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));

    expect(urlInputs()).toHaveLength(2);
    expect(screen.getAllByLabelText("Remove this URL")).toHaveLength(2);
  });

  it("shows a single + button, on the last row only", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));

    expect(screen.getAllByLabelText("Add another URL")).toHaveLength(1);
  });

  it("removes a row and hides the − button once only one row remains", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));
    await user.click(screen.getAllByLabelText("Remove this URL")[0]);

    expect(urlInputs()).toHaveLength(1);
    expect(screen.queryByLabelText("Remove this URL")).toBeNull();
  });

  it("drops empty rows from the emitted value and preserves order", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(urlInputs()[0], "bandcamp.com");
    await user.click(screen.getByLabelText("Add another URL"));
    await user.click(screen.getByLabelText("Add another URL"));
    await user.type(urlInputs()[2], "discogs.com");

    expect(value()).toEqual(["bandcamp.com", "discogs.com"]);
  });

  it("never renders url values as clickable links", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(urlInputs()[0], "bandcamp.com/artist");

    expect(screen.queryByRole("link")).toBeNull();
  });
});
