"use client";

import { Genre, SearchIn } from "@/lib/features/catalog/types";
import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import {
  Checkbox,
  ColorPaletteProp,
  FormControl,
  FormLabel,
  Option,
  Select,
} from "@mui/joy";
import React from "react";

export const Filters = ({ color }: { color: ColorPaletteProp | undefined }) => {
  const { setSearchIn, setSearchGenre, exclusive, setExclusiveFilter } = useCatalogSearch();

  return (
    <React.Fragment>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Search In</FormLabel>
        <Select
          color={color || "neutral"}
          placeholder="All"
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(e, newValue) =>
            setSearchIn((newValue as SearchIn) || "All")
          }
        >
          <Option value="All">All</Option>
          <Option value="Albums">Albums</Option>
          <Option value="Artists">Artists</Option>
        </Select>
      </FormControl>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Genre</FormLabel>
        <Select
          color={color || "neutral"}
          placeholder="All"
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(e, newValue) =>
            setSearchGenre((newValue as Genre) || "All")
          }
        >
          <Option value="All">All</Option>
          <Option value="Hiphop">Hiphop</Option>
          <Option value="Rock">Rock</Option>
          <Option value="Electronic">Electronic</Option>
          <Option value="Jazz">Jazz</Option>
          <Option value="Classical">Classical</Option>
          <Option value="Soundtrack">Soundtrack</Option>
        </Select>
      </FormControl>
      <FormControl size="sm" sx={{ flex: "none", justifyContent: "flex-end" }}>
        <Checkbox
          label="Exclusives Only"
          checked={exclusive}
          onChange={(e) => setExclusiveFilter(e.target.checked)}
          sx={{
            "& .MuiCheckbox-checkbox": {
              "&.Mui-checked": {
                backgroundColor: "#7B2D8E",
                borderColor: "#7B2D8E",
              },
              "&.Mui-checked:hover": {
                backgroundColor: "#6a2479",
                borderColor: "#6a2479",
              },
            },
          }}
        />
      </FormControl>
    </React.Fragment>
  );
};
