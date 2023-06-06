import React from "react";
import { FormControl, FormLabel, Select, Option } from "@mui/joy";

export const Filters = (props) => {
    return (
    <React.Fragment>
      <FormControl size="sm" sx = {{ flex: 1 }}>
        <FormLabel>Search In</FormLabel>
        <Select
          placeholder="Albums"
          slotProps={{ button: { sx: { whiteSpace: 'nowrap' } } }}
          onChange={(e, newValue) => props.setSearchIn(newValue)}
        >
            <Option value="All">All</Option>
          <Option value="Albums">Albums</Option>
          <Option value="Artists">Artists</Option>
        </Select>
      </FormControl>
      <FormControl size="sm" sx = {{ flex: 1 }}>
        <FormLabel>Genre</FormLabel>
        <Select
          placeholder="All"
          slotProps={{ button: { sx: { whiteSpace: 'nowrap' } } }}
          onChange={(e, newValue) => props.setGenre(newValue)}
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
      <FormControl size="sm" sx = {{ flex: 1 }}>
        <FormLabel>Release Type</FormLabel>
        <Select
          placeholder="Albums"
          slotProps={{ button: { sx: { whiteSpace: 'nowrap' } } }}
          disabled
        >
            <Option value="all">All</Option>
          <Option value="hiphop">Albums</Option>
          <Option value="rock">Tracks</Option>
        </Select>
      </FormControl>
    </React.Fragment>
  );
};