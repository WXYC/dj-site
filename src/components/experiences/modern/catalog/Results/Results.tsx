"use client";

import AdminCatalogResult from "@/src/components/experiences/modern/admin/catalog/AdminCatalogResult";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import { ChangeEvent } from "react";

import { Table } from "@mui/joy";

import {
  useAdminCatalogResults,
  useAdminCatalogSearch,
  useCatalogResults,
  useCatalogSearch,
} from "@/src/hooks/catalogHooks";
import { ColorPaletteProp } from "@mui/joy";
import CatalogResult from "./Result";
import ResultsContainer from "./ResultsContainer";
import TableHeader from "./TableHeader";

function CatalogResultsTable({
  color: _color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { selected, setSelection } = useCatalogSearch();
  const {
    data: releaseList,
    loading,
    loadMore,
    reachedEndForQuery,
  } = useCatalogResults();

  return (
    <ResultsContainer scope="catalog">
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
                      : []
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

          {!loading && !reachedEndForQuery && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center" }}>
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

function AdminCatalogResultsTable({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const themeColor = color ?? "success";
  const { selected, setSelection } = useAdminCatalogSearch();
  const {
    data: releaseList,
    loading,
    loadMore,
    reachedEndForQuery,
  } = useAdminCatalogResults();

  return (
    <ResultsContainer scope="admin" color={themeColor}>
      <Table
        aria-labelledby="adminCatalogTableTitle"
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
                      : []
                  );
                }}
                color={
                  selected.length > 0 ||
                  selected.length === releaseList?.length
                    ? themeColor
                    : undefined
                }
                sx={{ verticalAlign: "text-bottom" }}
              />
            </th>
            <th style={{ width: 50, padding: 12 }}></th>
            <th style={{ width: 180, padding: 12 }}>
              <TableHeader textValue="Artist" scope="admin" />
            </th>
            <th style={{ width: 180, padding: 12 }}>
              <TableHeader textValue="Title" scope="admin" />
            </th>
            <th style={{ width: 280, padding: 12 }}>
              <TableHeader textValue="Code" scope="admin" />
            </th>
            <th style={{ width: 80, padding: 12 }}>
              <TableHeader textValue="Plays" scope="admin" />
            </th>
            <th style={{ width: 120, padding: 12 }}></th>
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
                <CircularProgress color={themeColor} size="md" />
              </td>
            </tr>
          ) : (
            releaseList?.map((album) => (
              <AdminCatalogResult
                album={album}
                key={`admin-result-${album.id}`}
              />
            ))
          )}

          {!loading && !reachedEndForQuery && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center" }}>
                <Button
                  variant="solid"
                  color={themeColor}
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

export default function Results({
  color,
  scope = "catalog",
}: {
  color: ColorPaletteProp | undefined;
  scope?: "catalog" | "admin";
}) {
  if (scope === "admin") {
    return <AdminCatalogResultsTable color={color} />;
  }
  return <CatalogResultsTable color={color} />;
}
