"use client";

import { usePlaylistSearchControls } from "@/src/hooks/playlistSearchHooks";
import "@/src/styles/classic/previous-sets.css";

// Classic free-form search input, mirroring tubafrenzy's
// `public/searchPage.jsp`. Pipes the first (and only) search row's value
// through `playlistSearchSlice`; the results container's `usePlaylistSearchResults`
// is where that value opens the search query.
export default function SearchForm() {
  const { rows, updateRow } = usePlaylistSearchControls();
  const row = rows[0];

  return (
    <div className="classic-previous-sets-search">
      <input
        type="text"
        autoCorrect="off"
        name="searchString"
        value={row?.value ?? ""}
        onChange={(e) => row && updateRow(row.id, { value: e.target.value })}
        placeholder="Type to search..."
        className="classic-previous-sets-search-input"
      />
    </div>
  );
}
