import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  createTestAlbumSearchResult,
} from "@/lib/test-utils";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { rotationApi } from "@/lib/features/rotation/api";
import RotationBrowse from "./RotationBrowse";

/**
 * Coverage for the live rotation-browse cascade (bin → release → track).
 *
 * RotationBrowse is the production rotation-entry UI the v1 redesign shipped,
 * but its regression protections — the #589 refetch-over-stale-empty-cache
 * guard and the #944 per-track credit normalization — only had tests on the
 * now-dead RotationEntryFields components. This ports equivalent coverage onto
 * the live component so those behaviors are pinned before the v2 smart entry
 * reworks the surrounding surface (plan phase P1).
 */
const ROTATION_ID_WARRIOR = 42;
const ROTATION_ID_JESSICA = 43;

const warriorRelease = createTestAlbumSearchResult({
  id: 7,
  album_title: "Warrior Anthology",
  artist_name: "OOIOO",
  label: "Load Records",
  rotation_id: ROTATION_ID_WARRIOR,
  rotation_bin: "H",
});

const jessicaRelease = createTestAlbumSearchResult({
  id: 8,
  album_title: "On Your Own Love Again",
  artist_name: "Jessica Pratt",
  label: "Drag City",
  rotation_id: ROTATION_ID_JESSICA,
  rotation_bin: "H",
});

type TrackJson = {
  position: string;
  title: string;
  duration: string | null;
  artists: string[];
};
type TracksHandler = (rotationId: number) => TrackJson[];

function mockRotationListAndTracks(
  releases: unknown[],
  handler: TracksHandler
): { trackRequestsFor: (rotationId: number) => number } {
  const callCounts = new Map<number, number>();
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
      HttpResponse.json(releases)
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
  return { trackRequestsFor: (id) => callCounts.get(id) ?? 0 };
}

const selectBinH = async () => {
  // Joy Chip with onClick renders a nested action <button> that owns the
  // handler; the data-testid is on the Chip root, so click the button inside.
  const chip = await screen.findByTestId("rotation-bin-H");
  fireEvent.click(within(chip).getByRole("button"));
};

const selectRelease = async (releaseId: number) =>
  fireEvent.click(await screen.findByTestId(`rotation-release-${releaseId}`));

const openTrackPicker = async () => {
  // The combobox renders while tracks are still loading, but openPanel bails
  // out while disabled (isLoading). Wait for the fetch to settle so the panel
  // actually opens on focus.
  const combobox = await screen.findByTestId("track-picker-combobox");
  await waitFor(() => expect(combobox).not.toBeDisabled());
  fireEvent.focus(combobox);
};

type SetSearchPropertyAction = ReturnType<
  typeof flowsheetSlice.actions.setSearchProperty
>;

const isArtistSetSearchProperty = (a: unknown): a is SetSearchPropertyAction => {
  if (typeof a !== "object" || a === null) return false;
  const action = a as Partial<SetSearchPropertyAction>;
  return (
    action.type === flowsheetSlice.actions.setSearchProperty.type &&
    action.payload?.name === "artist"
  );
};

/** artist values dispatched via setSearchProperty, in dispatch order. */
const artistValues = (dispatchSpy: {
  mock: { calls: unknown[][] };
}): string[] =>
  dispatchSpy.mock.calls
    .map((call) => call[0])
    .filter(isArtistSetSearchProperty)
    .map((a) => a.payload.value);

