import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import IntakeLane from "@/src/components/experiences/modern/reviews/IntakeLane";

const rows = [
  { id: 1, name: "Juana Molina" },
  { id: 2, name: "Stereolab" },
];

describe("IntakeLane", () => {
  it("shows the title and the empty line when there are no rows", () => {
    renderWithProviders(<IntakeLane title="On the review shelf" rows={rows.slice(0, 0)} empty="Nothing here." row={(r) => <span>{r.name}</span>} />);
    const lane = screen.getByRole("region", { name: "On the review shelf" });
    expect(within(lane).getByText("On the review shelf")).toBeInTheDocument();
    expect(within(lane).getByRole("heading", { level: 3, name: "On the review shelf" })).toBeInTheDocument();
    expect(within(lane).getByText("Nothing here.")).toBeInTheDocument();
    expect(within(lane).queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders each row's own content, as a list item", () => {
    renderWithProviders(<IntakeLane title="Requests" rows={rows} empty="Nothing here." row={(r) => <span>{`row ${r.id}`}</span>} />);
    const items = within(screen.getByRole("region", { name: "Requests" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["row 1", "row 2"]);
  });

  it("takes only a `row` render prop: a `label` does not type-check", () => {
    // @ts-expect-error a lane can no longer draw its rows as an inline label
    renderWithProviders(<IntakeLane title="Checkouts" rows={rows} empty="Nothing here." row={(r) => <span>{r.name}</span>} label={(r) => r.name} />);
  });
});
