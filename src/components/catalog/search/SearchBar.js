import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import { Box, Button, Divider, FormControl, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, Sheet, Typography } from '@mui/joy';
import React from 'react';
import { Filters } from './Filters';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';

export const SearchBar = (props) => {

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
          color="primary"
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
              <Filters />
              <Button color="primary" onClick={() => {setOpen(false)}}>
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
              xs: '120px',
              md: '160px',
            },
          },
        }}
      >
        <FormControl sx={{ flex: 1 }} size="sm">
          <FormLabel>Search for a song, album, or artist</FormLabel>
          <Input 
            placeholder="Search" 
            startDecorator={<TroubleshootIcon />}
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
}