'use client';

import AlbumIcon from '@mui/icons-material/Album';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import StreamIcon from '@mui/icons-material/Stream';
import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import GlobalStyles from '@mui/joy/GlobalStyles';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton from '@mui/joy/ListItemButton';
import Sheet from '@mui/joy/Sheet';
import Tooltip from '@mui/joy/Tooltip';
import { useEffect, useState } from 'react';
import Logo from '../Branding/logo';

import { applicationSlice, authenticationSlice, flowSheetSlice, getAuthenticatedUser, isLive, useDispatch, useSelector } from '@/lib/redux';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';
import { Badge, ColorPaletteProp, IconButton, Stack, Typography } from '@mui/joy';
import { redirect, usePathname } from 'next/navigation';
import { ConfirmPopup } from '../General/Popups/Popups';

/**
 * Component for rendering navigational links to settings and pages, and providing logout functionality.
 *
 * @component
 * @category Dashboard
 *
 * @returns {JSX.Element} The rendered FirstSidebar component.
 * 
 * @example
 * // Usage example:
 * import FirstSidebar from '../components/FirstSidebar';
 *
 * const DashboardPage = () => {
 *   return (
 *     <div>
 *       <FirstSidebar />
 *     </div>
 *   );
 * };
 *
 * @see [IconButton (Mui-Joy component)](https://mui.com/joy-ui/react-icon-button/)
 * @see [List (Mui-Joy component)](https://mui.com/joy-ui/react-list/)
 * @see [ListItemButton (Mui-Joy component)](https://mui.com/joy-ui/react-list-item-button/)
 * @see [Sheet (Mui-Joy component)](https://mui.com/joy-ui/react-sheet/)
 * @see [Divider (Mui-Joy component)](https://mui.com/joy-ui/react-divider/)
 * @see [Tooltip (Mui-Joy component)](https://mui.com/joy-ui/react-tooltip/)
 * @see [Badge (Mui-Joy component)](https://mui.com/joy-ui/react-badge/)
 * @see [Chip (Mui-Joy component)](https://mui.com/joy-ui/react-chip/)
 * @see [Stack (Mui-Joy component)](https://mui.com/joy-ui/react-stack/)
 * @see [Typography (Mui-Joy component)](https://mui.com/joy-ui/react-typography/)
 */
export default function FirstSidebar(): JSX.Element {

  const dispatch = useDispatch();
  const user = useSelector(getAuthenticatedUser);

  const pathname = usePathname();
  const [hovering, setHovering] = useState(false);

  const live = useSelector(isLive);
  const goOff = () => dispatch(flowSheetSlice.actions.setLive(false));

  const [style, setStyle] = useState<ColorPaletteProp>("primary");

  useEffect(() => {
    if (pathname === '/dashboard/dashboard/admin') {
      setStyle("success");
    } else if (pathname === '/dashboard/dashboard/settings') {
      setStyle("warning");
    } else {
      setStyle("primary");
    }
  }, [pathname]);

  return (
    <Sheet
      className="FirstSidebar"
      variant="soft"
      color={style}
      invertedColors
      sx={{
        position: {
          xs: 'fixed',
          md: 'sticky',
        },
        transform: {
          xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))',
          md: 'none',
        },
        transition: 'transform 0.4s',
        zIndex: 10000,
        height: '100dvh',
        width: 'var(--FirstSidebar-width)',
        top: 0,
        p: 1.5,
        py: 3,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <GlobalStyles
        styles={{
          ':root': {
            '--FirstSidebar-width': '68px',
          },
        }}
      />
      <Box>
        <Logo color={style}/>
      </Box>
      <List sx={{ '--ListItem-radius': '8px', '--List-gap': '12px' }}>
        <ListItem>
        <Tooltip 
            title="Card Catalog"
            arrow={true}
            placement='right'
            size='sm'
            variant='outlined'
        >
          <ListItemButton
            onClick={() => redirect('/dashboard/catalog')}
            variant={pathname === '/dashboard/catalog' ? 'solid' : 'plain'}
          >
            <AlbumIcon />
          </ListItemButton>
        </Tooltip>
        </ListItem>
        <ListItem>
            <Tooltip
                title="Flow Sheet"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
            >
          <ListItemButton onClick={() => redirect('/dashboard/flowsheet')}
            variant={pathname === '/dashboard/flowsheet' ? 'solid' : 'plain'}
          >
            
            <Badge
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                badgeInset={'-50%'}
                badgeContent = {(live) ? '' : null} // will be non-empty when DJ is live
                size='sm'
                >
            <StreamIcon />         
            </Badge>
          </ListItemButton>
            </Tooltip>
        </ListItem>
        <ListItem>
            <Tooltip
                title="Previous Sets"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
            >
          <ListItemButton onClick={() => redirect('/dashboard/playlists')}
            variant={pathname.includes('/dashboard/playlists') ? 'solid' : 'plain'}
          >
            <StorageIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>
        <ListItem>
            <Tooltip
                title="Schedule"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
            >
          <ListItemButton
            onClick={() => redirect('/dashboard/schedule')}
            variant={pathname === '/dashboard/schedule' ? 'solid' : 'plain'}
          >
         <CalendarMonthIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>
        {(user) && (<ListItem>
            <Tooltip
                title="Station Management"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
            >
          <ListItemButton
            onClick={() => redirect('/dashboard/admin')}
            variant={pathname === '/dashboard/admin' ? 'solid' : 'plain'}
          >
            <DisplaySettingsIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>)}
      </List>
      <Tooltip
          title="Settings"
          arrow={true}
          placement='right'
          size='sm'
          variant='outlined'
      >
        <IconButton
          variant="plain"
          color={style}
          size="sm"
          onClick={() => redirect('/dashboard/settings')}
        >     
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Divider />
      <Tooltip
        title={
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 320,
              justifyContent: 'center',
              p: 1,
            }}
          >
            <Typography level="body-sm">
              @{user?.username}
            </Typography>
            <Stack direction='row' gap={1}>              
              <Typography level="body-lg">
                {user?.name}
              </Typography>
              <Box
                sx = {{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography level="body-xs"
                  sx = {{
                    height: '1.5em',
                  }}
                >
                  aka
                </Typography>
              </Box>
              <Typography level="body-lg">
                DJ {user?.djName}
              </Typography>
            </Stack>
            <Typography level="body-md" color='primary'>
              Click to Log Out
            </Typography>
          </Box>
        }
        placement='right'
        arrow
        variant='outlined'
      >
      <IconButton
        variant='outlined'
        onMouseOver={() => setHovering(true)}
        onMouseOut={() => setHovering(false)}
        onClick={() => {
          if (live) {
            dispatch(applicationSlice.actions.openPopup(
              <ConfirmPopup
                message="You're Live! Would you like to complete the flowsheet and log out?"
                onConfirm={() => {
                  goOff();
                  dispatch(authenticationSlice.actions.logout());
                }}
              />
            ))
          } else {
            dispatch(authenticationSlice.actions.logout());
          }
        }}
      >
        {hovering ? (
          <LogoutOutlinedIcon />
        ) : (
          <PersonOutlinedIcon />
        )}
      </IconButton>
      </Tooltip>
    </Sheet>
  );
}
