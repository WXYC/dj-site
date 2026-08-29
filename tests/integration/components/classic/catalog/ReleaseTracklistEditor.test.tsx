import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockGetInformationQuery = vi.fn();
const mockGetCompilationTracksQuery = vi.fn();
const mockFetchSuggestions = vi.fn();
const mockUseLazyGetCompilationTrackSuggestionsQuery = vi.fn();
const mockWriteCompilationTracks = vi.fn();
const mockRefetchStored = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockGetInformationQuery(...args),
    useGetCompilationTracksQuery: (...args: unknown[]) => mockGetCompilationTracksQuery(...args),
    useLazyGetCompilationTrackSuggestionsQuery: (...args: unknown[]) =>
      mockUseLazyGetCompilationTrackSuggestionsQuery(...args),
    useWriteCompilationTracksMutation: () => [
      mockWriteCompilationTracks,
      { isLoading: false },
    ],
  };
});

import ReleaseTracklistEditor from "@/src/components/experiences/classic/catalog/ReleaseTracklistEditor";

const VA_ALBUM_ID = 53390;

const vaAlbum = (overrides = {}) =>
  createTestAlbum({
    id: VA_ALBUM_ID,
    title: "A Freeform Sampler",
    entry: 4,
    format: "cd",
    format_id: 1,
    label: "self-released",
    album_artist: "Various",
    genre_id: 3,
    artist: createTestArtist({
      name: "Various Artists - Rock - S",
      lettercode: "V/A",
      numbercode: 0,
      genre: "Rock",
    }),
    ...overrides,
  });

const ordinaryAlbum = (overrides = {}) =>
  createTestAlbum({
    id: 53375,
    title: "Tri Repetae",
    entry: 1,
    format: "cd",
    format_id: 1,
    label: "Warp",
    artist: createTestArtist({
      name: "Autechre",
      lettercode: "AU",
      numbercode: 3,
      genre: "Electronic",
    }),
    ...overrides,
  });

const emptyStored = { data: { library_id: VA_ALBUM_ID, tracks: [] }, isError: false, isFetching: false, refetch: mockRefetchStored };

beforeEach(() => {
  mockGetInformationQuery.mockReset();
  mockGetCompilationTracksQuery.mockReset();
  mockFetchSuggestions.mockReset();
  mockUseLazyGetCompilationTrackSuggestionsQuery.mockReset();
  mockWriteCompilationTracks.mockReset();
  mockRefetchStored.mockReset();
  mockUseLazyGetCompilationTrackSuggestionsQuery.mockReturnValue([
    mockFetchSuggestions,
    { isFetching: false },
  ]);
  mockGetCompilationTracksQuery.mockReturnValue(emptyStored);
});

