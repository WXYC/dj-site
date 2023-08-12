import Box from '@mui/joy/Box';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { SongCardProvider } from '../../components/catalog/SongCardContext';
import FirstSidebar from '../../components/dashboard/FirstSidebar';
import Header from '../../components/dashboard/Header';
import SecondSidebar from '../../components/dashboard/SecondSidebar';
import { BinProvider } from '../../services/bin/bin-context';
import { ColorSchemeToggle } from '../../components/general/theme/colorSchemeToggle';
import { ViewStyleToggle } from '../../components/general/theme/viewStyleToggle';
import { LiveProvider } from '../../services/flowsheet/live-context';
import { PopupProvider } from './Popup';
import { FlowsheetProvider } from '../../services/flowsheet/flowsheet-context';
import ProtectedRoute from '../../components/authentication/ProtectedRoute';
import { CatalogProvider } from '../../services/card-catalog/card-catalog-context';

Array.prototype.fuzzySearchByNestedProps = function (query, props) {
  var search = query.split(' ');
  var ret = this.reduce((found, i) => {
    var matches = 0;
    search.forEach(s => {
      var propsMatched = 0;

      // Recursive function to search through nested objects
      function searchNestedProps(obj, propChain) {
        if (typeof obj === 'object') {
          for (var nestedProp in obj) {
            var newPropChain = propChain.concat(nestedProp);
            if (props.includes(newPropChain.join('.')) && typeof obj[nestedProp] === 'string' && obj[nestedProp].indexOf(s) > -1) {
              propsMatched++;
            }
            searchNestedProps(obj[nestedProp], newPropChain);
          }
        }
      }

      searchNestedProps(i, []);

      if (propsMatched === props.length) {
        matches++;
      }
    });

    if (matches === search.length) {
      found.push(i);
    }
    return found;
  }, []);

  return ret;
};



/**
 * @page
 * @category Dashboard
 *
 * @description
 * The Dashboard component is the wrapper for all authenticated pages in the application. It provides the layout and sidebars for the dashboard view. This component is responsible for rendering the header, sidebars, main content area, and toggles for color scheme and view style.
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.altViewAvailable - Indicates whether an alternative view (classic view) is available. Will be moved to ProtectedRoute in a later release.
 * @param {ReactNode} props.children - The child components to be rendered within the main content area.
 *
 * @returns {JSX.Element} The rendered Dashboard component.
 */
const Dashboard = (props) => {
  
  const location = useLocation();

  return (
    <ProtectedRoute>
      <FlowsheetProvider>
      <CatalogProvider>
      <PopupProvider>
      <LiveProvider>
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
      </LiveProvider>
      </PopupProvider>
      </CatalogProvider>
      </FlowsheetProvider>
      </ProtectedRoute>
  );
}

export default Dashboard;
