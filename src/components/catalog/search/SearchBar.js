import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import { Box, Button, Divider, FormControl, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, Sheet, Typography } from '@mui/joy';
import React from 'react';
import { Filters } from './Filters';

export const SearchBar = (props) => {

    const [open, setOpen] = React.useState(false);

    return (
        <React.Fragment>
        <Sheet
        className="SearchAndFilters-mobile"
        sx={{
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
          <i data-feather="filter" />
        </IconButton>
        <Modal open={open} onClose={() => setOpen(false)}>
          <ModalDialog aria-labelledby="filter-modal" layout="fullscreen">
            <ModalClose />
            <Typography id="filter-modal" level="h2">
              Filters
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Sheet sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Filters />
              <Button color="primary" onClick={() => setOpen(false)}>
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