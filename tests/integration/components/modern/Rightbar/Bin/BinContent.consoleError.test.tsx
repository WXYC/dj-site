import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { createTestAlbumList } from "@/tests/fixtures/fixtures";
import BinContent from "@/src/components/experiences/modern/Rightbar/Bin/BinContent";

// React only validates a Fragment's props during reconciliation, not
// initial mount, so each case below rerenders before asserting.

const mockUseBin = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: () => mockUseBin(),
  useDeleteFromBin: () => ({ deleteFromBin: vi.fn() }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
  useFlowsheetActions: () => ({ addToFlowsheet: vi.fn(() => Promise.resolve()) }),
}));

vi.mock("@/src/components/experiences/modern/Rightbar/Bin/BinEntry", () => ({
  default: ({ entry }: { entry: { id: number; title: string } }) => (
    <div data-testid={`bin-entry-${entry.id}`}>{entry.title}</div>
  ),
}));

vi.mock("@/src/components/experiences/modern/Rightbar/Bin/ClearBinButton", () => ({
  default: () => <button data-testid="clear-bin-button" />,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/Bin/ExportBinButton", () => ({
  default: () => <button data-testid="export-bin-button" />,
}));

const binEntries = createTestAlbumList(3);

// The offending prop name is a printf-style arg to console.error, not part
// of the format string, so check every call's full arg list.
function fragmentPropWarnings(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((args: unknown[]) =>
    args.some((arg) => typeof arg === "string" && arg.includes("React.Fragment"))
  );
}

describe("BinContent console errors", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not warn about invalid props when the bin has entries", () => {
    mockUseBin.mockReturnValue({
      bin: binEntries,
      loading: false,
      isSuccess: true,
      isError: false,
    });

    const { rerender } = renderWithProviders(<BinContent />);
    rerender(<BinContent />);

    expect(screen.getByTestId(`bin-entry-${binEntries[0].id}`)).toBeInTheDocument();
    expect(fragmentPropWarnings(errorSpy)).toHaveLength(0);
  });

  it("does not warn about invalid props during a transient refetch failure with cached entries", () => {
    mockUseBin.mockReturnValue({
      bin: binEntries,
      loading: false,
      isSuccess: true,
      isError: true,
    });

    const { rerender } = renderWithProviders(<BinContent />);
    rerender(<BinContent />);

    expect(
      screen.getByText(/Couldn't refresh your Mail Bin/)
    ).toBeInTheDocument();
    expect(fragmentPropWarnings(errorSpy)).toHaveLength(0);
  });
});
