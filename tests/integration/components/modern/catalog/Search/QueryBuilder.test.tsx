import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import QueryBuilder from "@/src/components/experiences/modern/catalog/Search/QueryBuilder";
import { createComponentHarnessWithQueries } from "@/tests/helpers";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const firstInput = (): HTMLElement =>
  screen.getByTestId("catalog-search-input");
const firstAddButton = (): HTMLElement =>
  screen.getByTestId("catalog-search-add-row");
const firstRemoveButton = (): HTMLElement | null =>
  screen.queryByRole("button", { name: "Remove row" });

const setup = createComponentHarnessWithQueries(QueryBuilder, {}, {
  firstInput,
  firstAddButton,
  firstRemoveButton,
});

describe("QueryBuilder", () => {
  it("renders a single primary input on first mount", () => {
    setup();
    expect(screen.getByTestId("catalog-search-input")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("clicking Add row appends a new row", async () => {
    const { firstAddButton, user } = setup();
    await user.click(firstAddButton());
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("changing field does not clear row text", async () => {
    const { firstInput, user, getState, store } = setup();
    await user.type(firstInput(), "Stereolab");
    const rowId = catalogSlice.selectors.getRows(getState())[0].id;
    store.dispatch(
      catalogSlice.actions.updateRow({ id: rowId, updates: { field: "artist" } }),
    );
    const rows = catalogSlice.selectors.getRows(getState());
    expect(rows[0].value).toBe("Stereolab");
    expect(rows[0].field).toBe("artist");
  });

  it("typing into a row updates the slice", async () => {
    const { firstInput, user, getState } = setup();
    await user.type(firstInput(), "Stereolab");
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
