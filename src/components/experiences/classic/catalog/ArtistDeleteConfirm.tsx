"use client";

import { useState } from "react";
import {
  useDeleteArtistMutation,
  useGetArtistCardQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { formatArtistLibraryCode } from "@/lib/features/catalog/libraryCode";
import {
  ARTIST_DELETE_COUNTS_UNREADABLE_MESSAGE,
  artistDeleteBlockers,
  artistDeleteCountsUnreadable,
  interpretArtistDeleteError,
  type ArtistDeleteRefusal,
} from "@/lib/features/catalog/artistDeleteOutcome";
import type { ArtistCard } from "@/lib/features/catalog/types";

type DeletedArtist = { card: ArtistCard; identityCode: string };

/**
 * "Delete The Artist" -- the confirmation screen and its aftermath, reached
 * from `ArtistCard`'s delete link and reproducing `ArtistAdminServlet`'s
 * delete branch. One component for both, like `ReleaseDeleteConfirm`.
 *
 * Two tiers off the card's four gating counts, no server round trip. Tier 1
 * (all four strictly zero): one-click confirm, Cancel primary, "Delete The
 * Artist" the danger action. Tier 2 (`artistDeleteBlockers` names a blocker):
 * states the blocker(s) and offers one way out, "Back to the Artist Card" --
 * no delete control at all. Tier 2 also covers the fail-closed case where no
 * count is readable, but says so in those terms rather than reciting every
 * gate -- see `artistDeleteCountsUnreadable`.
 *
 * `ArtistCard` only offers its link under the same `artistDeleteIsOffered`
 * test Tier 1 uses, so Tier 2 is no longer an ordinary path to here. It is
 * reached three ways: something filed between the card's render and this
 * screen's click (the same race that puts a 409 on a Tier 1 press), a URL
 * typed or kept from before, and a Backend build predating the counts,
 * where all four read `undefined` and the fail-closed test withholds both
 * the card's link and Tier 1. A 503 can land on any press. Both render
 * `interpretArtistDeleteError`'s message, and a non-retryable one also
 * retracts the Tier 1 sentence rather than sitting beside a banner that
 * contradicts it.
 *
 * Delete stays disabled until the genre-prefixed identity resolves
 * (`identityKnown`) -- rendered, not withdrawn, so Cancel never flips to
 * refusal wording early.
 *
 * This is deliberately NOT `ReleaseDeleteConfirm`'s rule, which counts a
 * failed secondary read as settled and lets its button go live
 * (`playCountsSettled = playCountsError || playCounts !== undefined`). There
 * the unreadable thing is the delete's *impact*, advisory beside an identity
 * the screen already knows; here it is the identity itself, and
 * `code_artist_number` is genre-scoped, so "Cs 2" names two shelves at once
 * -- 204 artists in the catalog carry more than one genre membership. An
 * irreversible delete does not proceed on an ambiguous subject. What the
 * sibling's rule is right about is that a settled failure owes the operator a
 * sentence, which `identityUnresolvable` renders.
 *
 * The post-delete state is terminal: `deleteArtist` does not invalidate
 * `ArtistCard`, so both the card and its resolved identity string freeze
 * into `deleted` before the mutation fires, immune to a later genres change
 * or a 404'd refetch. No restore is promised -- `RESTORE_PLAN` has no
 * `artists` entry.
 */
export default function ArtistDeleteConfirm({
  artistId,
  genreId,
}: {
  artistId: number;
  /**
   * Which membership is being deleted from the librarian's point of view --
   * the shelf whose card sent them here. The identity string below names the
   * genre-prefixed code, so an unscoped read would print the lowest genre's
   * code for an artist reached on a different shelf, on the confirmation
   * screen for an irreversible write. The DELETE itself is artist-wide either
   * way; this scopes what the screen SAYS, not what it does.
   */
  genreId?: number;
}) {
  const { data: artist, isLoading } = useGetArtistCardQuery({ artistId, genre_id: genreId });
  const { data: genres, isError: genresUnreadable } = useGetGenresQuery();
  const [deleteArtist, { isLoading: deleting }] = useDeleteArtistMutation();

  const [deleted, setDeleted] = useState<DeletedArtist | null>(null);
  const [refusal, setRefusal] = useState<ArtistDeleteRefusal | null>(null);

  const card = deleted?.card ?? artist;

  if (!card) {
    if (isLoading) {
      return (
        <div className="label" style={{ textAlign: "center" }}>
          Loading the artist...
        </div>
      );
    }
    return (
      <div data-testid="artist-delete-error" role="alert" className="artist-error-message">
        This artist could not be loaded, so it cannot be deleted.
      </div>
    );
  }

  // "Rock Cs 2", never the ambiguous "Cs 2".
  //
  // `identityKnown` gates Delete on the genre word, and the two ways of not
  // having it are NOT the same: in flight resolves on its own, while a failed
  // read or no matching row never will. `getGenres` has no retry and no
  // polling, so conflating them leaves the button disabled forever with
  // nothing on screen saying why. `identityUnresolvable` is the settled arm
  // and earns a sentence.
  const genreName = genres?.find((genre) => genre.id === card.genre_id)?.genre_name;
  const identityKnown = genreName !== undefined;
  const identityUnresolvable =
    !identityKnown && (genresUnreadable || genres !== undefined);
  const liveIdentityCode = formatArtistLibraryCode({
    genreName,
    code_letters: card.code_letters,
    code_artist_number: card.code_artist_number,
  });
  const identityCode = deleted?.identityCode ?? liveIdentityCode;
  const cardHref = artistCardHref({ id: artistId, code_letters: card.code_letters }, { genreId: genreId ?? null });

  // Every gate names itself when no count is readable, so ask that first --
  // four clauses off four `undefined`s would assert four unobserved facts.
  const countsUnreadable = !deleted && artistDeleteCountsUnreadable(card);
  const blockers = deleted || countsUnreadable ? [] : artistDeleteBlockers(card);
  const blocked = countsUnreadable || blockers.length > 0;
  // Non-retryable (refused on the merits, or unclassifiable): the Tier 1
  // claim below is no longer safe to keep asserting.
  const refusedOnMerits = refusal !== null && !refusal.retryable;
  // A 503 lock stand-down leaves Delete standing -- a retryable "not now".
  const canDelete = !deleted && !blocked && (refusal === null || refusal.retryable);
  const deletePressable = canDelete && identityKnown && !deleting;
  const showTier1Status = !blocked && !refusedOnMerits;

  const handleDelete = async () => {
    // Frozen before the mutation fires. `liveIdentityCode` is guaranteed
    // genre-prefixed here, since `identityKnown` gates Delete on it.
    const snapshot: DeletedArtist = { card, identityCode: liveIdentityCode };
    setRefusal(null);
    try {
      await deleteArtist({ artistId }).unwrap();
      setDeleted(snapshot);
    } catch (error) {
      setRefusal(interpretArtistDeleteError(error));
    }
  };

  return (
    <div id="artistDeleteCard" data-testid={deleted ? "artist-deleted" : "artist-delete-confirm"}>
      <table cellPadding={5}>
        <tbody>
          <tr>
            <td></td>
            <td>
              <h3>{deleted ? "The following Artist has been deleted:" : "Delete The Artist"}</h3>
            </td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Library Code:</b>
            </th>
            <td data-testid="artist-delete-library-code">{identityCode}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Artist:</b>
            </th>
            <td data-testid="artist-delete-name">{card.artist_name}</td>
          </tr>
          {!deleted ? (
            <>
              {blocked || showTier1Status ? (
                <tr>
                  <td></td>
                  <td
                    data-testid={blocked ? "artist-delete-blocked" : "artist-delete-status"}
                    role={blocked ? "alert" : undefined}
                    className={blocked ? "artist-error-message" : undefined}
                  >
                    {countsUnreadable
                      ? ARTIST_DELETE_COUNTS_UNREADABLE_MESSAGE
                      : blocked
                        ? `This artist cannot be deleted: ${blockers.join("; ")}.`
                        : "Nothing is filed under this artist: no releases and no cross-references."}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td></td>
                <td>
                  {canDelete ? (
                    <>
                      <button type="button" onClick={handleDelete} disabled={!deletePressable}>
                        Delete The Artist
                      </button>
                      {identityUnresolvable ? (
                        <div data-testid="artist-delete-identity-unreadable" role="alert" className="artist-error-message">
                          This artist&apos;s genre could not be read, and the call number alone does
                          not say which shelf this is, so the delete is held. Reload the page.
                        </div>
                      ) : null}
                      &nbsp;&nbsp;
                    </>
                  ) : null}
                  <a href={cardHref} data-testid={!canDelete ? "artist-delete-back-to-card" : undefined}>
                    {canDelete ? "Cancel" : "Back to the Artist Card"}
                  </a>
                </td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      {refusal ? (
        <div data-testid="artist-delete-refusal" role="alert" className="artist-error-message">
          {refusal.message}
        </div>
      ) : null}

      <div className="label" style={{ textAlign: "center" }}>
        <a href="/dashboard/catalog">Do another search</a>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a href="/dashboard/library">Find and Create an Artist and/or Library Code</a>
      </div>
    </div>
  );
}
