"use client";

import { useState } from "react";
import Link from "next/link";
import { useGetGenresQuery } from "@/lib/features/catalog/api";
import { safeCapture } from "@/lib/posthog";
import ArtistSearchForm, { type MultiMatchResult } from "./ArtistSearchForm";
import MultipleArtistsDisplay from "./MultipleArtistsDisplay";
import NewArtistForm from "./NewArtistForm";
import SearchForm from "./SearchForm";
import SearchResults from "./SearchResults";

/**
 * The disambiguation screen swaps in behind this one URL, so neither arriving
 * at it nor leaving it produces a pageview. These are the only record that a
 * librarian landed on a 27-owner list at all.
 *
 * The screen has two exits and both are instrumented, because they mean
 * opposite things: RESOLVED is a row link taken, DISMISSED is the header link
 * back. Emitting only one of them would make `SHOWN` minus that one read as a
 * permanent leak, and would measure dwell on exactly the wrong population --
 * abandonments, never the fast successful visits.
 */
const LIBRARY_CHOOSER_EVENTS = {
  MULTI_MATCH_SHOWN: "library_multi_match_shown",
  MULTI_MATCH_RESOLVED: "library_multi_match_resolved",
  MULTI_MATCH_DISMISSED: "library_multi_match_dismissed",
} as const;

/**
 * Owns the toggle between `chooseLibraryCodeOrArtist.jsp`'s two forms and
 * `multipleArtistsDisplay.jsp` -- two mutually exclusive screens behind the
 * one `/dashboard/library` URL that the dashboard URL map in
 * `docs/architecture.md` assigns to both JSPs.
 *
 * A state swap rather than a second route, because the multi-match screen is
 * not addressable by what a librarian holds. `/wxycdb` reaches it at
 * `libraryCode?genreID=&artistLetters=`, a genre+letters browse
 * Backend-Service cannot answer -- and the search that reaches it here is a
 * fully specified code whose owners are a server response, not a URL. The swap
 * takes the JSP's own content wholesale, as the JSP does -- `NewArtistForm`
 * goes with the call-number form rather than sitting under a list of artists
 * that already own the code.
 *
 * The free-text search is deliberately OUTSIDE that swap, above it, mounted in
 * both states. It has no JSP counterpart to keep parity with, and keeping it
 * mounted is what stops its RTK Query subscription from dropping for the
 * length of the disambiguation screen -- the same hazard, and the same fix, as
 * the `useGetGenresQuery()` hoist below, which this file already carries for
 * the same reason. Moving it inside either arm reintroduces a refetch (and
 * loses the typed query and the facet chip) on the way back from a 27-owner
 * bucket, which is precisely the scan slow enough to outlast the cache window.
 *
 * The rotation block + `<hr>` above `ArtistSearchForm` reproduce
 * `chooseLibraryCodeOrArtist.jsp:16-21` verbatim: "Import a killed rotation
 * release into the library:" and a link to the Awaiting Cataloging facet of
 * the classic rotation list. An earlier slice of this chooser dropped the
 * block as a deferred divergence, because its destination -- the Awaiting
 * Cataloging facet -- didn't exist yet; the classic rotation list slice
 * builds that destination and restores the block here, including the JSP's
 * own `<hr>` position (between the rotation block and `artistSearchForm` --
 * the JSP has no second `<hr>` between the two forms below it, so the one
 * this component used to render there is retired along with the
 * divergence, not duplicated).
 *
 * `chooseLibraryCodeOrArtist.jsp` can be searched by call number only, so the
 * free-text search is an addition to the screen rather than parity with it and
 * a later parity pass must not read it as drift. It is the card catalog's own
 * search, which writes its query to whatever screen it is mounted on, so a
 * lookup resolves without leaving the cataloging screen. Placing it above the
 * JSP blocks leaves their order relative to each other untouched, which is the
 * constraint that matters -- the call-number form stays where the JSP puts it.
 */
export default function LibraryChooser() {
  const [multiMatch, setMultiMatch] = useState<MultiMatchResult | null>(null);
  // Held here, not only inside the two forms, because they both unmount for
  // the length of the disambiguation screen. Scanning a 27-owner compilation
  // bucket outlasts RTK Query's unsubscribed-cache window, so without a
  // subscriber that survives the swap the librarian returns to a disabled
  // genre select and a refetch. Deduped against the forms' identical
  // subscription, so it costs no extra request.
  useGetGenresQuery();

  const showMultiMatch = (result: MultiMatchResult) => {
    safeCapture(LIBRARY_CHOOSER_EVENTS.MULTI_MATCH_SHOWN, {
      owner_count: result.artists.length,
      genre_name: result.genreName ?? null,
      code_letters: result.codeLetters,
      code_number: result.codeNumber,
    });
    setMultiMatch(result);
  };

  return (
    <>
      <SearchForm />
      {/* `canModify` is settled by the page, not re-derived: `/dashboard/library`
          is MD-gated, so every reader of these results can add a release and
          the read-only artist card is unreachable from here. */}
      <SearchResults canModify />
      <hr />
      {multiMatch ? (
        <MultiMatchScreen result={multiMatch} onDismiss={() => setMultiMatch(null)} />
      ) : (
        // The instrumented setter, never the raw one: reaching the screen is
        // what MULTI_MATCH_SHOWN records, and it has no other trigger.
        <JspBlocks onMultiMatch={showMultiMatch} />
      )}
    </>
  );
}

/**
 * The disambiguation arm of the swap, split out for the same reason
 * `JspBlocks` is: so the ternary above reads as one expression. It also gives
 * the two exits a scope where `result` is non-null, which a ternary arm cannot
 * narrow into.
 */
function MultiMatchScreen({
  result,
  onDismiss,
}: {
  result: MultiMatchResult;
  onDismiss: () => void;
}) {
  // Both exits carry the same identifying triple, so a session's SHOWN can be
  // paired with whichever ending it got.
  const ending = {
    owner_count: result.artists.length,
    code_letters: result.codeLetters,
    code_number: result.codeNumber,
  };

  return (
    <MultipleArtistsDisplay
      {...result}
      onChoose={(_artist, index) => {
        // `owner_index` is the position in the list as rendered, which is the
        // order Backend-Service returned: it answers whether the bucket a
        // librarian wants tends to be near the top, which is the difference
        // between a list that needs sorting and one that needs shortening.
        safeCapture(LIBRARY_CHOOSER_EVENTS.MULTI_MATCH_RESOLVED, { ...ending, owner_index: index });
      }}
      onChooseAgain={() => {
        safeCapture(LIBRARY_CHOOSER_EVENTS.MULTI_MATCH_DISMISSED, ending);
        onDismiss();
      }}
    />
  );
}

/**
 * `chooseLibraryCodeOrArtist.jsp`'s own content: the rotation-import block, the
 * call-number form, and the new-artist form. Split out only so the swap above
 * reads as one expression.
 */
function JspBlocks({ onMultiMatch }: { onMultiMatch: (m: MultiMatchResult) => void }) {
  return (
    <>
      <table cellPadding={10}>
        <tbody>
          <tr>
            <td colSpan={2}>
              <h3>Import a killed rotation release into the library:</h3>
            </td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;</td>
            <td>
              <Link href="/dashboard/rotation?status=uncataloged">
                <b>View Rotation Releases Awaiting Cataloging</b>
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
      <ArtistSearchForm onMultiMatch={onMultiMatch} />
      <NewArtistForm />
    </>
  );
}
