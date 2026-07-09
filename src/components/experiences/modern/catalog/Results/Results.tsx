"use client";

import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import { ChangeEvent } from "react";

import { Table } from "@mui/joy";

import {
  useCatalogQueryResults,
  useCatalogQuerySearch,
} from "@/src/hooks/catalogHooks";
import { ColorPaletteProp } from "@mui/joy";
import CatalogResult from "./Result";
import ResultsContainer from "./ResultsContainer";
import TableHeader from "./TableHeader";

export default function Results({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { selected, setSelection, sortBy, sortOrder } = useCatalogQuerySearch();

  const ariaSort = (field: string) =>
    sortBy === field
      ? sortOrder === "asc"
        ? ("ascending" as const)
        : ("descending" as const)
      : undefined;

  const {
    results: releaseList,
    isLoadingInitial,
    hasNextPage,
    fetchNextPage,
    isFetchingMore,
  } = useCatalogQueryResults();
  const loading = isLoadingInitial;
  const hasMore = hasNextPage;
  const loadNextPage = fetchNextPage;
  return (
    <ResultsContainer>
      <Table
        aria-labelledby="tableTitle"
        stickyHeader
        hoverRow
        sx={{
          // Below this the container's overflow:auto takes over as a
          // horizontal scroll; columns never get crushed.
          minWidth: 760,
          "--TableCell-headBackground": (theme) =>
            theme.vars.palette.background.level1,
          "--Table-headerUnderlineThickness": "1px",
          "--TableRow-hoverBackground": (theme) =>
            theme.vars.palette.background.level1,
          "& thead tr > *:last-child": {
            position: "sticky",
            right: 0,
            bgcolor: "var(--TableCell-headBackground)",
            borderLeft: "1px solid",
            borderLeftColor: (theme) => theme.vars.palette.divider,
          },
          // Opaque background is load-bearing: the theme's cssVarPrefix is
          // "wxyc", so a hardcoded --joy-* var resolves to nothing and the
          // pinned cell turns transparent over the columns it covers.
          "& tbody tr > *:last-child": {
            position: "sticky",
            right: 0,
            bgcolor: (theme) => theme.vars.palette.background.surface,
            borderLeft: "1px solid",
            borderLeftColor: (theme) => theme.vars.palette.divider,
          },
          "& tbody tr:hover > *:last-child": {
            bgcolor: "var(--TableRow-hoverBackground)",
          },
          // Text cells top-align so artist, title, call # and plays share a
          // first-line baseline even when a cell grows a second line; the
          // checkbox, artwork and actions cells stay vertically centered.
          "& tbody td": {
            verticalAlign: "top",
            paddingTop: "12px",
            paddingBottom: "12px",
          },
          "& tbody td:nth-of-type(1), & tbody td:nth-of-type(2), & tbody td:last-child":
            {
              verticalAlign: "middle",
            },
        }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ width: 48, textAlign: "center", padding: 12 }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length !== releaseList?.length
                }
                checked={
                  releaseList != null &&
                  releaseList.length > 0 &&
                  selected.length === releaseList.length
                }
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setSelection(
                    event.target.checked
                      ? releaseList?.map((row) => row.id) ?? []
                      : []
                  );
                }}
                color={
                  selected.length > 0 || selected.length === releaseList?.length
                    ? "primary"
                    : undefined
                }
                sx={{ verticalAlign: "text-bottom" }}
              />
            </th>
            <th scope="col" style={{ width: 56, padding: 12 }}></th>
            {/* Artist and Title carry no width: with tableLayout fixed they
                split the remaining space, so nothing truncates invisibly. */}
            <th scope="col" aria-sort={ariaSort("artist")} style={{ padding: 12 }}>
              <TableHeader textValue="Artist" />
            </th>
            <th scope="col" aria-sort={ariaSort("album")} style={{ padding: 12 }}>
              <TableHeader textValue="Title" />
            </th>
            <th scope="col" style={{ width: 110, padding: 12 }}>
              <TableHeader textValue="Call #" />
            </th>
            <th scope="col" aria-sort={ariaSort("plays")} style={{ width: 72, padding: 12 }}>
              <TableHeader textValue="Plays" />
            </th>
            <th scope="col" style={{ width: 120, padding: 12 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={7}
                style={{
                  textAlign: "center",
                  paddingTop: "3rem",
                  background: "transparent",
                }}
              >
                <CircularProgress color="primary" size="md" />
              </td>
            </tr>
          ) : (
            releaseList?.map((album) => (
              <CatalogResult album={album} key={`result-${album.id}`} />
            ))
          )}

          {!loading && hasMore && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center" }}>
                <Button
                  variant="solid"
                  color="primary"
                  size="lg"
                  loading={isFetchingMore}
                  sx={{
                    marginRight: "1rem",
                  }}
                  onClick={loadNextPage}
                >
                  Load more
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </ResultsContainer>
  );
}
