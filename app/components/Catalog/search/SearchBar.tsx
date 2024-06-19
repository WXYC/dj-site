import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import { Box, Button, ColorPaletteProp, Divider, FormControl, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, Sheet, Typography } from '@mui/joy';
import React from 'react';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Filters } from './Filters';
import { Genre } from '@/lib/redux';
import { SearchInOption } from '../../Table/types';
import { Cancel } from '@mui/icons-material';

/**
 * @component
 * @category Card Catalog
 *
 * @param {Object} props - The component props.
 * @param {string} props.searchString - The current search string value.
 * @param {function} props.setSearchString - The function to set the search string value.
 * @param {function} props.setSearchIn - The function to set the selected search-in option.
 * @param {function} props.setGenre - The function to set the selected genre option.
 *
 * @returns {JSX.Element} The rendered SearchBar component.
 *
 * @description
 * The SearchBar component renders a search bar and filter options for searching the card catalog. It allows the user to enter a search string and select specific filters for refining the search results.
 *
 * The `props.searchString` is the current value of the search string.
 * The `props.setSearchString` function is used to update the search string value.
 * The `props.setSearchIn` function is used to set the selected search-in option.
 * The `props.setGenre` function is used to set the selected genre option.
 *
 * @see [Input (Joy-UI component)](https://mui.com/joy-ui/react-input/)
 * @see [IconButton (Joy-UI component)](https://mui.com/joy-ui/react-icon-button/)
 * @see [Modal (Joy-UI component)](https://mui.com/joy-ui/react-modal/)
 * @see [Sheet (Joy-UI component)](https://mui.com/joy-ui/react-sheet/)
 * @see [FormControl (Joy-UI component)](https://mui.com/joy-ui/react-form-control/)
 * @see [FormLabel (Joy-UI component)](https://mui.com/joy-ui/react-form-label/)
 * @see [Filters (custom component)](./Filters)
 * 
 * @example
 * // Usage example:
 * import { SearchBar } from './SearchBar';
 *
 * function CardCatalog() {
 *   const [searchString, setSearchString] = useState('');
 *   const [searchIn, setSearchIn] = useState('Albums');
 *   const [genre, setGenre] = useState('All');
 *
 *   return (
 *     <SearchBar
 *       searchString={searchString}
 *       setSearchString={setSearchString}
 *       setSearchIn={setSearchIn}
 *       setGenre={setGenre}
 *     />
 *   );
 * }
 */
export const SearchBar = (props: SearchBarProps) => {

    const [open, setOpen] = React.useState(false);

    return (
        <React.Fragment>
        <Sheet
        className="SearchAndFilters-mobile"
        sx={{
          background: 'transparent',
          display: {
            xs: 'flex',
            sm: 'none',
          },
          my: 1,
          gap: 1,
        }}
      >
        <Input
          color={props.color ?? "neutral"}
          size="sm"
          placeholder="Search"
          startDecorator={<TroubleshootIcon />}
          sx={{ flexGrow: 1 }}
          value={props.searchString}
          onChange={(e) => props.setSearchString(e.target.value)}
        />
        <IconButton
          size="sm"
          variant="outlined"
          color="neutral"
          onClick={() => setOpen(true)}
        >
          <FilterAltOutlinedIcon />
        </IconButton>
        <IconButton
          size="sm"
          variant="solid"
          color={props.color ?? "primary"}
          onClick={() => { console.log("Search!"); }}
        >
          <SendOutlinedIcon />
        </IconButton>
        <Modal open={open} onClose={() => setOpen(false)}>
          <ModalDialog aria-labelledby="filter-modal" layout="fullscreen"
            sx = {{
              paddingTop: '7rem',
            }}
          >
            <ModalClose variant="soft" color='primary' sx = {{ marginTop: 'var(--Header-height)' }} />
            <Sheet sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Filters
                setSearchIn={props.setSearchIn}
                setGenre={props.setGenre}
              />
              <Button color={props.color ?? "primary"} onClick={() => {setOpen(false)}}>
                Submit
              </Button>
            </Sheet>
          </ModalDialog>
        </Modal>
      </Sheet>
      <Box
        className="SearchAndFilters-tabletUp"
        sx={{
          borderRadius: 'sm',
          py: 2,
          display: {
            xs: 'none',
            sm: 'flex',
          },
          flexWrap: 'wrap',
          gap: 1.5,
          '& > *': {
            minWidth: {
              xs: '180px',
              md: '200px',
            },
          },
        }}
      >
        <FormControl sx={{ flex: 1, flexBasis: { xs: '100%', lg: 'unset' } }} size="sm">
          <FormLabel>Search for a song, album, or artist</FormLabel>
          <Input 
            color={props.color ?? "neutral"}
            placeholder="Search" 
            startDecorator={<TroubleshootIcon />}
            endDecorator={
              (props.searchString != '') ? (<IconButton
                variant="plain"
                color={props.color ?? "primary"}
                onClick={() => props.setSearchString('')}
              >
                <Cancel />
              </IconButton>) : (<></>)
            }
            value={props.searchString}
            onChange={(e) => props.setSearchString(e.target.value)}
          />
        </FormControl>
        
        <Filters
          setSearchIn = {props.setSearchIn}
          setGenre = {props.setGenre}
        />
      </Box>
    </React.Fragment>
    )
};

interface SearchBarProps {
    searchString: string;
    setSearchString: (searchString: string) => void;
    setSearchIn: (searchIn: SearchInOption) => void;
    setGenre: (genre: Genre) => void;
    color?: ColorPaletteProp;
}