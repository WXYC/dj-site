import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { SxProps } from "@mui/joy/styles/types";

import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import { renderWithProviders } from "@/tests/helpers";

describe("ReadRetryAlert", () => {
  it("renders the message", () => {
    renderWithProviders(<ReadRetryAlert message="Could not load the thing." onRetry={vi.fn()} />);

    expect(screen.getByText("Could not load the thing.")).toBeInTheDocument();
  });

  it("calls onRetry once when Retry is clicked", () => {
    const onRetry = vi.fn();
    renderWithProviders(<ReadRetryAlert message="Could not load the thing." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // Each call site carries its own layout through `sx`, in any form Joy accepts.
  const sxForms: [string, SxProps][] = [
    ["an object", { textAlign: "center" }],
    ["a theme function", () => ({ textAlign: "center" })],
    ["an array", [{ textAlign: "center" }]],
  ];

  it.each(sxForms)("applies sx given as %s and keeps its own layout", (_form, sx) => {
    renderWithProviders(
      <ReadRetryAlert message="Could not load the thing." onRetry={vi.fn()} sx={sx} />,
    );

    expect(screen.getByRole("alert")).toHaveStyle({
      textAlign: "center",
      justifyContent: "space-between",
    });
  });
});
