import React, { useState, createContext, useContext, useEffect } from 'react';
import { CssBaseline, CssVarsProvider, GlobalStyles } from '@mui/joy';
import wxycTheme from './theme';

import { BrowserRouter, Route, Routes, Navigate, HashRouter, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import LoginPage from './pages/login/LoginPage';
import Dashboard from './pages/dashboard/DashboardPage';
import ViewProvider, { ViewContext } from './components/theme/viewStyleToggle';
import CLASSIC_LoginPage from './CLASSIC_VIEW/CLASSIC_Login';
import CLASSIC_Dashboard from './CLASSIC_VIEW/CLASSIC_Dashboard';
import CLASSIC_CatalogPage from './CLASSIC_VIEW/CLASSIC_Catalog';
import CatalogPage from './pages/catalog/CatalogPage';
import CLASSIC_Flowsheet from './CLASSIC_VIEW/CLASSIC_Flowsheet';
import StationManagementPage from './pages/station-management/StationManagementPage';

import FlowsheetPage from './pages/flowsheet/FlowsheetPage';
import { PopupProvider } from './pages/dashboard/Popup';
import { login, checkAuth, logout, updatePassword } from './services/authentication/authenticationFunctions';
import SettingsPage from './pages/settings/SettingsPage';
import CallingCard from './widgets/calling-card/CallingCard';
import NowPlaying from './widgets/now-playing/NowPlaying';

export const RedirectContext = createContext({redirect: '/'});

function App() {

  const { classicView } = useContext(ViewContext);

  const [ authenticating, setAuthenticating ] = useState(false);

  const redirectContext = useContext(RedirectContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [resetPasswordRequired, setResetPasswordRequired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);

  const [userObject, setUserObject] = useState({});


  useEffect(() => {
    forceUpdate();
  }, []);

  const forceUpdate = async () => {
    const authResult = await checkAuth();
    setAuthResult(authResult);
  }

  useEffect(() => {
    console.log(userObject);
  }, [userObject]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthenticating(true);
    try {
      const authResult = await login(event);
      setAuthResult(authResult);
    } catch (error) {
      toast.error(error.toString());
    } finally {
      setAuthenticating(false);
    }
  }

  const handleLogout = async () => {
    try {
      const authResult = await logout();
      setAuthResult(authResult);
    } catch (error) {
      toast.error(error.toString());
    }
  }

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setAuthenticating(true);
    try {
      const authResult = await updatePassword(event, userObject);
      setAuthResult(authResult);
    } catch (error) {
      toast.error(error.toString());
    } finally {
      setAuthenticating(false);
    }
  }

  const setAuthResult = (authResult) => {
    console.log(authResult);
    setUserObject(authResult.userObject);
    setResetPasswordRequired(authResult.resetPasswordRequired);
    setIsAuthenticated(authResult.isAuthenticated);
    setIsAdmin(authResult.isAdmin);
  }


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
                <Route path="/CallingCard" element={<CallingCard />} />
                <Route path="/NowPlaying" element={<NowPlaying />} />
                {
                  isAuthenticated ? (
                    <>
                    <Route path="/*" element={
                      <Dashboard
                        username = {userObject?.Username}
                        name = {userObject?.UserAttributes?.find((attr) => attr.Name === 'name')?.Value ?? 'No name!'}
                        djName = {userObject?.UserAttributes?.find((attr) => attr.Name === 'custom:dj-name')?.Value ?? 'No DJ name!'}
                        isAdmin = {isAdmin}
                        logout={handleLogout}
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
                            (isAdmin) ? (
                              <StationManagementPage />
                            ) : (
                              <Navigate to={redirectContext.redirect} />
                            )
                          } />
                          <Route path="/settings" element = {
                            <SettingsPage
                              username = {userObject?.Username}
                              djName = {userObject?.UserAttributes?.find((attr) => attr.Name === 'custom:dj-name')?.Value ?? 'You have no DJ name!'}
                              name = {userObject?.UserAttributes?.find((attr) => attr.Name === 'name')?.Value ?? 'You have no name!'}
                              forceUpdate = {forceUpdate}
                            />
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
                        authenticating={authenticating}
                        login={handleLogin}
                        resetPasswordRequired={resetPasswordRequired}
                        handlePasswordUpdate={handlePasswordUpdate}
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
              isAuthenticated ? (
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
