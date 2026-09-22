import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist, renderWithProviders } from "@/tests/helpers";

const mockGetInformationQuery = vi.fn();
const mockGetFlowsheetPlayCountsQuery = vi.fn();
const mockDeleteAlbum = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockGetInformationQuery(...args),
    useGetFlowsheetPlayCountsQuery: (...args: unknown[]) => mockGetFlowsheetPlayCountsQuery(...args),
    useDeleteAlbumMutation: () => [mockDeleteAlbum, { isLoading: false }],
  };
});

import ReleaseDeleteConfirm from "@/src/components/experiences/classic/catalog/ReleaseDeleteConfirm";

const album = (overrides = {}) =>
  createTestAlbum({
    id: 53375,
    title: "Tri Repetae",
    entry: 1,
    format: "cd",
    alternate_artist: "Autechre",
    artist: createTestArtist({
      id: 4211,
      name: "Autechre",
      lettercode: "AU",
      numbercode: 3,
      genre: "Electronic",
    }),
    ...overrides,
  });

const rejectsWith = (error: unknown) => ({ unwrap: () => Promise.reject(error) });
const refusal = (status: number, data: unknown) => rejectsWith({ deleteAlbumError: { status, data } });

const loaded = (overrides = {}) =>
  mockGetInformationQuery.mockReturnValue({
    data: album(overrides),
    isLoading: false,
    isError: false,
  });

const playCounts = (
  counts: { direct: number; rotation_linked: number; legacy_linked: number },
) => mockGetFlowsheetPlayCountsQuery.mockReturnValue({ data: counts, isError: false });

const playCountsLoading = () =>
  mockGetFlowsheetPlayCountsQuery.mockReturnValue({ data: undefined, isError: false });

const playCountsFailed = () =>
  mockGetFlowsheetPlayCountsQuery.mockReturnValue({ data: undefined, isError: true });

const clickDelete = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
};

