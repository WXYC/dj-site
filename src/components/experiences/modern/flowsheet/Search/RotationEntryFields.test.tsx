import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import RotationEntryFields from "./RotationEntryFields";

// `useFlowsheetSearch` fans out into many RTK Query hooks (live show control,
// bin search, catalog search, rotation search, LML). Mocking it isolates
// RotationEntryFields at the unit-test tier — without it the test would need
// MSW handlers for the full search surface. Real Redux still drives the
// dispatches we care about (asserted below); only the hook's read-side is
// mocked so we can drive the visible input value and capture writes.
const setSearchPropertyMock = vi.fn<(name: string, value: string) => void>();
let mockSearchQuery: Record<string, string> = {
  artist: "",
  song: "",
  album: "",
  label: "",
};

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    setSearchOpen: vi.fn(),
    getDisplayValue: (name: string) => mockSearchQuery[name] ?? "",
    setSearchProperty: (name: string, value: string) => {
      mockSearchQuery[name] = value;
      setSearchPropertyMock(name, value);
    },
    selectedIndex: 0,
    selectedEntry: null,
  }),
}));

// Rotation API: kept mocked at the hook level so the test doesn't need MSW
// handlers for `/library/rotation` and `/library/rotation/:id/tracks`. The
// hook contract is small enough to mock directly.
let mockRotationData: ReturnType<typeof createTestAlbum>[] = [];
let mockTracksData:
  | { position: string; title: string; duration: string | null; artists: string[] }[]
  | undefined = undefined;
let mockTracksLoading = false;

// Partial mock: lib/store.ts imports `rotationApi` from this module for the
// real store setup that renderWithProviders wires up. importOriginal keeps
// that export intact while overriding the two query hooks the component uses.
vi.mock("@/lib/features/rotation/api", async () => {
  // Keep rotationApi intact — lib/store.ts consumes it for the real store
  // that renderWithProviders wires up. Override only the two query hooks
  // the component reads. Returning a minimal {data, isLoading} subset (vs.
  // the full UseQueryHookResult) is fine because the component never reads
  // refetch / fulfilledTimeStamp / etc.
  const actual = await vi.importActual<typeof import("@/lib/features/rotation/api")>(
    "@/lib/features/rotation/api"
  );
  return {
    ...actual,
    useGetRotationQuery: () => ({ data: mockRotationData }),
    useGetRotationTracksQuery: () => ({
      data: mockTracksData,
      isLoading: mockTracksLoading,
    }),
  };
});

const lightningBoltOoioo = createTestAlbum({
  id: 7,
  title: "OOIOO / Lightning Bolt Split",
  artist: createTestArtist({ name: "OOIOO" }),
  label: "Load Records",
  rotation_id: 42,
  rotation_bin: "H",
});

const selectBinAndRelease = () => {
  fireEvent.click(screen.getByRole("radio", { name: "H" }));
  fireEvent.click(screen.getByTestId("rotation-release-trigger"));
  fireEvent.click(
    screen.getByTestId(`rotation-release-option-${lightningBoltOoioo.id}`)
  );
};

describe("RotationEntryFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchQuery = { artist: "", song: "", album: "", label: "" };
    mockRotationData = [lightningBoltOoioo];
    mockTracksData = undefined;
    mockTracksLoading = false;
  });

  it("does not render the artist input before a release is selected", () => {
    renderWithProviders(<RotationEntryFields disabled={false} />);
    expect(
      screen.queryByTestId("flowsheet-search-artist")
    ).not.toBeInTheDocument();
  });

  it("renders an editable artist input once a release is selected", () => {
    renderWithProviders(<RotationEntryFields disabled={false} />);
    selectBinAndRelease();

    const artistInput = screen.getByTestId("flowsheet-search-artist");
    expect(artistInput).toBeInTheDocument();
    expect(artistInput).not.toHaveAttribute("readonly");
  });

  it("seeds the artist input with the release's primary artist", () => {
    // Assert against the *real* action creator so the test catches drift if
    // the slice ever renames the action or reshapes the payload.
    const { store } = renderWithProviders(
      <RotationEntryFields disabled={false} />
    );
    const dispatchSpy = vi.spyOn(store, "dispatch");

    selectBinAndRelease();

    expect(dispatchSpy).toHaveBeenCalledWith(
      flowsheetSlice.actions.setSearchProperty({
        name: "artist",
        value: "OOIOO",
      })
    );
  });

  it("lets the DJ override the seeded artist (split release case)", () => {
    renderWithProviders(<RotationEntryFields disabled={false} />);
    selectBinAndRelease();

    const artistInput = screen.getByTestId("flowsheet-search-artist");
    fireEvent.change(artistInput, { target: { value: "Lightning Bolt" } });

    expect(setSearchPropertyMock).toHaveBeenCalledWith(
      "artist",
      "Lightning Bolt"
    );
  });

  it("propagates the disabled prop to the artist input", () => {
    const { rerender } = renderWithProviders(
      <RotationEntryFields disabled={false} />
    );
    selectBinAndRelease();
    expect(screen.getByTestId("flowsheet-search-artist")).not.toBeDisabled();

    rerender(<RotationEntryFields disabled={true} />);
    expect(screen.getByTestId("flowsheet-search-artist")).toBeDisabled();
  });
});
