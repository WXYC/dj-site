"use client";

import type {
  CatalogSortBy,
  CatalogSortOrder,
} from "@/lib/features/catalog/types";
import {
  useAdminCatalogSearch,
  useCatalogQuerySearch,
} from "@/src/hooks/catalogHooks";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import { Link } from "@mui/joy";

const SORT_FIELDS: Record<string, CatalogSortBy> = {
  Artist: "artist",
  Title: "album",
  Plays: "plays",
};

function CatalogTableHeaderLink({ textValue }: { textValue: string }) {
  const { sortBy, sortOrder, setSort } = useCatalogQuerySearch();
  const field = SORT_FIELDS[textValue];
  const isActive = field !== undefined && sortBy === field;

  const handleClick = () => {
    if (!field) return;
    const nextOrder: CatalogSortOrder =
      isActive && sortOrder === "asc" ? "desc" : "asc";
    setSort({ sortBy: field, sortOrder: nextOrder });
  };

  return (
    <Link
      variant="plain"
      color="neutral"
      endDecorator={
        isActive && (sortOrder === "asc" ? <ArrowDropUp /> : <ArrowDropDown />)
      }
      sx={{
        padding: 0,
        cursor: field ? "pointer" : "default",
      }}
      onClick={field ? handleClick : undefined}
    >
      {textValue}
    </Link>
  );
}

function AdminTableHeaderLink({ textValue }: { textValue: string }) {
  const { orderBy, orderDirection, handleRequestSort } = useAdminCatalogSearch();
  return (
    <Link
      variant="plain"
      color="neutral"
      endDecorator={
        orderBy === textValue &&
        (orderDirection === "asc" ? <ArrowDropUp /> : <ArrowDropDown />)
      }
      sx={{
        padding: 0,
      }}
      onClick={() => {
        handleRequestSort(textValue);
      }}
    >
      {textValue}
    </Link>
  );
}

const TableHeader = ({
  textValue,
  scope = "catalog",
}: {
  textValue: string;
  scope?: "catalog" | "admin";
}): JSX.Element => {
  if (scope === "admin") {
    return <AdminTableHeaderLink textValue={textValue} />;
  }
  return <CatalogTableHeaderLink textValue={textValue} />;
};

export default TableHeader;
