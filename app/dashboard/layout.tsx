'use client';
import Box from '@mui/joy/Box';
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard";
import Header from '../components/Dashboard/Header';
import { getClassicView, getClassicViewAvailable, useSelector } from '@/lib/redux';
import FirstSidebar from '../components/Dashboard/FirstSidebar';
import { ColorSchemeToggle } from '../components/General/Theme/ColorSchemeToggle';
import { ViewStyleToggle } from '../components/General/Theme/ViewStyleToggle';
import SecondSidebar from '../components/Dashboard/SecondSidebar';

/**
 * @page
 * @category DashboardLayout
 *
 * @description
 * The Dashboard component is the wrapper for all authenticated pages in the application. It provides the layout and sidebars for the dashboard view. This component is responsible for rendering the header, sidebars, main content area, and toggles for color scheme and view style.
 *
 * @param {ReactNode} props.children - The child components to be rendered within the main content area.
 *
 * @returns {JSX.Element} The rendered Dashboard component.
 */
export default function DashboardLayout(props: React.PropsWithChildren): JSX.Element {

    const classicView = useSelector(getClassicView);
    const classicViewAvailable = useSelector(getClassicViewAvailable);

    if (classicView) return (<>{props.children}</>)

    return (
    <>
        <AuthenticationGuard redirectTo="/login" savePath />
        <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
            <Header altViewAvailable = {classicViewAvailable} />
            <FirstSidebar />
        <Box
          component="main"
          className="MainContent"
          sx={(theme) => ({
            px: {
              xs: 2,
              md: 6,
            },
            pt: {
              xs: `calc(${theme.spacing(2)} + var(--Header-height))`,
              sm: `calc(${theme.spacing(2)} + var(--Header-height))`,
              md: 3,
            },
            pb: {
              xs: 2,
              sm: 2,
              md: 3,
            },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: '100dvh',
            gap: 1,
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{ ml: 'auto', display: { xs: 'none', md: 'inline-flex' } }}
            >
              <ColorSchemeToggle />
              <ViewStyleToggle />
            </Box>
          </Box>
          {props.children}
        </Box>
            <SecondSidebar />
        </Box>
    </>
    );
}