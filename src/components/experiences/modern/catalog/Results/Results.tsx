"use client";

import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import { ChangeEvent, useRef } from "react";
import { Table } from "@mui/joy";
import {
  useCatalogQueryResults,
  useCatalogQuerySearch,
} from "@/src/hooks/catalogHooks";
import { ColorPaletteProp } from "@mui/joy";
import CatalogResult from "./Result";
import CatalogInfiniteScroller from "./CatalogInfiniteScroller";
import ResultsContainer from "./ResultsContainer";
import TableHeader from "./TableHeader";

export default function Results({
  color: _color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { selected, setSelection } = useCatalogQuerySearch();
  const {
    results: releaseList,
    isLoadingInitial,
    isFetchingMore,
    hasNextPage,
    fetchNextPage,
  } = useCatalogQueryResults();

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <ResultsContainer ref={scrollRef}>
      <CatalogInfiniteScroller
        scrollRef={scrollRef}
        onLoadMore={fetchNextPage}
        hasNextPage={hasNextPage}
        isLoadingInitial={isLoadingInitial}
        isFetchingMore={isFetchingMore}
      >
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
                    selected.length > 0 &&
                    selected.length !== releaseList?.length
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
                        : [],
                    );
                  }}
                  color={
                    selected.length > 0 ||
                    selected.length === releaseList?.length
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
            {isLoadingInitial ? (
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

            {isFetchingMore && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: "1rem",
                    background: "transparent",
                  }}
                >
                  <CircularProgress color="primary" size="sm" />
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </CatalogInfiniteScroller>
    </ResultsContainer>
  );
}
