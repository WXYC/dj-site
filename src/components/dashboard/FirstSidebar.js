import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import GlobalStyles from '@mui/joy/GlobalStyles';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton from '@mui/joy/ListItemButton';
import Sheet from '@mui/joy/Sheet';
import React from 'react';
import Logo from '../branding/logo';

import AlbumIcon from '@mui/icons-material/Album';
import InsightsIcon from '@mui/icons-material/Insights';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import StreamIcon from '@mui/icons-material/Stream';
import Tooltip from '@mui/joy/Tooltip';

import { Badge, IconButton, Typography } from '@mui/joy';
import { useLocation, useNavigate } from 'react-router-dom';

export default function FirstSidebar({ djname, logout }) {

  const navigate = useNavigate();
  const location = useLocation();
  const [hovering, setHovering] = React.useState(false);

  return (
    <Sheet
      className="FirstSidebar"
      variant="soft"
      color="primary"
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
        <Logo />
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
                badgeContent = {''} // will be non-empty when DJ is live
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
          <ListItemButton onClick={() => navigate('/playlist')}
            variant={location.pathname === '/playlist' ? 'solid' : 'plain'}
          >
            <StorageIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>
        <ListItem>
            <Tooltip
                title="Insights"
                arrow={true}
                placement='right'
                size='sm'
                variant='outlined'
                disabledw
            >
          <ListItemButton
            onClick={() => navigate('/insights')}
            variant={location.pathname === '/insights' ? 'solid' : 'plain'}
          >
            <InsightsIcon />
          </ListItemButton>
            </Tooltip>
        </ListItem>
      </List>
      <Divider />
      <Tooltip
        title={
          <>
          <Typography level='body1' color="primary">
            Logged in as {djname}
          </Typography>
          <Typography level='body2' color="secondary">
            Click to logout
          </Typography>
          </>
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
          logout();
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
