import Box from '@mui/joy/Box';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { SongCardProvider } from '../../components/catalog/SongCardContext';
import FirstSidebar from '../../components/dashboard/FirstSidebar';
import Header from '../../components/dashboard/Header';
import SecondSidebar from '../../components/dashboard/SecondSidebar';
import { BinProvider } from '../../components/dashboard/bin/Bin';
import { ColorSchemeToggle } from '../../components/theme/colorSchemeToggle';
import { ViewStyleToggle } from '../../components/theme/viewStyleToggle';

const Dashboard = (props) => {
  
  const location = useLocation();

  return (
    <React.Fragment>
      <SongCardProvider>
      <BinProvider>
      <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
        <Header altViewAvailable = {props.altViewAvailable} />
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
              <ColorSchemeToggle
              />
              <ViewStyleToggle
              />
            </Box>
          </Box>
          {props.children}
        </Box>
        <SecondSidebar />
      </Box>
      </BinProvider>
      </SongCardProvider>
      </React.Fragment>
  );
}

export default Dashboard;
