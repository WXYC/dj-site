"use client";

import {
  useAdminCatalogSearch,
  useCatalogSearch,
} from "@/src/hooks/catalogHooks";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import { Link } from "@mui/joy";

function CatalogTableHeaderLink({ textValue }: { textValue: string }) {
  const { orderBy, orderDirection, handleRequestSort } = useCatalogSearch();
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
