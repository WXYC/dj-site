"use client";

import ResultRow, { type PreviousSetsResult } from "./ResultRow";
import "@/src/styles/classic/previous-sets.css";

// 5-col previous-sets layout mirroring tubafrenzy's `mostRecentEntries.jsp`
// + `public/flowsheetRadioShowDisplayPublic.jsp`:
// Indicators · Artist · Song · Release · Label.
//
// Callers must gate on results.length > 0 — the table doesn't render its
// own empty state. PreviousSetsContainer surfaces "No results found" copy
// above the table, mirroring Modern's PlaylistSearchContainer.
export default function ResultTable({
  results,
}: {
  results: PreviousSetsResult[];
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
          <th style={{ width: "5%" }}>&nbsp;</th>
          <th style={{ width: "25%" }}>Artist</th>
          <th>Song</th>
          <th>Release</th>
          <th>Label</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result, index) => (
          <ResultRow
            key={result.id}
            result={result}
            nextIsSong={index < results.length - 1}
          />
        ))}
      </tbody>
    </table>
  );
}
