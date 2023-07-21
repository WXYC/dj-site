import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import GlobalStyles from '@mui/joy/GlobalStyles';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton from '@mui/joy/ListItemButton';
import Sheet from '@mui/joy/Sheet';
import React, { useContext, useEffect } from 'react';
import Logo from '../branding/logo';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AlbumIcon from '@mui/icons-material/Album';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import StreamIcon from '@mui/icons-material/Stream';
import SettingsIcon from '@mui/icons-material/Settings';
import Tooltip from '@mui/joy/Tooltip';

import { Badge, Chip, IconButton, Stack, Typography } from '@mui/joy';
import { useLocation, useNavigate } from 'react-router-dom';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';
import { useAuth } from '../../services/authentication/authentication-context';
import { useLive } from '../../services/flowsheet/live-context';
import { PopupContentContext } from '../../pages/dashboard/Popup';
import { ConfirmPopup } from '../general/popups/general-popups';
import { useFlowsheet } from '../../services/flowsheet/flowsheet-context';

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
export default function FirstSidebar() {

  const { handleLogout, user } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [hovering, setHovering] = React.useState(false);

  const { live, setLive } = useLive();
  const { addToEntries } = useFlowsheet();
  const { openPopup } = useContext(PopupContentContext);

  const [style, setStyle] = React.useState("primary");

  useEffect(() => {
    if (location.pathname === '/admin') {
      setStyle("success");
    } else if (location.pathname === '/settings') {
      setStyle("warning");
    } else {
      setStyle("primary");
    }
  }, [location.pathname]);

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
            onClick={() => navigate('/catalog')}
            variant={location.pathname === '/catalog' ? 'solid' : 'plain'}
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
          <ListItemButton onClick={() => navigate('/flowsheet')}
            variant={location.pathname === '/flowsheet' ? 'solid' : 'plain'}
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
          <ListItemButton onClick={() => navigate('/playlists')}
            variant={location.pathname === '/playlists' ? 'solid' : 'plain'}
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
            onClick={() => navigate('/schedule')}
            variant={location.pathname === '/schedule' ? 'solid' : 'plain'}
          >
         <CalendarMonthIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>
        {(user.isAdmin) && (<ListItem>
            <Tooltip
                title="Station Management"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
            >
          <ListItemButton
            onClick={() => navigate('/admin')}
            variant={location.pathname === '/admin' ? 'solid' : 'plain'}
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
          onClick={() => navigate('/settings')}
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
            <Typography level='body4'>
              @{user.Username}
            </Typography>
            <Stack direction='row' gap={1}>              
              <Typography level='body1'>
                {user.name}
              </Typography>
              <Box
                sx = {{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography level='body5'
                  sx = {{
                    height: '1.5em',
                  }}
                >
                  aka
                </Typography>
              </Box>
              <Typography level='body1'>
                DJ {user.djName}
              </Typography>
            </Stack>
            <Typography level='body2' color='primary'>
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
            openPopup(
              <ConfirmPopup
                message="You're Live! Would you like to complete the flowsheet and log out?"
                onConfirm={() => {
                  setLive(false);
                  addToEntries({
                    message: `DJ ${user.djName} left at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
                  })
                  handleLogout();
                }}
              />
            )
          } else {
            handleLogout();
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
