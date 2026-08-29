"use client";

import { useState } from "react";
import {
  useGetCompilationTracksQuery,
  useGetInformationQuery,
  useLazyGetCompilationTrackSuggestionsQuery,
  useWriteCompilationTracksMutation,
} from "@/lib/features/catalog/api";
import { compilationTrackCreditKey } from "@/lib/features/catalog/compilationTrackCredits";
import { formatEntireLibraryCode, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import type { CompilationTrackInput } from "@/lib/features/catalog/types";

type DraftRow = {
  /** Stable across edits and removals, so React never reuses one row's DOM for another. */
  key: number;
  artist_name: string;
  track_title: string;
  track_position: string;
};

let nextRowKey = 0;
const blankRow = (): DraftRow => ({
  key: nextRowKey++,
  artist_name: "",
  track_title: "",
  track_position: "",
});

const isBlankRow = (row: DraftRow) =>
  row.artist_name.trim() === "" &&
  row.track_title.trim() === "" &&
  row.track_position.trim() === "";

const rowFromSuggestion = (track: CompilationTrackInput): DraftRow => ({
  key: nextRowKey++,
  artist_name: track.artist_name,
  track_title: track.track_title ?? "",
  track_position: track.track_position ?? "",
});

/** Blank optional fields are stored as NULL, not as empty strings — matches the write endpoint's own convention. */
const toInput = (row: DraftRow): CompilationTrackInput => ({
  artist_name: row.artist_name.trim(),
  track_title: row.track_title.trim() || null,
  track_position: row.track_position.trim() || null,
});

/**
 * "Enter per-track credits for this compilation" — the write path the
 * release editor's read-only tracklist has never had. No JSP renders a screen
 * like this: `libraryReleaseModify.jsp`'s tracklist is display-only
 * (`tracklist.js` fetches Discogs and nothing posts back), so tubafrenzy never
 * gave a librarian a way to enter per-track artists by hand. That is the gap
 * this fills — without it, a Various Artists release filed after cutover can
 * never receive credits, since nothing else in the product writes to
 * `POST /:libraryId/compilation-tracks`.
 *
 * Reached from the release editor (`ReleaseCard`), which is where the JSP's
 * own read-only tracklist lives; this screen continues that placement rather
 * than inventing a second one, and is gated identically to its sibling
 * `/move` and `/delete` sub-screens.
 *
 * Scoped to Backend's `library.id` (`albumId`) throughout — never
 * `legacy_release_id`. All three compilation-track endpoints resolve their
 * path param against `library.id`; sending the legacy id instead would not
 * error, it would silently read or write a different, real release's rows.
 *
 * The V/A gate is `isVariousArtists` on `code_letters` — the same structural
 * rule `artistCardRoute` uses to route to this shelf's own card — never
 * `album_artist`. That column is written by the catalog import mirroring the
 * legacy MySQL and by nothing else, so it is absent on a release filed today
 * and stops being written at all once that mirror ends. Gating a *write*
 * affordance on it would hide this screen from exactly the compilation that
 * needs it: the one with no credits and no other way to acquire any.
 *
 * Safety property: no write is possible against a base state this screen
 * cannot account for. It always loads the release's already-stored credits
 * (`useGetCompilationTracksQuery`, never skipped — the release already exists,
 * so the read is never wasted the way it would be moments after a brand-new
 * release's creation), and saving is refused whenever that read has not
 * succeeded. The write endpoint is additive-only — it can add a credit but
 * never amend or remove one — so resubmitting an unchanged row is harmless
 * (the server skips it), while resubmitting a *corrected* one files a second,
 * only-slightly-different credit beside the first.
 *
 * A failed write puts the screen in exactly that unaccountable state, which is
 * why the refusal covers it too: a request can commit and then lose its
 * response, so the rows on screen are no longer a truthful account of the
 * release. The read is reissued and saving stays refused until it lands.
 */
export default function ReleaseTracklistEditor({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const {
    data: stored,
    isError: storedError,
    isFetching: storedFetching,
    refetch: refetchStored,
  } = useGetCompilationTracksQuery({ libraryId: albumId });
  const [fetchSuggestions, { isFetching: suggestionsFetching }] =
    useLazyGetCompilationTrackSuggestionsQuery();
  const [writeCompilationTracks, { isLoading: saving }] = useWriteCompilationTracksMutation();

  const [rows, setRows] = useState<DraftRow[]>([blankRow()]);
  const [message, setMessage] = useState("");
  const [suggestionsMessage, setSuggestionsMessage] = useState("");
  // Set by a write that failed, cleared only by a stored read that succeeds
  // afterwards. Between the two, what the release holds is unknown: the write
  // may have committed and lost its response.
  const [writeOutcomeUnknown, setWriteOutcomeUnknown] = useState(false);

  if (isLoading) {
    return (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the release...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div data-testid="release-tracklist-error" role="alert" className="artist-error-message">
        This release could not be loaded, so its per-track credits can&apos;t be edited.
      </div>
    );
  }

  if (!isVariousArtists(data.artist.lettercode)) {
    return (
      <div data-testid="release-tracklist-not-various" role="status" style={{ textAlign: "center" }}>
        This isn&apos;t a Various Artists release, so it has no per-track credits to enter.
        <p />
        <a href={`/dashboard/library/release/${albumId}`}>Back to this release</a>
      </div>
    );
  }

  const entireLibraryCode = formatEntireLibraryCode({
    genreName: data.artist.genre,
    code_letters: data.artist.lettercode,
    code_artist_number: data.artist.numbercode,
    genre_id: data.genre_id ?? 0,
    code_number: data.entry,
    code_volume_letters: null,
  });

  const storedTracks = stored?.tracks ?? [];
  // Known only once the read has actually succeeded — never inferred from an
  // empty array, which is indistinguishable from "not loaded yet" the moment
  // this component mounts.
  const storedKnown = !!stored && !storedError;
  const canSave = storedKnown && !writeOutcomeUnknown;

  // Both the failed-write path and the librarian's own retry go through here,
  // so a read that succeeds always clears the refusal. A read that fails
  // changes nothing: `storedError` is already refusing the save on its own.
  const reconfirmStored = async () => {
    const confirmed = await refetchStored()
      .unwrap()
      .then(() => true)
      .catch(() => false);
    if (confirmed) {
      setWriteOutcomeUnknown(false);
    }
  };

  const updateRow = (key: number, patch: Partial<DraftRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const removeRow = (key: number) =>
    setRows((current) => current.filter((row) => row.key !== key));

  const addRow = () => setRows((current) => [...current, blankRow()]);

  const handleImportFromDiscogs = async () => {
    setSuggestionsMessage("");
    try {
      const result = await fetchSuggestions({ libraryId: albumId }).unwrap();
      // Against the rows on screen as well as the stored ones: a second click
      // that re-offered a row already in the form would leave two editable
      // copies of one credit, and correcting one of them files both.
      const already = new Set([
        ...storedTracks.map(compilationTrackCreditKey),
        ...rows.map((row) => compilationTrackCreditKey(toInput(row))),
      ]);
      const toImport = result.tracks.filter(
        (track) => !already.has(compilationTrackCreditKey(track)),
      );
      if (toImport.length === 0) {
        setSuggestionsMessage(
          result.tracks.length > 0
            ? "Every track Discogs suggested is already on file or in the form below."
            : "No Discogs tracklist matched this release. Enter credits by hand below.",
        );
        return;
      }
      setRows((current) =>
        current.every(isBlankRow)
          ? toImport.map(rowFromSuggestion)
          : [...current, ...toImport.map(rowFromSuggestion)],
      );
      setSuggestionsMessage(
        `Imported ${toImport.length} ${toImport.length === 1 ? "track" : "tracks"} from Discogs. Confirm or correct the per-track artists before saving.`,
      );
    } catch {
      setSuggestionsMessage(
        "Discogs tracklist lookup failed. This isn't the same as Discogs having no match — try again, or enter credits by hand below.",
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittable = rows.map(toInput).filter((track) => track.artist_name.length > 0);
    if (submittable.length === 0) {
      setMessage("Enter at least one artist credit before saving.");
      return;
    }
    try {
      const result = await writeCompilationTracks({
        libraryId: albumId,
        tracks: submittable,
      }).unwrap();
      setMessage(
        result.skipped > 0
          ? `Filed ${result.inserted} new credit(s); ${result.skipped} already on file.`
          : `Filed ${result.inserted} new credit(s).`,
      );
      setRows([blankRow()]);
    } catch {
      setMessage(
        "These credits could not be saved — but some may still have been filed. Check what's on file above before trying again: a credit can only be added here, never corrected.",
      );
      setWriteOutcomeUnknown(true);
      await reconfirmStored();
    }
  };

  return (
    <div id="releaseTracklistCard">
      <div className="label" style={{ textAlign: "center" }}>
        <a href="/dashboard/catalog">Do another search</a>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a href="/dashboard/library">Find and Create an Artist and/or Library Code</a>
        <p />
        <a href={`/dashboard/library/release/${albumId}`}>View/Modify/Delete this Library Release</a>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>
          LIBRARY RELEASE: &nbsp;{entireLibraryCode}&nbsp;-&nbsp;{data.title}
        </h3>
        <h4>Enter Per-Track Artist Credits</h4>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3 data-testid="release-tracklist-message" role="status">
          &nbsp;{message}&nbsp;
        </h3>
      </div>

      {storedTracks.length > 0 && (
        <table className="tracklist-table" data-testid="release-tracklist-stored">
          <tbody>
            <tr className="tracklist-header">
              <th colSpan={3}>Already on File</th>
            </tr>
            {storedTracks.map((track, index) => (
              <tr
                key={track.id}
                className={`tracklist-row ${
                  index % 2 === 0 ? "tracklist-row-even" : "tracklist-row-odd"
                }`}
              >
                <td className="tracklist-pos">{track.track_position ?? String(index + 1)}</td>
                <td>{track.artist_name}</td>
                <td>{track.track_title ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {storedError && (
        <div role="alert" className="artist-error-message">
          Existing credits could not be confirmed, so saving is disabled until they can be — a
          retry against an unknown state could file a duplicate.{" "}
          <button type="button" disabled={storedFetching} onClick={() => reconfirmStored()}>
            Try again
          </button>
        </div>
      )}

      <div className="label" style={{ textAlign: "center" }}>
        <button type="button" onClick={handleImportFromDiscogs} disabled={suggestionsFetching}>
          Check Discogs for a Tracklist
        </button>
        <p role="status" data-testid="release-tracklist-suggestions-message">
          &nbsp;{suggestionsMessage}&nbsp;
        </p>
      </div>

      <form name="addCompilationTracks" data-testid="release-tracklist-form" onSubmit={handleSubmit}>
        <table cellPadding={5} style={{ margin: "0 auto" }}>
          <tbody>
            <tr>
              <th style={{ textAlign: "left" }}>Position</th>
              <th style={{ textAlign: "left" }}>Artist</th>
              <th style={{ textAlign: "left" }}>Track Title</th>
              <td />
            </tr>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td>
                  <input
                    type="text"
                    size={5}
                    value={row.track_position}
                    disabled={saving}
                    aria-label={`Position for track ${index + 1}`}
                    onChange={(event) =>
                      updateRow(row.key, { track_position: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    size={30}
                    value={row.artist_name}
                    disabled={saving}
                    aria-label={`Artist for track ${index + 1}`}
                    onChange={(event) => updateRow(row.key, { artist_name: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    size={30}
                    value={row.track_title}
                    disabled={saving}
                    aria-label={`Title for track ${index + 1}`}
                    onChange={(event) => updateRow(row.key, { track_title: event.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={`Remove track ${index + 1}`}
                    onClick={() => removeRow(row.key)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}>
                <button type="button" disabled={saving} onClick={addRow}>
                  Add track
                </button>
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                <input type="submit" value="Save Track Credits" disabled={saving || !canSave} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}
