"use client";

import ResultRow, { type PreviousSetsResult } from "./ResultRow";
import "@/src/styles/classic/previous-sets.css";

// 5-col previous-sets layout mirroring tubafrenzy's `mostRecentEntries.jsp`
// + `public/flowsheetRadioShowDisplayPublic.jsp`:
// Indicators · Artist · Song · Release · Label.
export default function ResultTable({
  results,
}: {
  results: PreviousSetsResult[];
}) {
  if (results.length === 0) {
    return (
      <div
        className="classic-previous-sets-empty text"
        style={{ textAlign: "center", padding: "1em" }}
      >
        No results found.
      </div>
    );
  }

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
            nextIsTrack={index < results.length - 1}
          />
        ))}
      </tbody>
    </table>
  );
}
