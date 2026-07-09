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
          minWidth: 700,
          "--TableCell-headBackground": (theme) =>
            theme.vars.palette.background.level1,
          "--Table-headerUnderlineThickness": "1px",
          "--TableRow-hoverBackground": (theme) =>
            theme.vars.palette.background.level1,
          // Media-list rows: taller than a data grid, everything vertically
          // centered on the artwork.
          "& tbody tr > td": {
            height: "68px",
            verticalAlign: "middle",
          },
          // Selected rows read as intentional: subtle fill + left accent rail.
          "& tbody tr.row-selected > td": {
            bgcolor: (theme) => theme.vars.palette.background.level1,
          },
          "& tbody tr.row-selected > td:first-of-type": {
            boxShadow: (theme) =>
              `inset 2px 0 0 ${theme.vars.palette.primary[500]}`,
          },
          // Actions are a right-edge overlay, not a reserved column: no dead
          // space when hidden. Revealed on row hover/focus on pointer
          // devices; always visible on touch. The hover-bg backdrop keeps
          // them legible over the stats they cover.
          "& tbody tr .row-actions": {
            background:
              "linear-gradient(to right, transparent, var(--TableRow-hoverBackground) 18px)",
          },
          "@media (hover: hover)": {
            "& tbody tr .row-actions": {
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity 120ms",
            },
            "& tbody tr:hover .row-actions, & tbody tr:focus-within .row-actions":
              {
                opacity: 1,
                pointerEvents: "auto",
              },
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
            <th scope="col" style={{ width: 64, padding: 12 }}></th>
            {/* Fixed-width metadata columns keep call #s, chips and plays
                vertically aligned; the trailing width-less filler column
                absorbs all leftover space so the content stays packed left
                instead of spreading across the table. */}
            <th
              scope="col"
              aria-sort={ariaSort("album") ?? ariaSort("artist")}
              style={{ width: 300, padding: 12 }}
            >
              <TableHeader textValue="Title" />
              <span style={{ margin: "0 6px", opacity: 0.4 }}>/</span>
              <TableHeader textValue="Artist" />
            </th>
            <th scope="col" style={{ width: 180, padding: 12 }}></th>
            <th scope="col" style={{ width: 90, padding: 12 }}>
              <TableHeader textValue="Call #" />
            </th>
            <th scope="col" aria-sort={ariaSort("plays")} style={{ width: 70, padding: 12 }}>
              <TableHeader textValue="Plays" />
            </th>
            <th scope="col" style={{ padding: 12 }}></th>
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