describe("Classic ReleaseDeleteConfirm — libraryReleaseDelete.jsp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every existing test predates the flowsheet-play-impact reading and
    // does not care about it; a release with no plays is the least
    // surprising default so those tests keep asserting what they always
    // asserted.
    playCounts({ direct: 0, rotation_linked: 0, legacy_linked: 0 });
  });

  it("reproduces the JSP's heading and its six rows, in order", () => {
    loaded();

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

    expect(screen.getByText("Delete a Library Release")).toBeDefined();
    const labels = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent?.trim())
      .filter((text): text is string => !!text && text.endsWith(":"));
    expect(labels).toEqual([
      "Library Code:",
      "Artist:",
      "Alternate Artist Name:",
      "Title of Release:",
      "Format:",
      "Date Added:",
    ]);
  });

  it("shows the release it is about to delete, not a blank confirmation", () => {
    loaded();

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

    expect(screen.getByTestId("release-delete-library-code").textContent).toBe("Electronic AU 3/1");
    expect(screen.getByTestId("release-delete-title").textContent).toBe("Tri Repetae");
    expect(screen.getByTestId("release-delete-alternate-artist").textContent).toBe("Autechre");
    expect(screen.getByTestId("release-delete-format").textContent).toBe("cd");
  });

  it("renders nothing to press while the release is still loading", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("refuses to offer a delete for a release it could not load", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

    expect(screen.getByTestId("release-delete-error")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("names the artist the release will leave, so the delete cannot be filed blind", () => {
    loaded();

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

    expect(screen.getByRole("link", { name: "Autechre" }).getAttribute("href")).toBe(
      "/dashboard/library/artist/4211",
    );
  });

  /**
   * An `artists` row is not one band. Two acts filed under the same name in
   * different genres share it, and `genre_artist_crossreference` is unique on
   * the (artist, genre) pair — so the artist id alone does not identify a
   * card, and an unscoped link collapses onto the artist's lowest genre. Both
   * links here sit on the confirmation for an irreversible delete, and the
   * release itself names which of the two shelves it is filed on.
   */
  it.each(["Autechre", "Back to the artist card"])(
    "scopes the %s link to the genre the release is filed under",
    (linkName) => {
      loaded({ genre_id: 11 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect(screen.getByRole("link", { name: linkName }).getAttribute("href")).toBe(
        "/dashboard/library/artist/4211?genre_id=11",
      );
    },
  );

  // A release read that carries no genre must still produce a working link
  // rather than `?genre_id=undefined`.
  it.each(["Autechre", "Back to the artist card"])(
    "leaves the %s link unscoped when the release carries no genre",
    (linkName) => {
      loaded();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect(screen.getByRole("link", { name: linkName }).getAttribute("href")).toBe(
        "/dashboard/library/artist/4211",
      );
    },
  );

  it("sends the artist id so the artist's release table drops the row too", async () => {
    loaded();
    mockDeleteAlbum.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

    renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
    await clickDelete();

    expect(mockDeleteAlbum).toHaveBeenCalledWith({ albumId: 53375, artistId: 4211 });
  });

  describe("after a delete that succeeded — libraryReleaseDeleted.jsp", () => {
    it("swaps to the JSP's past-tense heading", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect(await screen.findByTestId("release-deleted")).toBeDefined();
      expect(screen.getByText("The following Library Release has been deleted:")).toBeDefined();
    });

    it("keeps showing the release from a snapshot, since the row it was reading is gone", async () => {
      loaded();
      // The row behind this screen can stop resolving at any point after the
      // delete — an eviction, a refetch this component did not ask for.
      // Reading live through to that would replace the confirmation with a
      // load failure, telling the librarian the delete broke having just
      // watched it work. Flipping the query mock as the delete resolves
      // reproduces that ordering rather than asserting against a second
      // mount.
      mockDeleteAlbum.mockReturnValue({
        unwrap: () => {
          mockGetInformationQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
          });
          return Promise.resolve(undefined);
        },
      });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect(await screen.findByTestId("release-deleted")).toBeDefined();
      expect(screen.getByTestId("release-delete-title").textContent).toBe("Tri Repetae");
      expect(screen.queryByTestId("release-delete-error")).toBeNull();
    });

    it("offers no second Delete", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();
      await screen.findByTestId("release-deleted");

      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    });
  });

  describe("after a delete the server refused", () => {
    // A release with flowsheet plays deletes in one click now — the
    // confirmation screen states the impact instead of the server refusing
    // it. What is left is the archive refusal: a bound `digital_asset` row,
    // evidence that a recording exists, with no FK for the delete to cascade
    // through. It is the only refusal on the merits the endpoint still
    // raises, so the screen names it rather than degrading to the fallback,
    // whose sentence would claim the reason could not be read about a reply
    // that states the reason, the count and the asset ids.
    it("names the archive binding for the 409, and withdraws Delete", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, {
          message: "Cannot delete: release has 2 digital assets on record (ids: 88, 91)",
          reason: "digital_asset_references",
          asset_count: 2,
        }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      const banner = await screen.findByTestId("release-delete-refusal");
      expect(banner.textContent).toContain("audio archive");
      expect(banner.textContent).toContain("2 recordings");
      expect(banner.textContent).toContain("Nothing was changed");
      expect(banner.textContent).not.toContain("the reason could not be read");
      // The ids address rows no screen here can open; printing them sends the
      // librarian looking for a page that does not exist.
      expect(banner.textContent).not.toContain("88");
      expect(screen.queryByTestId("release-deleted")).toBeNull();
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    });

    it("keeps Delete for a lock stand-down, which is a retry and not a verdict", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(503, {
          message: "Could not delete: the release is being written to right now. Try again in a moment.",
          reason: "lock_unavailable",
        }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();
      await screen.findByTestId("release-delete-refusal");

      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
    });

    it("says nothing was changed only when the server answered without writing", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(refusal(400, { message: "bad id" }));

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).textContent).toContain(
        "Nothing was changed.",
      );
      expect(screen.queryByTestId("release-deleted")).toBeNull();
    });

    it("refuses to claim nothing changed when no answer came back, and keeps Delete", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(refusal(500, { message: "boom" }));

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      // The delete may have committed on a response that never arrived.
      // Telling the librarian it definitely did not is the one claim this
      // branch cannot support — and a second press is safe, since a deleted
      // row answers 404 and reads as "already gone".
      const banner = await screen.findByTestId("release-delete-refusal");
      expect(banner.textContent).not.toContain("Nothing was changed");
      expect(banner.textContent).toContain("may or may not have been deleted");
      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
    });

    it("announces the refusal to a screen reader instead of only colouring it", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, { message: "Cannot delete: it has other references", reason: "digital_asset_references" }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).getAttribute("role")).toBe("alert");
    });
  });

  describe("the flowsheet play-impact reading", () => {
    it("says a release with no plays has none on record", async () => {
      loaded();
      playCounts({ direct: 0, rotation_linked: 0, legacy_linked: 0 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect((await screen.findByTestId("release-delete-play-impact")).textContent).toBe(
        "This release has no plays on record.",
      );
    });

    it("names the direct and rotation-linked counts when there is no legacy-linked arm", async () => {
      loaded();
      playCounts({ direct: 41, rotation_linked: 6, legacy_linked: 0 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect((await screen.findByTestId("release-delete-play-impact")).textContent).toBe(
        "47 archived plays are linked to this release — 41 directly, 6 through its rotation entry. " +
          "They keep their artist, album and label text and lose their link to this card.",
      );
    });

    it("gives the legacy-linked arm its own sentence when it is non-zero", async () => {
      loaded();
      playCounts({ direct: 41, rotation_linked: 6, legacy_linked: 2 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      const text = (await screen.findByTestId("release-delete-play-impact")).textContent;
      expect(text).toBe(
        "47 archived plays are linked to this release — 41 directly, 6 through its rotation entry. " +
          "They keep their artist, album and label text and lose their link to this card. " +
          "2 more archived plays were filed without a link and name this release only by its old catalog number, which nothing will resolve once the card is gone.",
      );
      // No stated total may disagree with the arms enumerated beneath it: 47 is
      // the linked pair in full, and the legacy arm joins it in neither
      // direction.
      expect(text).not.toContain("49");
    });

    it("shows only the legacy sentence when every linked play has already been re-pointed", async () => {
      loaded();
      playCounts({ direct: 0, rotation_linked: 0, legacy_linked: 5 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      // Not "0 archived plays are linked ... 0 directly, 0 through its rotation
      // entry", which is a sentence about nothing followed by a promise about
      // an empty set.
      expect((await screen.findByTestId("release-delete-play-impact")).textContent).toBe(
        "5 archived plays were filed without a link and name this release only by its old catalog number, which nothing will resolve once the card is gone.",
      );
    });

    it("shows a loading state rather than a guess while the counts are in flight", async () => {
      loaded();
      playCountsLoading();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect((await screen.findByTestId("release-delete-play-impact")).textContent).toBe(
        "Checking flowsheet plays...",
      );
    });

    // The whole reason the screen reads the counts. `keepUnusedDataFor: 0`
    // makes this read cold on every visit while the release row resolves from
    // an already-warm entry, so the gap is not hypothetical — the screen
    // routinely paints with the placeholder showing. A live Delete over it
    // lets the librarian commit the irreversible write having been told
    // nothing, which is the state the pre-delete read exists to prevent.
    it("holds Delete back while the impact sentence is still a placeholder", async () => {
      loaded();
      playCountsLoading();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await screen.findByTestId("release-delete-play-impact");

      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    });

    // Held, not withdrawn. Withdrawing it would flip the adjacent link to the
    // refusal's "Back to this release" and read as a verdict that has not
    // been reached.
    it("keeps Delete on screen while it is held, with Cancel still reading as Cancel", async () => {
      loaded();
      playCountsLoading();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await screen.findByTestId("release-delete-play-impact");

      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Cancel" })).toBeDefined();
      expect(screen.queryByRole("link", { name: "Back to this release" })).toBeNull();
    });

    it("does not delete on a click landed before the counts arrive", async () => {
      loaded();
      playCountsLoading();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await screen.findByTestId("release-delete-play-impact");
      await clickDelete();

      expect(mockDeleteAlbum).not.toHaveBeenCalled();
    });

    it("goes live once the sentence beside it does", async () => {
      loaded();
      playCounts({ direct: 41, rotation_linked: 6, legacy_linked: 2 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await screen.findByTestId("release-delete-play-impact");

      expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled();
    });

    // The cell is painted as a placeholder and rewritten in place, so a
    // screen-reader user who has already moved past it is never told the
    // sentence arrived — the one sentence the screen exists to deliver.
    // `polite` rather than `assertive`: it is not an alert, and the button
    // beside it is held until it lands.
    it("announces the impact sentence when it replaces the placeholder", async () => {
      loaded();
      playCounts({ direct: 41, rotation_linked: 6, legacy_linked: 0 });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      expect(
        (await screen.findByTestId("release-delete-play-impact")).getAttribute("aria-live"),
      ).toBe("polite");
    });

    // A body that answered but cannot be counted must not render as an absent
    // row: `playImpactMessage ? <row> : null` would drop the row entirely on
    // an empty string, confirming an irreversible delete in silence. The
    // endpoint is absent from the published contract, so a renamed arm has no
    // gate to catch it.
    it("still states something when the counts come back uncountable", async () => {
      loaded();
      mockGetFlowsheetPlayCountsQuery.mockReturnValue({
        data: { direct: 41, rotation_linked: 6 },
        isError: false,
      });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      const row = await screen.findByTestId("release-delete-play-impact");
      expect(row.textContent).toBe(
        "The flowsheet play count for this release could not be checked.",
      );
      expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled();
    });

    it("admits it could not check, rather than claiming the release has no plays", async () => {
      loaded();
      playCountsFailed();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);

      const text = (await screen.findByTestId("release-delete-play-impact")).textContent;
      expect(text).toBe("The flowsheet play count for this release could not be checked.");
      expect(text).not.toBe("This release has no plays on record.");
    });

    it("does not gate the delete on the play-count read failing", async () => {
      loaded();
      playCountsFailed();

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await screen.findByTestId("release-delete-play-impact");

      // The counts are informational; a DJ can already read every flowsheet
      // play with no authentication at all, and the delete no longer refuses
      // on them either. An unreadable advisory count must not become a
      // gate the JSP itself never had. This is the line the in-flight hold
      // must not cross: a read still arriving resolves in milliseconds, while
      // a failed one never resolves, so holding on it would be permanent.
      expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled();
    });

    it("stops reading play counts once the delete has already succeeded", async () => {
      loaded();
      playCounts({ direct: 41, rotation_linked: 6, legacy_linked: 0 });
      mockDeleteAlbum.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();
      await screen.findByTestId("release-deleted");

      // Refetching against a now-deleted id would 404, which has nothing to
      // do with the delete that already succeeded — the query is skipped
      // instead, the same discipline the frozen `deleted` snapshot applies
      // to the rest of the screen.
      const lastCall = mockGetFlowsheetPlayCountsQuery.mock.calls.at(-1);
      expect(lastCall?.[1]).toEqual({ skip: true });
      expect(screen.queryByTestId("release-delete-play-impact")).toBeNull();
    });
  });
});