describe("RotationBrowse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("refetch on release pick (#589)", () => {
    it("re-queries tracks even when the cache already holds an empty tracklist", async () => {
      // A prior prefetch under LML pressure cached `[]` for the release's
      // rotation_id (BS swallowed the LML timeout → 200 + []). The picker must
      // not trust that cached empty; refetchOnMountOrArgChange re-issues the
      // request when the DJ actually picks the release.
      const { trackRequestsFor } = mockRotationListAndTracks(
        [warriorRelease],
        () => [
          { position: "A1", title: "OO I Oh", duration: null, artists: ["OOIOO"] },
        ]
      );

      const { store } = renderWithProviders(<RotationBrowse />);
      store.dispatch(
        rotationApi.util.upsertQueryData(
          "getRotationTracks",
          ROTATION_ID_WARRIOR,
          []
        )
      );

      await selectBinH();
      await selectRelease(warriorRelease.id);

      await waitFor(() =>
        expect(trackRequestsFor(ROTATION_ID_WARRIOR)).toBeGreaterThanOrEqual(1)
      );
      await waitFor(() =>
        expect(screen.getByTestId("track-picker-combobox")).toBeInTheDocument()
      );
    });

    it("issues a separate fetch when switching to a different release in the same bin", async () => {
      const tracksByRotation: Record<number, TrackJson[]> = {
        [ROTATION_ID_WARRIOR]: [
          { position: "A1", title: "OO I Oh", duration: null, artists: ["OOIOO"] },
        ],
        [ROTATION_ID_JESSICA]: [
          { position: "A1", title: "Wrong Hand", duration: null, artists: [] },
        ],
      };
      const { trackRequestsFor } = mockRotationListAndTracks(
        [warriorRelease, jessicaRelease],
        (id) => tracksByRotation[id] ?? []
      );

      renderWithProviders(<RotationBrowse />);
      await selectBinH();

      await selectRelease(warriorRelease.id);
      await waitFor(() =>
        expect(trackRequestsFor(ROTATION_ID_WARRIOR)).toBe(1)
      );

      await selectRelease(jessicaRelease.id);
      await waitFor(() =>
        expect(trackRequestsFor(ROTATION_ID_JESSICA)).toBe(1)
      );
    });
  });

  describe("per-track credit normalization (#944)", () => {
    it("writes a deduped, disambig-stripped artist when a track is picked", async () => {
      // ["Warrior", "Warrior"] must land as a single "Warrior" in the artist
      // field, not "Warrior, Warrior".
      mockRotationListAndTracks([warriorRelease], () => [
        { position: "A2", title: "Warrior", duration: null, artists: ["Warrior", "Warrior"] },
      ]);

      const { store } = renderWithProviders(<RotationBrowse />);
      const dispatchSpy = vi.spyOn(store, "dispatch");

      await selectBinH();
      await selectRelease(warriorRelease.id);
      await openTrackPicker();
      fireEvent.click(await screen.findByTestId("track-picker-option-0"));

      // Bin select clears the fields (""), release select seeds the release
      // artist (OOIOO), track select overrides with the normalized per-track
      // credit (Warrior). The #944 invariant: the final value is the deduped,
      // disambig-stripped credit, not "Warrior, Warrior".
      expect(artistValues(dispatchSpy)).toEqual(["", "OOIOO", "Warrior"]);
    });

    it("does not override the release artist when the track has no per-track credits", async () => {
      mockRotationListAndTracks([warriorRelease], () => [
        { position: "A1", title: "la paradoja", duration: null, artists: [] },
      ]);

      const { store } = renderWithProviders(<RotationBrowse />);
      const dispatchSpy = vi.spyOn(store, "dispatch");

      await selectBinH();
      await selectRelease(warriorRelease.id);
      await openTrackPicker();
      fireEvent.click(await screen.findByTestId("track-picker-option-0"));

      // Bin clear ("") then release seed (OOIOO); an empty-credit track must
      // not dispatch any further artist value.
      expect(artistValues(dispatchSpy)).toEqual(["", "OOIOO"]);
    });
  });

  it("selects a release with an empty artist without throwing and seeds an empty artist", async () => {
    // convertToAlbumEntry always builds an artist object, but a library-unlinked
    // rotation row can carry an empty artist_name. RotationBrowse guards with
    // `release.artist?.name ?? ""`; selection must not throw and must seed "".
    const anonRelease = createTestAlbumSearchResult({
      id: 9,
      album_title: "Untitled",
      artist_name: "",
      label: "",
      rotation_id: 44,
      rotation_bin: "H",
    });
    mockRotationListAndTracks([anonRelease], () => []);

    const { store } = renderWithProviders(<RotationBrowse />);
    const dispatchSpy = vi.spyOn(store, "dispatch");

    await selectBinH();
    await selectRelease(anonRelease.id);

    expect(dispatchSpy).toHaveBeenCalledWith(
      flowsheetSlice.actions.setSearchProperty({ name: "artist", value: "" })
    );
  });
});
