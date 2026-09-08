"use client";

import type { PlaylistSearchResult } from "@wxyc/shared";
import ResultRow from "./ResultRow";
import "@/src/styles/classic/previous-sets.css";

// The six columns tubafrenzy's searchPage results table carried
// (Date · Artist · Song · Release · Label · DJ), which is also Modern's set.
// Not mostRecentEntries.jsp's five: that screen is one show by one DJ, so it
// has no use for either column, and inheriting its shape is what dropped the
// DJ from this table.
//
// Callers must gate on results.length > 0 — the table doesn't render its
// own empty state. PreviousSetsContainer surfaces "No results found" copy
// above the table, mirroring Modern's PlaylistSearchContainer.
export default function ResultTable({
  results,
}: {
  results: readonly PlaylistSearchResult[];
}) {
  return (
    <table
      className="classic-previous-sets-table"
      cellPadding={4}
      cellSpacing={2}
      border={0}
      style={{ width: "100%" }}
    >
      <thead>
        <tr>
          <th style={{ width: "10%" }}>Date</th>
          <th style={{ width: "20%" }}>Artist</th>
          <th style={{ width: "20%" }}>Song</th>
          <th style={{ width: "20%" }}>Release</th>
          <th style={{ width: "15%" }}>Label</th>
          <th style={{ width: "15%" }}>DJ</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </tbody>
    </table>
  );
}
