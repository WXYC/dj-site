"use client";

import { useSearchParams } from "next/navigation";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { useAppSelector } from "@/lib/hooks";
import { catalogSlice } from "@/lib/features/catalog/frontend";

export default function SearchResults() {
  const searchParams = useSearchParams();
  const searchQuery = useAppSelector(catalogSlice.selectors.getSearchQuery);
  const searchString = searchParams.get("searchString") || searchQuery;

  const { data: results, isLoading, error } = useSearchCatalogQuery(
    {
      artist_name: searchString || undefined,
      album_name: searchString || undefined,
      n: 50,
    },
    {
      skip: !searchString || searchString.trim().length === 0,
    }
  );

  if (!searchString || searchString.trim().length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div align="center" className="text">
        <p>Loading search results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div align="center" className="text">
        <p>Error loading search results. Please try again.</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div align="center" className="text">
        <p>No results found for &quot;{searchString}&quot;</p>
      </div>
    );
  }

  return (
    <div align="center">
      <table
        cellPadding={4}
        cellSpacing={2}
        border={0}
        width="100%"
        style={{ marginTop: "20px" }}
      >
        <thead>
          <tr className="searchResultsHeader">
            <th>Artist</th>
            <th>Album</th>
            <th>Format</th>
            <th>Library Code</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id} className="text">
              <td align="left">{result.artist.name}</td>
              <td align="left">{result.title}</td>
              <td align="left">{result.format}</td>
              <td align="left">
                {result.artist.lettercode} {result.entry}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