describe("Classic ReleaseTracklistEditor", () => {
  it("shows a loading state while the release loads", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    expect(screen.getByText("Loading the release...")).toBeDefined();
  });

  it("surfaces a load failure rather than rendering an empty editor", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    expect(screen.getByTestId("release-tracklist-error")).toBeDefined();
  });

  it("is gated on the structural V/A code, not the display-only album_artist field", () => {
    // album_artist is set (as VariousArtistsCard's add path would leave it
    // unset until the nightly import runs), but the artist's own code_letters
    // is an ordinary one — this must NOT be treated as a compilation.
    mockGetInformationQuery.mockReturnValue({
      data: ordinaryAlbum({ album_artist: "Various" }),
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={53375} />);

    expect(screen.getByTestId("release-tracklist-not-various")).toBeDefined();
    expect(screen.queryByTestId("release-tracklist-form")).toBeNull();
  });

  it("recognizes the legacy Z-<letter> spelling as a compilation", () => {
    mockGetInformationQuery.mockReturnValue({
      data: vaAlbum({ artist: createTestArtist({ name: "Soundtracks - S", lettercode: "Z-S", numbercode: 0, genre: "Rock" }) }),
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    expect(screen.getByTestId("release-tracklist-form")).toBeDefined();
  });

  it("renders the already-filed credits for a compilation release", () => {
    mockGetInformationQuery.mockReturnValue({ data: vaAlbum(), isLoading: false, isError: false });
    mockGetCompilationTracksQuery.mockReturnValue({
      data: {
        library_id: VA_ALBUM_ID,
        tracks: [
          { id: 1, artist_name: "Chuquimamani-Condori", track_title: "Call Your Name", track_position: "A1" },
          { id: 2, artist_name: "Nilüfer Yanya", track_title: "Stabilise", track_position: "A2" },
        ],
      },
      isError: false,
      isFetching: false,
      refetch: mockRefetchStored,
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    const stored = screen.getByTestId("release-tracklist-stored");
    expect(stored.textContent).toContain("Chuquimamani-Condori");
    expect(stored.textContent).toContain("Nilüfer Yanya");
  });

  it("scopes every query and the write to the Backend library.id, never the legacy release id", async () => {
    const user = userEvent.setup();
    mockGetInformationQuery.mockReturnValue({
      data: vaAlbum({ legacy_release_id: 91100 }),
      isLoading: false,
      isError: false,
    });
    mockWriteCompilationTracks.mockReturnValue({ unwrap: () => Promise.resolve({ library_id: VA_ALBUM_ID, inserted: 1, skipped: 0, tracks: [] }) });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    expect(mockGetCompilationTracksQuery).toHaveBeenCalledWith({ libraryId: VA_ALBUM_ID });

    await user.type(screen.getByLabelText("Artist for track 1"), "Juana Molina");
    await user.type(screen.getByLabelText("Title for track 1"), "la paradoja");
    await user.click(screen.getByDisplayValue("Save Track Credits"));

    await waitFor(() =>
      expect(mockWriteCompilationTracks).toHaveBeenCalledWith({
        libraryId: VA_ALBUM_ID,
        tracks: [{ artist_name: "Juana Molina", track_title: "la paradoja", track_position: null }],
      }),
    );
  });

  it("refuses to submit with no artist entered on any row", async () => {
    const user = userEvent.setup();
    mockGetInformationQuery.mockReturnValue({ data: vaAlbum(), isLoading: false, isError: false });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    await user.click(screen.getByDisplayValue("Save Track Credits"));

    expect(mockWriteCompilationTracks).not.toHaveBeenCalled();
    expect(screen.getByTestId("release-tracklist-message").textContent).toContain(
      "Enter at least one artist credit",
    );
  });

  it("reports the server's inserted/skipped counts after a successful save", async () => {
    const user = userEvent.setup();
    mockGetInformationQuery.mockReturnValue({ data: vaAlbum(), isLoading: false, isError: false });
    mockWriteCompilationTracks.mockReturnValue({
      unwrap: () => Promise.resolve({ library_id: VA_ALBUM_ID, inserted: 1, skipped: 1, tracks: [] }),
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    await user.type(screen.getByLabelText("Artist for track 1"), "Stereolab");
    await user.click(screen.getByDisplayValue("Save Track Credits"));

    await waitFor(() =>
      expect(screen.getByTestId("release-tracklist-message").textContent).toContain(
        "Filed 1 new credit(s); 1 already on file.",
      ),
    );
  });

  // The additive-only write can never amend or remove a row, so a corrected
  // resubmission after a lost response would file a duplicate rather than a
  // correction. Saving must therefore refuse to proceed on an unknown base
  // state, not just on a known bad one.
  it("disables saving while the already-filed credits could not be confirmed", async () => {
    mockGetInformationQuery.mockReturnValue({ data: vaAlbum(), isLoading: false, isError: false });
    mockGetCompilationTracksQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch: mockRefetchStored,
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    expect(screen.getByDisplayValue("Save Track Credits")).toHaveProperty("disabled", true);
  });

  it("imports Discogs suggestions that are not already on file", async () => {
    const user = userEvent.setup();
    mockGetInformationQuery.mockReturnValue({ data: vaAlbum(), isLoading: false, isError: false });
    mockGetCompilationTracksQuery.mockReturnValue({
      data: {
        library_id: VA_ALBUM_ID,
        tracks: [{ id: 1, artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" }],
      },
      isError: false,
      isFetching: false,
      refetch: mockRefetchStored,
    });
    mockFetchSuggestions.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          library_id: VA_ALBUM_ID,
          discogs_release_id: 4242,
          tracks: [
            { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
            { artist_name: "Hermanos Gutiérrez", track_title: "Thousand Days", track_position: "A2" },
          ],
        }),
    });

    renderWithProviders(<ReleaseTracklistEditor albumId={VA_ALBUM_ID} />);

    await user.click(screen.getByRole("button", { name: "Check Discogs for a Tracklist" }));

    await waitFor(() => expect(screen.getByLabelText("Artist for track 1")).toHaveProperty("value", "Hermanos Gutiérrez"));
    // The already-filed Jessica Pratt credit must not be re-offered as new.
    expect(screen.queryByDisplayValue("Jessica Pratt")).toBeNull();
  });
});
