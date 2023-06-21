import { CssBaseline, CssVarsProvider, GlobalStyles } from '@mui/joy';
import React, { createContext, useContext } from 'react';
import wxycTheme from './theme';

import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import CLASSIC_CatalogPage from './CLASSIC_VIEW/CLASSIC_Catalog';
import CLASSIC_Dashboard from './CLASSIC_VIEW/CLASSIC_Dashboard';
import CLASSIC_Flowsheet from './CLASSIC_VIEW/CLASSIC_Flowsheet';
import CLASSIC_LoginPage from './CLASSIC_VIEW/CLASSIC_Login';
import { ViewContext } from './components/theme/viewStyleToggle';
import CatalogPage from './pages/catalog/CatalogPage';
import Dashboard from './pages/dashboard/DashboardPage';
import LoginPage from './pages/login/LoginPage';
import StationManagementPage from './pages/station-management/StationManagementPage';

import { PopupProvider } from './pages/dashboard/Popup';
import { PublicDJPage } from './pages/dj/PublicDJPage';
import FlowsheetPage from './pages/flowsheet/FlowsheetPage';
import SettingsPage from './pages/settings/SettingsPage';
import { useAuth } from './services/authentication/authentication-context';
import { login, logout } from './services/authentication/authentication-service';
import CallingCard from './widgets/calling-card/CallingCard';
import NowPlaying from './widgets/now-playing/NowPlaying';

export const RedirectContext = createContext({redirect: '/'});

function App() {

  const { classicView } = useContext(ViewContext);
  const redirectContext = useContext(RedirectContext);
  const auth = useAuth();

  if (!classicView) {
    return (
      <div className="App">
        <CssVarsProvider
          defaultMode='system'
          disableTransitionOnChange
          theme={wxycTheme}
          >
            <CssBaseline />
            <GlobalStyles
              styles={(theme) => ({
                ':root': {
                  '--Collapsed-breakpoint': '769px',
                  '--Cover-width': '40vw',
                  '--Form-maxWidth': '700px',
                  '--Transition-duration': '0.4s',
                  '--Header-height': '4rem',
                  [theme.breakpoints.up('md')]: {
                    '--Header-height': '0px',
                  },
                },
              })}
            />
            <Toaster closeButton richColors  />
            <HashRouter basename='/'>
              <Routes>
                <Route path="/NowPlaying" element={<NowPlaying />} />
                <Route path="/DJ">
                  <Route exact path="" element={<Navigate to="/login" />} />
                  <Route path=":djName">
                    <Route path=""  element={<PublicDJPage />} />
                    <Route path="shows" element={<div>Shows</div>} />
                  </Route>
                </Route>
                {
                  auth.isAuthenticated ? (
                    <>
                    <Route path="/*" element={
                      <Dashboard
                        altViewAvailable = {(typeof classicView !== 'undefined')}
                      >
                        <PopupProvider>
                        <Routes>
                          <Route path="/catalog" element={
                            <CatalogPage />
                          } />
                          <Route path="/flowsheet" element={
                            <FlowsheetPage />
                          } />
                          <Route path="/playlist" element={<div>To be implemented!</div>} />
                          <Route path="/insights" element={<div>To be implemented!</div>} />
                          <Route path="/admin" element={
                            (auth.isAdmin) ? (
                              <StationManagementPage />
                            ) : (
                              <Navigate to={redirectContext.redirect} />
                            )
                          } />
                          <Route path="/settings" element = {
                            <SettingsPage />
                          } />
                          <Route path="/login" element={<Navigate to={redirectContext.redirect}/>} />
                          <Route path="/*" element={<Navigate to="/catalog" />} />
                        </Routes>
                        </PopupProvider>
                      </Dashboard>
                    } />
                    </>
                  ) : (
                    <>
                    <Route path="/*" element={<Navigate to={(window.location.hash.length > 0) ? `/login?continue=${window.location.hash}` : '/login'} />} />
                    <Route path="/login" element={
                      <LoginPage
                        altViewAvailable = {(typeof classicView !== 'undefined')}
                      />
                    } />
                    </>
                  )
                }
              </Routes>
            </HashRouter>
          </CssVarsProvider>
      </div>
    );
  } else {
    return (
      <div className="App">
        <BrowserRouter>
          <Routes>
            {
              auth.isAuthenticated ? (
                <>
                <Route path="/*" element={
                  <CLASSIC_Dashboard>
                    <Routes>
                      <Route path="/catalog" element={
                        <CLASSIC_CatalogPage 
                          logout={logout}
                        />
                      } />
                      <Route path="/flowsheet" element={
                        <CLASSIC_Flowsheet 
                          logout={logout}
                        />
                      } />
                      <Route path="/playlist" element={<div>Playlists are unavailable in classic view mode. Please Switch.</div>} />
                      <Route path="/insights" element={<div>Insights are unavailable in classic view mode. Please Switch.</div>} />
                      <Route path="/login" element={<Navigate to={redirectContext.redirect}/>} />
                      <Route path="/*" element={<Navigate to="/catalog" />} />
                    </Routes>
                  </CLASSIC_Dashboard>
                } />
                </>
              ) : (
                <>
                <Route path="/*" element={<Navigate to={`/login?continue=${window.location.pathname}`} />} />
                <Route path="/login" element={
                  <CLASSIC_LoginPage
                    login = {login}
                  />
                } />
                </>
              )
            }
          </Routes>
        </BrowserRouter>
      </div>
    )
  }
}

export default App;
