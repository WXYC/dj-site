"use client";

import { useState } from "react";
import ArtistSearchForm, { type MultiMatchResult } from "./ArtistSearchForm";
import MultipleArtistsDisplay from "./MultipleArtistsDisplay";
import NewArtistForm from "./NewArtistForm";

/**
 * Owns the toggle between `chooseLibraryCodeOrArtist.jsp`'s two forms and
 * `multipleArtistsDisplay.jsp` -- one URL (`/dashboard/library`, the Slice 0
 * URL table's single row for both JSPs) in front of two mutually exclusive
 * screens, matching the JSP: a code search that matches more than one
 * artist replaces the whole page with the multi-artist list, not just the
 * search form's own subtree, and there is no route to leave for either
 * screen -- `multipleArtistsDisplay.jsp` has no counterpart destination of
 * its own in `/wxycdb` either, since a librarian returns to the chooser
 * (`chooseLibraryCodePrompt`) or picks an artist.
 */
export default function LibraryChooser() {
  const [multiMatch, setMultiMatch] = useState<MultiMatchResult | null>(null);

  if (multiMatch) {
    return (
      <MultipleArtistsDisplay
        genreName={multiMatch.genreName}
        codeLetters={multiMatch.codeLetters}
        codeNumber={multiMatch.codeNumber}
        artists={multiMatch.artists}
        onChooseAgain={() => setMultiMatch(null)}
      />
    );
  }

  return (
    <>
      <ArtistSearchForm onMultiMatch={setMultiMatch} />
      <hr />
      <NewArtistForm />
    </>
  );
}
