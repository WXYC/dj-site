import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CssVarsProvider } from "@mui/joy/styles";
import RotationEntryFields from "./RotationEntryFields";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils/fixtures";

const renderWithMuiProvider = (ui: ReactElement) =>
  render(<CssVarsProvider>{ui}</CssVarsProvider>);

// State shared across mocks so individual tests can drive behaviour
const mockDispatch = vi.fn();
let mockSearchQuery: Record<string, string> = {
  artist: "",
  song: "",
  album: "",
  label: "",
};
let mockRotationData: ReturnType<typeof createTestAlbum>[] = [];
let mockTracksData: { position: string; title: string; duration: string | null; artists: string[] }[] | undefined = undefined;
let mockTracksLoading = false;

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => undefined,
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    setSearchOpen: vi.fn(),
    getDisplayValue: (name: string) => mockSearchQuery[name] ?? "",
    setSearchProperty: (name: string, value: string) => {
      mockSearchQuery[name] = value;
    },
    selectedIndex: 0,
    selectedEntry: null,
  }),
}));

vi.mock("@/lib/features/rotation/api", () => ({
  useGetRotationQuery: () => ({ data: mockRotationData }),
  useGetRotationTracksQuery: () => ({ data: mockTracksData, isLoading: mockTracksLoading }),
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      setSearchProperty: (payload: { name: string; value: string }) => ({
        type: "flowsheet/setSearchProperty",
        payload,
      }),
      setRotationMetadata: (payload: unknown) => ({
        type: "flowsheet/setRotationMetadata",
        payload,
      }),
    },
  },
}));

const lightningBoltOoioo = createTestAlbum({
  id: 7,
  title: "OOIOO / Lightning Bolt Split",
  artist: createTestArtist({ name: "OOIOO" }),
  label: "Load Records",
  rotation_id: 42,
  rotation_bin: "H",
});

describe("RotationEntryFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchQuery = { artist: "", song: "", album: "", label: "" };
    mockRotationData = [lightningBoltOoioo];
    mockTracksData = undefined;
    mockTracksLoading = false;
  });

  it("does not render the artist input before a release is selected", () => {
    renderWithMuiProvider(<RotationEntryFields disabled={false} />);
    expect(screen.queryByTestId("flowsheet-search-artist")).not.toBeInTheDocument();
  });

  const selectBinAndRelease = () => {
    fireEvent.click(screen.getByRole("radio", { name: "H" }));
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    fireEvent.click(screen.getByTestId(`rotation-release-option-${lightningBoltOoioo.id}`));
  };

  it("renders an editable artist input once a release is selected", () => {
    renderWithMuiProvider(<RotationEntryFields disabled={false} />);
    selectBinAndRelease();

    const artistInput = screen.getByTestId("flowsheet-search-artist");
    expect(artistInput).toBeInTheDocument();
    expect(artistInput).not.toHaveAttribute("readonly");
  });

  it("seeds the artist input with the release's primary artist", () => {
    renderWithMuiProvider(<RotationEntryFields disabled={false} />);
    selectBinAndRelease();

    // handleSelectRelease dispatches setSearchProperty with the release artist.
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "flowsheet/setSearchProperty",
        payload: { name: "artist", value: "OOIOO" },
      })
    );
  });

  it("lets the DJ override the seeded artist (split release case)", () => {
    renderWithMuiProvider(<RotationEntryFields disabled={false} />);
    selectBinAndRelease();

    const artistInput = screen.getByTestId("flowsheet-search-artist") as HTMLInputElement;
    fireEvent.change(artistInput, { target: { value: "Lightning Bolt" } });

    // The mocked setSearchProperty stores via the same shape as the real hook.
    expect(mockSearchQuery.artist).toBe("Lightning Bolt");
  });
});
