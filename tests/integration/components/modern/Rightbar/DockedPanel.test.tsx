import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import DockedPanel from "@/src/components/experiences/modern/Rightbar/DockedPanel";

const WIDTH = "400px";

describe("DockedPanel", () => {
  it("renders its content when open", () => {
    renderWithProviders(
      <DockedPanel content={<div data-testid="panel-content">A</div>} width={WIDTH} />,
    );
    expect(screen.getByTestId("panel-content")).toBeInTheDocument();
  });

  it("swaps content without unmounting the panel", () => {
    const { rerender } = renderWithProviders(
      <DockedPanel content={<div data-testid="content-a">A</div>} width={WIDTH} />,
    );
    rerender(<DockedPanel content={<div data-testid="content-b">B</div>} width={WIDTH} />);

    expect(screen.getByTestId("content-b")).toBeInTheDocument();
    expect(screen.queryByTestId("content-a")).not.toBeInTheDocument();
  });

  it("keeps the outgoing content mounted until the collapse transition ends", () => {
    const { rerender, container } = renderWithProviders(
      <DockedPanel content={<div data-testid="panel-content">A</div>} width={WIDTH} />,
    );
    rerender(<DockedPanel content={null} width={WIDTH} />);

    expect(screen.getByTestId("panel-content")).toBeInTheDocument();

    fireEvent.transitionEnd(container.firstElementChild as Element, {
      propertyName: "width",
    });
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
  });
});
