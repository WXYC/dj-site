import { CssBaseline, GlobalStyles } from '@mui/joy';
import React, { createContext, useContext, useEffect } from 'react';

import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
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
import NowPlaying from './widgets/now-playing/NowPlaying';
import Redirect from './pages/login/redirect';
import SchedulePage from './pages/schedule/SchedulePage';
import PlaylistsPage from './pages/playlists/PlaylistsPage';
import PlaylistPage from './pages/playlists/PlaylistPage';

function App() {

  const { classicView } = useContext(ViewContext);
  const auth = useAuth();

  if (!classicView) {
    return (
      <div className="App">
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
                          <Route path="/playlists">
                            <Route path="" element={<PlaylistsPage />} />
                            <Route path=":djName">
                              <Route path=":playlistName" element={
                                <PlaylistPage />
                              } />
                            </Route>
                          </Route>
                          <Route path="/schedule" element={
                            <SchedulePage />
                          } />
                          <Route path="/admin" element={
                            (auth.isAdmin) ? (
                              <StationManagementPage />
                            ) : (
                              <Navigate to={'/catalog'} />
                            )
                          } />
                          <Route path="/settings" element = {
                            <SettingsPage />
                          } />
                          <Route path="/*" element={
                            <Navigate to={window.location.hash?.split('?continue=')?.[1]?.replace('#', '') ?? "/catalog"} />} 
                          />
                        </Routes>
                        </PopupProvider>
                      </Dashboard>
                    } />
                    </>
                  ) : (
                    <>
                    <Route path="/login" element={
                      <LoginPage
                        altViewAvailable = {(typeof classicView !== 'undefined')}
                      />
                    } />
                    <Route exact path="/" element={<Navigate to={`/login`} />} />
                    <Route path=":redirect" element={<Redirect />} />
                    </>
                  )
                }
              </Routes>
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
                      <Route path="/playlists" element={<div>Playlists are unavailable in classic view mode. Please Switch.</div>} />
                      <Route path="/schedule" element={<div>schedule are unavailable in classic view mode. Please Switch.</div>} />
                      <Route path="/login" element={<Navigate to={'broken'}/>} />
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
