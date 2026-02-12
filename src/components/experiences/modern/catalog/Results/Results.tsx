"use client";

import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import { ChangeEvent } from "react";

import { Table } from "@mui/joy";

import { useCatalogResults, useCatalogSearch } from "@/src/hooks/catalogHooks";
import { ColorPaletteProp } from "@mui/joy";
import CatalogResult from "./Result";
import ResultsContainer from "./ResultsContainer";
import TableHeader from "./TableHeader";

export default function Results({
}: {
  color?: ColorPaletteProp | undefined;
}) {
  const { selected, setSelection } = useCatalogSearch();

  const {
    data: releaseList,
    loading,
    loadMore,
    reachedEndForQuery,
  } = useCatalogResults();
  return (
    <ResultsContainer>
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
          "& tr > *:last-child": {
            position: "sticky",
            right: 0,
            bgcolor: "var(--TableCell-headBackground)",
          },
        }}
      >
        <thead>
          <tr>
            <th style={{ width: 48, textAlign: "center", padding: 12 }}>
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
            <th style={{ width: 50, padding: 12 }}></th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader textValue="Artist" />
            </th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader textValue="Title" />
            </th>
            <th style={{ width: 60, padding: 12 }}>
              <TableHeader textValue="Code" />
            </th>
            <th style={{ width: 70, padding: 12 }}>
              <TableHeader textValue="Format" />
            </th>
            <th style={{ width: 60, padding: 12 }}>
              <TableHeader textValue="Plays" />
            </th>
            <th style={{ width: 120, padding: 12 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={8}
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

          {!loading && !reachedEndForQuery && (
            <tr>
              <td colSpan={8} style={{ textAlign: "center" }}>
                <Button
                  variant="solid"
                  color="primary"
                  size="lg"
                  sx={{
                    marginRight: "1rem",
                  }}
                  onClick={loadMore}
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
