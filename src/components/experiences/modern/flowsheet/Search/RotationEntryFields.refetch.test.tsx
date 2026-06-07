import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  createTestAlbumSearchResult,
} from "@/lib/test-utils";
import { rotationApi } from "@/lib/features/rotation/api";
import RotationEntryFields from "./RotationEntryFields";

// useFlowsheetSearch fans out into many RTK Query hooks (live show, bin,
// catalog, rotation, LML). Mocking it here matches the sibling
// RotationEntryFields.test.tsx pattern so this file only owns the rotation
// surface. Refetch behavior is what's under test; the search-side effects of
// release selection (the dispatch calls in handleSelectRelease) are not.
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    setSearchOpen: vi.fn(),
    getDisplayValue: () => "",
    setSearchProperty: vi.fn(),
    selectedIndex: 0,
    selectedEntry: null,
  }),
}));

const ROTATION_ID_OOIOO = 42;
const ROTATION_ID_JESSICA_PRATT = 43;

const ooioo = createTestAlbumSearchResult({
  id: 7,
  album_title: "OOIOO / Lightning Bolt Split",
  artist_name: "OOIOO",
  label: "Load Records",
  rotation_id: ROTATION_ID_OOIOO,
  rotation_bin: "H",
});

const jessicaPratt = createTestAlbumSearchResult({
  id: 8,
  album_title: "On Your Own Love Again",
  artist_name: "Jessica Pratt",
  label: "Drag City",
  rotation_id: ROTATION_ID_JESSICA_PRATT,
  rotation_bin: "H",
});

const trackForOoioo = {
  position: "A1",
  title: "OO I Oh",
  duration: null,
  artists: ["OOIOO"],
};

type TracksHandler = (rotationId: number) => unknown[];

function mockRotationListAndTracks(handler: TracksHandler): {
  trackRequestsFor: (rotationId: number) => number;
} {
  const callCounts = new Map<number, number>();
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
      HttpResponse.json([ooioo, jessicaPratt])
    ),
    http.get(
      `${TEST_BACKEND_URL}/library/rotation/:rotation_id/tracks`,
      ({ params }) => {
        const rotationId = Number(params.rotation_id);
        callCounts.set(rotationId, (callCounts.get(rotationId) ?? 0) + 1);
        return HttpResponse.json(handler(rotationId));
      }
    )
  );
  return {
    trackRequestsFor: (rotationId) => callCounts.get(rotationId) ?? 0,
  };
}

const selectBin = () => fireEvent.click(screen.getByRole("radio", { name: "H" }));

const selectRelease = async (releaseId: number) => {
  const trigger = await screen.findByTestId("rotation-release-combobox");
  fireEvent.focus(trigger);
  fireEvent.click(
    await screen.findByTestId(`rotation-release-option-${releaseId}`)
  );
};

describe("RotationEntryFields — refetch on release pick (#589)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-queries when a release is picked, even if the cache already holds an empty tracklist from a prefetch", async () => {
    // A prior prefetch wave under LML pressure cached `[]` for OOIOO's
    // rotation_id (BS swallowed the LML timeout → `200 + []`). The picker
    // must not trust that cached empty; it should re-issue the request when
    // the DJ actually picks the release.
    const { trackRequestsFor } = mockRotationListAndTracks(() => [trackForOoioo]);

    const { store } = renderWithProviders(<RotationEntryFields disabled={false} />);
    store.dispatch(
      rotationApi.util.upsertQueryData("getRotationTracks", ROTATION_ID_OOIOO, [])
    );

    selectBin();
    await selectRelease(ooioo.id);

    await waitFor(() =>
      expect(trackRequestsFor(ROTATION_ID_OOIOO)).toBeGreaterThanOrEqual(1)
    );
    await waitFor(() =>
      expect(screen.getByTestId("track-picker-combobox")).toBeInTheDocument()
    );
  });

  it("issues a separate fetch when the DJ switches to a different release in the same bin", async () => {
    const tracksByRotation: Record<number, unknown[]> = {
      [ROTATION_ID_OOIOO]: [trackForOoioo],
      [ROTATION_ID_JESSICA_PRATT]: [
        { position: "A1", title: "Wrong Hand", duration: null, artists: [] },
      ],
    };
    const { trackRequestsFor } = mockRotationListAndTracks(
      (rotationId) => tracksByRotation[rotationId] ?? []
    );

    renderWithProviders(<RotationEntryFields disabled={false} />);

    selectBin();
    await selectRelease(ooioo.id);
    await waitFor(() => expect(trackRequestsFor(ROTATION_ID_OOIOO)).toBe(1));

    await selectRelease(jessicaPratt.id);
    await waitFor(() =>
      expect(trackRequestsFor(ROTATION_ID_JESSICA_PRATT)).toBe(1)
    );
  });

  it("recovers without a page reload when LML returns tracks on a subsequent pick", async () => {
    // First call to OOIOO's rotation_id returns empty (LML still saturated);
    // second call returns the real tracklist. Going back to OOIOO must
    // re-fetch and render the dropdown, not serve the cached empty.
    const responsesByRotation = new Map<number, unknown[][]>([
      [ROTATION_ID_OOIOO, [[], [trackForOoioo]]],
      [ROTATION_ID_JESSICA_PRATT, [[]]],
    ]);
    mockRotationListAndTracks((rotationId) => {
      const queue = responsesByRotation.get(rotationId) ?? [];
      return queue.shift() ?? [];
    });

    renderWithProviders(<RotationEntryFields disabled={false} />);

    selectBin();
    await selectRelease(ooioo.id);
    await waitFor(() =>
      expect(screen.queryByTestId("track-picker-combobox")).not.toBeInTheDocument()
    );

    await selectRelease(jessicaPratt.id);
    await selectRelease(ooioo.id);

    await waitFor(() =>
      expect(screen.getByTestId("track-picker-combobox")).toBeInTheDocument()
    );
  });
});
