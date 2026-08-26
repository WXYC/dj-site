"use client";

import { useState } from "react";
import ArtistSearchForm, { type MultiMatchResult } from "./ArtistSearchForm";
import MultipleArtistsDisplay from "./MultipleArtistsDisplay";
import NewArtistForm from "./NewArtistForm";

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
 * fully specified code whose owners are a server response, not a URL. The
 * swap is whole-page in both: the JSP replaces the chooser outright, so
 * `NewArtistForm` goes with the search form rather than sitting under a list
 * of artists that already own the code.
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
