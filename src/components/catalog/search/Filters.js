import React from "react";
import { FormControl, FormLabel, Select, Option } from "@mui/joy";

/**
 * @component
 * @category Card Catalog
 *
 * @param {Object} props - The component props.
 * @param {function} props.setSearchIn - The function to set the selected search-in option.
 * @param {function} props.setGenre - The function to set the selected genre option.
 *
 * @returns {JSX.Element} The rendered Filters component.
 *
 * @description
 * The Filters component renders the 'select' dropdowns for searching the card catalog. It provides options to filter the search based on different criteria.
 *
 * The `props.setSearchIn` function is used to set the selected search-in option.
 * The `props.setGenre` function is used to set the selected genre option.
 * 
 * @example
 * // Usage example:
 * import { Filters } from './Filters';
 *
 * function CardCatalog() {
 *   const [searchIn, setSearchIn] = useState('Albums');
 *   const [genre, setGenre] = useState('All');
 *
 *   return (
 *     <Filters setSearchIn={setSearchIn} setGenre={setGenre} />
 *   );
 * }
 */
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