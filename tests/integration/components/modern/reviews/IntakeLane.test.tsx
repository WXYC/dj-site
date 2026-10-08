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
    renderWithProviders(<IntakeLane title="On the review shelf" rows={[]} empty="Nothing here." label={(r) => r} extra={() => null} />);
    const lane = screen.getByRole("region", { name: "On the review shelf" });
    expect(within(lane).getByText("On the review shelf")).toBeInTheDocument();
    expect(within(lane).getByText("Nothing here.")).toBeInTheDocument();
    expect(within(lane).queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders each row's label followed by its extras", () => {
    renderWithProviders(
      <IntakeLane
        title="Checkouts"
        rows={rows}
        empty="Nothing here."
        label={(r) => <a href={`/x/${r.id}`}>{r.name}</a>}
        extra={(r) => <span>{`extra ${r.id}`}</span>}
      />,
    );
    const items = within(screen.getByRole("region", { name: "Checkouts" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByRole("link", { name: "Stereolab" })).toHaveAttribute("href", "/x/2");
    expect(items[1].textContent).toBe("Stereolabextra 2");
    expect(screen.queryByText("Nothing here.")).not.toBeInTheDocument();
  });

  it("adds no wrapper around the label: it sits beside the extras in the row container", () => {
    renderWithProviders(
      <IntakeLane
        title="Checkouts"
        rows={rows}
        empty="Nothing here."
        label={(r) => <a href={`/x/${r.id}`}>{r.name}</a>}
        extra={(r) => <span>{`extra ${r.id}`}</span>}
      />,
    );
    const [item] = within(screen.getByRole("region", { name: "Checkouts" })).getAllByRole("listitem");
    const link = within(item).getByRole("link", { name: "Juana Molina" });
    const extra = within(item).getByText("extra 1");
    expect(link.parentElement).toBe(extra.parentElement);
    expect(link.parentElement).not.toBe(item);
  });
});
