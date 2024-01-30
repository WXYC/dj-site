import { Button, Card, Divider, Stack, Tooltip } from '@mui/joy';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import ListSubheader from '@mui/joy/ListSubheader';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import React from 'react';

import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { useContext } from 'react';
import NowPlaying from '../../widgets/now-playing/NowPlaying';
import { closeSidebar } from './SidebarMobileUtilites';

import { ScrollOnHoverText } from '../../widgets/scroll-on-hover-text';
import { ArtistAvatar } from '../catalog/ArtistAvatar';

import { binSlice, flowSheetSlice, getBin, isLive, useDispatch, useSelector } from '@/lib/redux';
import { SongCardContext } from '../catalog/SongCardContext';

/**
 * Component representing the Second Sidebar, which renders the 'Mail Bin' for DJs to save their songs and a 'now playing' widget.
 *
 * @component
 * @category Dashboard
 *
 * @returns {JSX.Element} The rendered SecondSidebar component.
 *
 * @example
 * // Usage example:
 * import SecondSidebar from '../components/SecondSidebar';
 *
 * const MainComponent = () => {
 *   return (
 *     <div>
 *       <SecondSidebar />
 *     </div>
 *   );
 * };
 */
export default function SecondSidebar(): JSX.Element {

  const dispatch = useDispatch();

  const live = useSelector(isLive);
  const { getSongCardContent } = useContext(SongCardContext);

  const bin = useSelector(getBin);
  const removeFromBin = (item: number) => dispatch(binSlice.actions.removeFromBin(item));
  const clearBin = () => dispatch(binSlice.actions.clearBin());

  const addToQueue = (bin_id: number) => dispatch(flowSheetSlice.actions.addToQueue(bin[bin_id]));

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
            flex: 1,
          }}
        >
          <ListSubheader role="presentation" sx={{ color: 'text.primary' }}>
            <PlayArrowOutlinedIcon sx={{ mr: 1 }} />
            Playing Now
          </ListSubheader>
          <ListItem>
            <ListItemContent>
              <NowPlaying sx = {{ maxWidth: 250 }} />
            </ListItemContent>
          </ListItem>
        </List>
        <Divider />
        <List
          sx = {{
            flexGrow: 1
          }}
        >
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
              width: 270,
              maxHeight: 270,
            }}
          >
            <div>
            {bin.length > 0 ? (
              bin.map((item, index) => (
                <React.Fragment key={`${index}-${item.id}`}>
                  <Stack direction = "row" spacing = {2}
                    sx = {{
                      mt: 1,
                      mb: 1,
                      justifyContent: 'space-between'
                    }}
                  >
                    <ArtistAvatar
                        entry={item.release_number}
                        artist = {item.artist}
                        format={item.format}
                      />
                      <div>
                      <ScrollOnHoverText
                      key = {`${index}-${item.id}-name`}
                        level='body4'
                        sx = {{
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          width: 89,
                        }}
                      >
                        {item.artist.name}
                      </ScrollOnHoverText>
                      <ScrollOnHoverText
                      key={`${index}-${item.id}-title`}
                      level='body2'
                        sx = {{
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          width: 89,
                        }}
                      >
                        {item.title}
                      </ScrollOnHoverText>
                      </div>
                    <Stack direction="row">
                      <Tooltip title="More Info" variant='outlined' size="sm">
                    <IconButton
                      size="small"
                      variant="standard"
                      color="info"
                      onClick = {() => getSongCardContent(item)}
                    >
                      <InfoOutlinedIcon />
                    </IconButton>
                    </Tooltip>
                    {(live) && (
                      <Tooltip title="Add to Queue" placement="bottom"
                      variant="outlined"
                      size="sm"
                      >
                      <IconButton
                          size="small"
                          variant="standard"
                          color="info"
                          onClick={() => addToQueue(item)}
                      >
                          <PlaylistAddIcon />
                      </IconButton>
                      </Tooltip>
                    )}
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
            </div>
          </Card>
        </List>
        <Divider />
        <List
          sx = {{
            flex: 0,
          }}
        >
        <Stack direction="row" sx = {{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pb: 1
        }}>
        <Typography level="body3" sx={{ color: 'text.secondary', py: 0 }}>
          {`© ${new Date().getFullYear()} WXYC Chapel Hill`}
        </Typography>
        <Typography level="body4" sx={{ color: 'text.secondary', pt: 0 }}>
          DJ Site v1.0.0
        </Typography>
        </Stack>
        <Button size="sm" variant="soft" color="info" 
        href='https://docs.google.com/forms/d/e/1FAIpQLSfBMYYQeCEkRGsSBM3CAkjuBcHYA9Lk2Su6-ZncWH4hXwULvA/viewform?usp=sf_link' 
        target='_blank'
          component="a"
        >
          Feedback
        </Button>
        </List>
      </Sheet>
    </React.Fragment>
  );
}
