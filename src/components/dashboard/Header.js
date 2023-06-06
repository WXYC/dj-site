import React from 'react';
import IconButton from '@mui/joy/IconButton';
import Sheet from '@mui/joy/Sheet';
import { toggleSidebar } from './utilities';
import Box from '@mui/joy/Box';
import Logo from '../branding/logo';
import { ColorSchemeToggle } from '../theme/colorSchemeToggle';

export default function Header() {
  return (
    <Sheet
      sx={{
        display: { xs: 'flex', md: 'none' },
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        width: '100vw',
        height: 'var(--Header-height)',
        zIndex: 9995,
        py: 1,
        px: 2,
        gap: 1,
        boxShadow: 'sm',
      }}
    >
      <IconButton
        onClick={() => toggleSidebar()}
        variant="outlined"
        color="neutral"
        size="sm"
      >
        <i data-feather="menu" />
      </IconButton>
      <Box>
        <Logo />
      </Box>
      <ColorSchemeToggle />
    </Sheet>
  );
}
