import { Genre } from "@/lib/redux";
import { FormControl, FormLabel, Option, Select } from "@mui/joy";
import React from "react";
import { SearchInOption } from "../../Table/types";

export const Filters = (props: FiltersProps) => {
  return (
    <React.Fragment>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Search In</FormLabel>
        <Select
          placeholder="All"
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(e, newValue) =>
            props.setSearchIn((newValue as SearchInOption) || "")
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
          placeholder="All"
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(e, newValue) => props.setGenre((newValue as Genre) || "")}
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
    </React.Fragment>
  );
};

interface FiltersProps {
  setSearchIn: (newValue: SearchInOption) => void;
  setGenre: (newValue: Genre) => void;
}
