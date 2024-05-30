import { Button, Card, Divider, Stack, Tooltip } from '@mui/joy';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import ListSubheader from '@mui/joy/ListSubheader';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import React, { useCallback, useEffect } from 'react';

import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import NowPlaying from '../Widgets/now-playing/NowPlaying';
import { closeSidebar } from './SidebarMobileUtilites';

import { ArtistAvatar } from '../Catalog/ArtistAvatar';
import ScrollOnHoverText from '../Widgets/scroll-on-hover-text';

import { CatalogResult, applicationSlice, binSlice, flowSheetSlice, getAuthenticatedUser, getBin, getSongCardState, isLive, useDispatch, useSelector } from '@/lib/redux';
import SongCard from '../Catalog/Reviews/SongCard';
import { loadBin, deleteFromBin, deleteAllFromBin } from '@/lib/redux/model/bin/thunks';
import QueueButton from '../Flowsheet/Queue/QueueButton';
import BinButton from '../Bin/BinButton';
import MoreInfoButton from '../General/Buttons/MoreInfoButton';

/**
 * Component representing the Second Sidebar, which renders the 'Mail Bin' for DJs to save their songs and a 'now playing' widget.
 *
 * @component
 * @category Dashboard
 *
 * @returns {JSX.Element} The rendered SecondSidebar component.
 *
 */
export default function SecondSidebar(): JSX.Element {

  const dispatch = useDispatch();

  const user = useSelector(getAuthenticatedUser);
  const songCardOpen = useSelector(getSongCardState);

  const bin = useSelector(getBin);
  const clearBin = () => dispatch(deleteAllFromBin(
    {
      dj: user!,
      entry: bin
    }
  )).finally(() => {
    dispatch(loadBin(user!.djId));
  });
  
  useEffect(() => {
    if (user)
    {
      dispatch(loadBin(user.djId));
    }
  }, [dispatch, user]);

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
          transition: 'transform 0.4s, width 0.4s',
          zIndex: 9999,
          height: '100dvh',
          top: 0,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx = {{
          p: 2,
          py: 3,
          }}>     
          <Stack direction = "column" spacing = {2} sx = {{ pb: 2 }}>
            <Stack direction = "row">
              <PlayArrowOutlinedIcon sx={{ mr: 1 }} />
              Playing Now
            </Stack>
            <NowPlaying sx = {{ maxWidth: 295 }} mini={songCardOpen} />
          </Stack>
        {(songCardOpen) ? (
            <SongCard />
          ) : (<>
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
              width: 295,
              maxHeight: 400,
            }}
          >
            <div>
            {bin.length > 0 ? (
              bin.map((item, index) => (
                <React.Fragment key={`${index}-${item.id}`}>
                  <Stack direction = "row" spacing = {1}
                    sx = {{
                      mt: 1,
                      mb: 1,
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <ArtistAvatar
                        entry={item.album.release}
                        artist = {item.album.artist}
                        format={item.album.format}
                      />
                      <div>
                      <ScrollOnHoverText
                      key = {`${index}-${item.id}-name`}
                        level='body-xs'
                        sx = {{
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          width: 89,
                        }}
                      >
                        {item.album.artist?.name}
                      </ScrollOnHoverText>
                      <ScrollOnHoverText
                      key={`${index}-${item.id}-title`}
                      level='body-sm'
                        sx = {{
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          width: 89,
                        }}
                      >
                        {item.album.title}
                      </ScrollOnHoverText>
                      </div>
                    <Stack direction="row">
                    <MoreInfoButton item={item} variant="plain"/>
                    <QueueButton entry={item} variant="plain"/>
                    <BinButton entry={item} variant="plain"/>
                    </Stack>
                  </Stack>
                  {(index < bin.length - 1) && <Divider />}
                </React.Fragment>
            ))) : (
              <Typography level="body-md">
                An empty record...
              </Typography>
            )}
            </div>
          </Card>
        </List></>)}
        </Box>
        <Box>
        <Divider />
        <List
          sx = {{
            flex: 0,
            px: 2,
          }}
        >
        <Stack direction="row" sx = {{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pb: 1
        }}>
        <Typography level="body-md" sx={{ color: 'text.secondary', py: 0 }}>
          {`© ${new Date().getFullYear()} WXYC Chapel Hill`}
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary', pt: 0 }}>
          DJ Site v1.0.0
        </Typography>
        </Stack>
        <Button size="sm" variant="soft" color="neutral" 
        href='https://docs.google.com/forms/d/e/1FAIpQLSfBMYYQeCEkRGsSBM3CAkjuBcHYA9Lk2Su6-ZncWH4hXwULvA/viewform?usp=sf_link' 
        target='_blank'
          component="a"
        >
          Feedback
        </Button>
        </List>
        </Box>
      </Sheet>
    </React.Fragment>
  );
}
