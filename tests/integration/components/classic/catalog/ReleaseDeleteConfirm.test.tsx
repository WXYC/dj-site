import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockGetInformationQuery = vi.fn();
const mockDeleteAlbum = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockGetInformationQuery(...args),
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

const clickDelete = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
};

describe("Classic ReleaseDeleteConfirm — libraryReleaseDelete.jsp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it("states the play count the server named, rather than reporting a success", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, {
          message: "Cannot delete: release has 12 flowsheet plays on record",
          reason: "flowsheet_references",
          play_count: 12,
        }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).textContent).toContain(
        "Cannot delete: release has 12 flowsheet plays on record",
      );
      expect(screen.queryByTestId("release-deleted")).toBeNull();
    });

    it("carries the indirect-path breakdown to the screen intact", async () => {
      const message =
        "Cannot delete: release has 9 flowsheet plays on record (4 linked to the release, 3 via its rotation entry, 2 awaiting linkage from the legacy release id)";
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, { message, reason: "flowsheet_references", play_count: 9 }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).textContent).toContain(message);
    });

    it("withdraws Delete when the refusal was on the merits — pressing again cannot help", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, { message: "Cannot delete: it has plays", reason: "flowsheet_references" }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();
      await screen.findByTestId("release-delete-refusal");

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

    it("says nothing was changed when it cannot read the reason", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(refusal(500, { message: "boom" }));

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).textContent).toContain(
        "Nothing was changed.",
      );
      expect(screen.queryByTestId("release-deleted")).toBeNull();
    });

    it("announces the refusal to a screen reader instead of only colouring it", async () => {
      loaded();
      mockDeleteAlbum.mockReturnValue(
        refusal(409, { message: "Cannot delete: it has plays", reason: "flowsheet_references" }),
      );

      renderWithProviders(<ReleaseDeleteConfirm albumId={53375} />);
      await clickDelete();

      expect((await screen.findByTestId("release-delete-refusal")).getAttribute("role")).toBe("alert");
    });
  });
});
