"use client";

import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Typography from "@mui/joy/Typography";
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
  const { selected, setSelection, hasActiveQuery } = useCatalogQuerySearch();

  const {
    results: releaseList,
    total,
    isLoading: loading,
    isError,
    hasMore,
    loadNextPage,
  } = useCatalogQueryResults();

  const hasResults = releaseList.length > 0;

  return (
    <ResultsContainer>
      {hasActiveQuery && (
        <Typography
          level="body-sm"
          sx={{ px: 2, py: 1.5, color: "text.secondary" }}
        >
          {loading
            ? "Searching..."
            : isError
            ? "Search failed. Please try again."
            : hasResults
            ? `Found ${total.toLocaleString()} result${total === 1 ? "" : "s"}`
            : "No results found"}
        </Typography>
      )}
      {hasResults && (
        <Table
          aria-labelledby="tableTitle"
          stickyHeader
          hoverRow
          sx={{
            "--TableCell-headBackground": (theme) =>
              theme.vars.palette.background.level1,
            "--Table-headerUnderlineThickness": "1px",
            "--TableRow-hoverBackground": (theme) =>
              theme.vars.palette.background.level1,
            "& thead tr > *:last-child": {
              position: "sticky",
              right: 0,
              bgcolor: "var(--TableCell-headBackground)",
            },
            "& tbody tr > *:last-child": {
              position: "sticky",
              right: 0,
              bgcolor: "var(--joy-palette-background-surface)",
            },
            "& tbody tr:hover > *:last-child": {
              bgcolor: "var(--TableRow-hoverBackground)",
            },
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 48, textAlign: "center", padding: 12 }}>
                <Checkbox
                  indeterminate={
                    selected.length > 0 && selected.length !== releaseList.length
                  }
                  checked={
                    releaseList.length > 0 &&
                    selected.length === releaseList.length
                  }
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setSelection(
                      event.target.checked
                        ? releaseList.map((row) => row.id)
                        : []
                    );
                  }}
                  color={
                    selected.length > 0 || selected.length === releaseList.length
                      ? "primary"
                      : undefined
                  }
                  sx={{ verticalAlign: "text-bottom" }}
                />
              </th>
              <th style={{ width: 50, padding: 12 }}></th>
              <th style={{ width: 180, padding: 12 }}>
                <TableHeader textValue="Artist" />
              </th>
              <th style={{ width: 180, padding: 12 }}>
                <TableHeader textValue="Title" />
              </th>
              <th style={{ width: 280, padding: 12 }}>
                <TableHeader textValue="Code" />
              </th>
              <th style={{ width: 80, padding: 12 }}>
                <TableHeader textValue="Plays" />
              </th>
              <th style={{ width: 120, padding: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {releaseList.map((album) => (
              <CatalogResult album={album} key={`result-${album.id}`} />
            ))}

            {!loading && hasMore && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  <Button
                    variant="solid"
                    color="primary"
                    size="lg"
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
      )}
    </ResultsContainer>
  );
}
