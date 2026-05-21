import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import QueryBuilder from "./QueryBuilder";
import { createComponentHarnessWithQueries } from "@/lib/test-utils";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const firstInput = (): HTMLElement | null =>
  screen.queryAllByPlaceholderText("Search the catalog")[0] ?? null;
const firstAddButton = (): HTMLElement | null =>
  screen.queryAllByRole("button", { name: "Add row" })[0] ?? null;
const firstRemoveButton = (): HTMLElement | null =>
  screen.queryAllByRole("button", { name: "Remove row" })[0] ?? null;

const setup = createComponentHarnessWithQueries(QueryBuilder, {}, {
  firstInput,
  firstAddButton,
  firstRemoveButton,
});

const countInputs = () =>
  screen.queryAllByPlaceholderText("Search the catalog").length;

describe("QueryBuilder", () => {
  it("renders a single input on first mount", () => {
    setup();
    expect(countInputs()).toBe(1);
  });

  it("clicking Add row appends a new row", async () => {
    const { firstAddButton, user } = setup();
    const button = firstAddButton();
    expect(button).not.toBeNull();
    await user.click(button!);
    expect(countInputs()).toBe(2);
  });

  it("typing into a row updates the slice", async () => {
    const { firstInput, user, getState } = setup();
    const input = firstInput();
    expect(input).not.toBeNull();
    await user.type(input!, "Stereolab");
    const rows = catalogSlice.selectors.getRows(getState());
    expect(rows[0].value).toBe("Stereolab");
  });

  it("subsequent rows pre-seed the operator to AND and default field to artist", async () => {
    const { firstAddButton, user, getState } = setup();
    await user.click(firstAddButton()!);

    const rows = catalogSlice.selectors.getRows(getState());
    expect(rows).toHaveLength(2);
    expect(rows[1].operator).toBe("AND");
    expect(rows[1].field).toBe("artist");
  });

  it("removing a row drops it from the slice", async () => {
    const { firstAddButton, firstRemoveButton, user, getState } = setup();
    await user.click(firstAddButton()!);
    expect(catalogSlice.selectors.getRows(getState())).toHaveLength(2);

    await user.click(firstRemoveButton()!);
    expect(catalogSlice.selectors.getRows(getState())).toHaveLength(1);
  });
});
