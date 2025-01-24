"use client";

import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import { Link } from "@mui/joy";

const TableHeader = ({ textValue }: { textValue: string }): JSX.Element => {
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
};

export default TableHeader;
