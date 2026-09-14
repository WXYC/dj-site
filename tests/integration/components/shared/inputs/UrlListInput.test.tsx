import { describe, it, expect } from "vitest";
import { useState } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

import UrlListInput from "@/src/components/shared/inputs/UrlListInput";

const HYDRATED = ["juanamolina.bandcamp.com", "dragcity.com"];

/**
 * `cloneValue` hands the component a fresh array each render -- standing in
 * for any parent that derives `value` (a selector, `urls ?? []`, a `.map`) --
 * so the specs cover the props' promise that referential stability is not
 * required.
 */
function Harness({ cloneValue = false }: { cloneValue?: boolean }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div>
      <span data-testid="value">{JSON.stringify(value)}</span>
      <button onClick={() => setValue(HYDRATED)}>hydrate</button>
      <button onClick={() => setValue([])}>clear</button>
      <UrlListInput value={cloneValue ? [...value] : value} onChange={setValue} />
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
    expect(screen.queryByLabelText(/^Remove URL/)).toBeNull();
    expect(screen.getByLabelText("Add another URL")).toBeDefined();
  });

  it("adds a row from the last row's + button", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));

    expect(urlInputs()).toHaveLength(2);
    expect(screen.getAllByLabelText(/^Remove URL/)).toHaveLength(2);
  });

  it("adds a row under a parent that re-derives the value array", async () => {
    const { user } = renderWithProviders(<Harness cloneValue />);

    await user.type(urlInputs()[0], "bandcamp.com");
    await user.click(screen.getByLabelText("Add another URL"));

    expect(urlInputs()).toHaveLength(2);
  });

  it("shows a single + button, on the last row only", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));

    expect(screen.getAllByLabelText("Add another URL")).toHaveLength(1);
  });

  it("names each row's input and remove button by position", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));

    expect(screen.getByRole("textbox", { name: "URL 1" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "URL 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove URL 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove URL 2" })).toBeInTheDocument();
  });

  it("removes a row and hides the − button once only one row remains", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByLabelText("Add another URL"));
    await user.click(screen.getByLabelText("Remove URL 1"));

    expect(urlInputs()).toHaveLength(1);
    expect(screen.queryByLabelText(/^Remove URL/)).toBeNull();
  });

  it("keeps each surviving row's DOM node when a middle row is removed", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(urlInputs()[0], "juanamolina.bandcamp.com");
    await user.click(screen.getByLabelText("Add another URL"));
    await user.type(urlInputs()[1], "dragcity.com");
    await user.click(screen.getByLabelText("Add another URL"));
    await user.type(urlInputs()[2], "discogs.com");
    const third = urlInputs()[2];

    await user.click(screen.getByLabelText("Remove URL 2"));

    const inputs = urlInputs();
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("juanamolina.bandcamp.com");
    expect(inputs[1]).toHaveValue("discogs.com");
    // The last row keeps its DOM node, so transient state (caret position,
    // IME composition, autofill highlight) stays with the logical row
    // instead of migrating to whichever row inherits its index.
    expect(inputs[1]).toBe(third);
  });

  it("re-renders rows from an externally reset value", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(urlInputs()[0], "bandcamp.com");
    await user.click(screen.getByRole("button", { name: "hydrate" }));

    const inputs = urlInputs();
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(HYDRATED[0]);
    expect(inputs[1]).toHaveValue(HYDRATED[1]);
  });

  it("collapses to a single blank row when the value is externally cleared", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(urlInputs()[0], "bandcamp.com");
    await user.click(screen.getByRole("button", { name: "clear" }));

    expect(urlInputs()).toHaveLength(1);
    expect(urlInputs()[0]).toHaveValue("");
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
