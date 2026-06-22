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
  // the component reads. Returning a minimal {data, isLoading, isFetching}
  // subset is fine because the component never reads refetch /
  // fulfilledTimeStamp / etc.
  //
  // Surface `isFetching` from the same source as `isLoading` — the component
  // reads `isFetching` to keep the picker visible across refetches (BS#589),
  // but at this tier we only have one "loading" knob to drive. Refetch-on-
  // arg-change behavior is exercised in RotationEntryFields.refetch.test.tsx
  // with MSW + real RTK Query.
  const actual = await vi.importActual<typeof import("@/lib/features/rotation/api")>(
    "@/lib/features/rotation/api"
  );
  return {
    ...actual,
    useGetRotationQuery: () => ({ data: mockRotationData }),
    useGetRotationTracksQuery: () => ({
      data: mockTracksData,
      isLoading: mockTracksLoading,
      isFetching: mockTracksLoading,
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
  fireEvent.focus(screen.getByTestId("rotation-release-combobox"));
  fireEvent.click(
    screen.getByTestId(`rotation-release-option-${lightningBoltOoioo.id}`)
  );
};

const selectTrack = (index: number) => {
  fireEvent.click(screen.getByTestId("track-picker-combobox"));
  fireEvent.click(screen.getByTestId(`track-picker-option-${index}`));
};

describe("RotationEntryFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchQuery = { artist: "", song: "", album: "", label: "" };
    mockRotationData = [lightningBoltOoioo];
    mockTracksData = undefined;
    mockTracksLoading = false;
  });

  // Regression: a library-unlinked rotation release can arrive with no `artist`
  // object. handleSelectRelease seeded the search query with
  // `release.artist.name`, throwing on select. The dropdown render guard lets
  // the option appear; this guards the seed so it falls back to an empty artist
  // instead of crashing. Same null-artist class as the sibling guards.
  it("selects a null-artist release without throwing and seeds an empty artist", () => {
    const nullArtistRelease = {
      ...createTestAlbum({
        id: 8,
        title: "Untitled",
        rotation_id: 43,
        rotation_bin: "H",
      }),
      artist: null,
    } as unknown as ReturnType<typeof createTestAlbum>;
    mockRotationData = [nullArtistRelease];

    const { store } = renderWithProviders(<RotationEntryFields disabled={false} />);
    const dispatchSpy = vi.spyOn(store, "dispatch");

    expect(() => {
      fireEvent.click(screen.getByRole("radio", { name: "H" }));
      fireEvent.focus(screen.getByTestId("rotation-release-combobox"));
      fireEvent.click(screen.getByTestId("rotation-release-option-8"));
    }).not.toThrow();

    expect(dispatchSpy).toHaveBeenCalledWith(
      flowsheetSlice.actions.setSearchProperty({ name: "artist", value: "" })
    );
  });

  it("never renders an artist input — rotation mode has no override UI", () => {
    renderWithProviders(<RotationEntryFields disabled={false} />);
    expect(
      screen.queryByTestId("flowsheet-search-artist")
    ).not.toBeInTheDocument();

    selectBinAndRelease();

    expect(
      screen.queryByTestId("flowsheet-search-artist")
    ).not.toBeInTheDocument();
  });

  it("seeds the artist into the search query on release selection", () => {
    // The artist is no longer rendered as an input, but the value still has
    // to flow into Redux so form submission carries the release's primary
    // artist. Assert against the real action creator to catch slice drift.
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

  describe("track-selection artist auto-fill", () => {
    // When a DJ picks a track from the dropdown, we override the artist that
    // handleSelectRelease seeded iff the per-track Discogs credits (surfaced
    // by BS#944) carry artist names. This covers V/A and split releases
    // without any new UI. For normal releases BS falls back to
    // [release.artist] so the value is identical to what handleSelectRelease
    // already set; the override is functionally a no-op.
    //
    // Test invariant: spy on `store.dispatch` *before* any clicks. react-redux's
    // useDispatch captures the dispatch reference at mount time, so spying
    // after a click won't intercept later dispatches from the captured ref.
    const artistValues = (
      dispatchSpy: { mock: { calls: unknown[][] } }
    ): string[] =>
      dispatchSpy.mock.calls
        .map(
          (call) =>
            call[0] as ReturnType<typeof flowsheetSlice.actions.setSearchProperty>
        )
        .filter(
          (action) =>
            action?.type === flowsheetSlice.actions.setSearchProperty.type &&
            action.payload.name === "artist"
        )
        .map((action) => action.payload.value);

    it("does not change artist when track has no per-track credits", () => {
      mockTracksData = [
        { position: "A1", title: "la paradoja", duration: null, artists: [] },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      // Release select dispatches artist=OOIOO; track select with empty
      // credits must not dispatch any further artist value.
      expect(artistValues(dispatchSpy)).toEqual(["OOIOO"]);
    });

    it("sets artist to track's single per-track credit on V/A releases", () => {
      mockTracksData = [
        {
          position: "A1",
          title: "Smoke Signal",
          duration: null,
          artists: ["Skull Mitten"],
        },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      expect(dispatchSpy).toHaveBeenCalledWith(
        flowsheetSlice.actions.setSearchProperty({
          name: "artist",
          value: "Skull Mitten",
        })
      );
    });

    it("joins multi-credit tracks with ', '", () => {
      mockTracksData = [
        {
          position: "A1",
          title: "Drum Circle",
          duration: null,
          artists: ["Skull Mitten", "Various Drummers"],
        },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      expect(dispatchSpy).toHaveBeenCalledWith(
        flowsheetSlice.actions.setSearchProperty({
          name: "artist",
          value: "Skull Mitten, Various Drummers",
        })
      );
    });

    it("dedupes doubled per-track credits before writing to the artist field", () => {
      // Reproduces the on-air-DJ report from 2026-05-25: V/A track artists
      // arrive as ["Warrior", "Warrior"] (Discogs multi-role on a single
      // person + on-disk LML cache duplicates) and used to land in the Redux
      // artist field as "Warrior, Warrior". After normalization the field
      // gets a single "Warrior".
      mockTracksData = [
        {
          position: "A2",
          title: "Warrior",
          duration: null,
          artists: ["Warrior", "Warrior"],
        },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      expect(artistValues(dispatchSpy)).toEqual(["OOIOO", "Warrior"]);
    });

    it("strips Discogs (N) disambig before writing to the artist field", () => {
      // Prod LML serves disambig suffixes verbatim — "M.I.A. (2)" appears in
      // the top-20 dup tuples (4× releases). Stripping in the dropdown display
      // only (the prior behavior) left the suffix in the form field on submit.
      mockTracksData = [
        {
          position: "A1",
          title: "Galang",
          duration: null,
          artists: ["M.I.A. (2)"],
        },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      expect(artistValues(dispatchSpy)).toEqual(["OOIOO", "M.I.A."]);
    });

    it("falls back to the release-level artist when every per-track credit is malformed", () => {
      // A partial-write LML cache row could surface [null, ""] as artists.
      // normalizeTrackArtists returns [] for that shape; the auto-fill must
      // be a no-op so the release-level artist (seeded by handleSelectRelease)
      // stays in the field rather than being clobbered with an empty string.
      mockTracksData = [
        {
          position: "A1",
          title: "Ghost Track",
          duration: null,
          artists: [null as unknown as string, ""],
        },
      ];

      const { store } = renderWithProviders(
        <RotationEntryFields disabled={false} />
      );
      const dispatchSpy = vi.spyOn(store, "dispatch");
      selectBinAndRelease();
      selectTrack(0);

      expect(artistValues(dispatchSpy)).toEqual(["OOIOO"]);
    });
  });
});
