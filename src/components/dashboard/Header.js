import React from 'react';
import IconButton from '@mui/joy/IconButton';
import Sheet from '@mui/joy/Sheet';
import { toggleSidebar } from './SidebarMobileUtilities';
import Box from '@mui/joy/Box';
import Logo from '../branding/logo';
import { ColorSchemeToggle } from '../general/theme/colorSchemeToggle';
import { ViewStyleToggle } from '../general/theme/viewStyleToggle';
import DragHandleIcon from '@mui/icons-material/DragHandle';

/**
 * Component representing the header that is most visible on mobile devices.
 *
 * @component
 * @category Dashboard
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.altViewAvailable - Determines whether the alternative view is available. In a future release, this will be found from context.
 *
 * @returns {JSX.Element} The rendered Header component.
 *
 * @example
 * // Usage example:
 * import Header from '../components/Header';
 *
 * const MobileView = () => {
 *   const altViewAvailable = true;
 *
 *   return (
 *     <div>
 *       <Header altViewAvailable={altViewAvailable} />
 *     </div>
 *   );
 * };
 *
 * @see [IconButton (Mui-Joy component)](https://mui.com/joy-ui/react-icon-button/)
 * @see [Sheet (Mui-Joy component)](https://mui.com/joy-ui/react-sheet/)
 * @see [Box (Mui-Joy component)](https://mui.com/joy-ui/react-box/)
 * @see [Logo component](../branding/logo)
 * @see [ColorSchemeToggle component](../general/theme/colorSchemeToggle)
 * @see [ViewStyleToggle component](../general/theme/viewStyleToggle)
 * @see [DragHandleIcon (Mui Icons)](https://mui.com/components/material-icons/#draghandle)
 */
export default function Header({ altViewAvailable }) {
  return (
    <Sheet
      sx={{
        display: { xs: 'flex', md: 'none' },
        justifyContent: 'space-between',
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
        <DragHandleIcon />
      </IconButton>
      <Box
        sx = {(theme) => ({
          height: '100%',
        })}
      >
        <Logo />
      </Box>
      <Box>
        <ColorSchemeToggle />
        {(altViewAvailable) && <ViewStyleToggle />}
      </Box>
    </Sheet>
  );
}
