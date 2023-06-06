import { Button, Card, Divider, Stack, Tooltip } from '@mui/joy';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import IconButton from '@mui/joy/IconButton';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import ListSubheader from '@mui/joy/ListSubheader';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import React from 'react';

import InboxIcon from '@mui/icons-material/Inbox';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import { useContext } from 'react';
import { BinContext } from './bin/Bin';
import { closeSidebar } from './utilities';
import NowPlaying from '../NowPlaying';

export default function SecondSidebar() {

  const { bin, addToBin, removeFromBin, clearBin, isInBin } = useContext(BinContext);

  return (
    <React.Fragment>
      <Box
        className="SecondSidebar-overlay"
        sx={{
          position: 'fixed',
          zIndex: 9998,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          bgcolor: 'background.body',
          opacity: 'calc(var(--SideNavigation-slideIn, 0) - 0.2)',
          transition: 'opacity 0.4s',
          transform: {
            xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))',
            md: 'translateX(-100%)',
          },
        }}
        onClick={() => closeSidebar()}
      />
      <Sheet
        className="SecondSidebar"
        sx={{
          position: {
            xs: 'fixed',
            md: 'sticky',
          },
          transform: {
            xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))',
            md: 'none',
          },
          borderLeft: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.4s',
          zIndex: 9999,
          height: '100dvh',
          top: 0,
          p: 2,
          py: 3,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <List
          sx={{
            '--ListItem-radius': '8px',
            '--ListItem-minHeight': '32px',
            '--List-gap': '4px',
          }}
        >
          <ListSubheader role="presentation" sx={{ color: 'text.primary' }}>
            <PlayArrowOutlinedIcon sx={{ mr: 1 }} />
            Playing Now
          </ListSubheader>
          <ListItem>
            <ListItemContent>
              <NowPlaying />
            </ListItemContent>
          </ListItem>
        </List>
        <Divider />
        <List>
          <ListSubheader 
            role="presentation" 
            sx={{ 
              color: 'text.primary',
              mb: 1,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Stack direction="row">
            <InboxIcon sx={{ mr: 1 }} />
            <Typography>
              Mail Bin
            </Typography>
            </Stack>
            {(bin.length > 0) && (<Button
              variant="soft"
              color="warning"
              size="sm"
              sx = {{
                m: -1,
              }}
              onClick={() => clearBin()}
            >
              Clear
            </Button>)}
          </ListSubheader>
          <Card
            variant="outlined"
            sx = {{
              overflowY: 'scroll',
              height: 300,
            }}
          >
            {bin.length > 0 ? (
              bin.map((item, index) => (
                <React.Fragment key={index}>
                  <Stack direction = "row" spacing = {2}
                    sx = {{
                      mt: 1,
                      mb: 1,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Chip
                    variant='soft'
                    color="info"
                    >{item}</Chip>
                    <Stack direction="row">
                      <Tooltip title="More Info" variant='outlined' size="sm">
                    <IconButton
                      size="small"
                      variant="standard"
                      color="info"
                      onClick = {() => { console.log("display song information")}}
                    >
                      <InfoOutlinedIcon />
                    </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove" variant='outlined' size="sm">
                    <IconButton
                      size="small"
                      variant="standard"
                      color="warning"
                      onClick={() => removeFromBin(item)}
                    >
                      <DeleteOutlineOutlinedIcon />
                    </IconButton>
                    </Tooltip>
                    </Stack>
                  </Stack>
                  {(index < bin.length - 1) && <Divider />}
                </React.Fragment>
            ))) : (
              <Typography level="body3">
                An empty record...
              </Typography>
            )}
          
          </Card>
        </List>
      </Sheet>
    </React.Fragment>
  );
}
