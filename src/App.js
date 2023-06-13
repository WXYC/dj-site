import React, { useState, createContext, useContext, useEffect } from 'react';
import { CssBaseline, CssVarsProvider, GlobalStyles } from '@mui/joy';
import wxycTheme from './theme';

import { BrowserRouter, Route, Routes, Navigate, HashRouter } from 'react-router-dom';
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

import { Auth } from 'aws-amplify';

export const RedirectContext = createContext({redirect: '/'});

function App() {

  const { classicView } = useContext(ViewContext);

  const [ authenticating, setAuthenticating ] = useState(false);

  const redirectContext = useContext(RedirectContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [resetPasswordRequired, setResetPasswordRequired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);

  const [user, setUser] = useState(null);
  const [userObject, setUserObject] = useState(null);

  const login = async(event) => {
    event.preventDefault();
    setAuthenticating(true);
    try { 
      let attemptResult = await Auth.signIn(
        event.target.user.value,
        event.target.password.value
      );
      setUserObject(attemptResult);
      console.log(attemptResult);
      try {
        let user = await Auth.currentAuthenticatedUser();
        if (user) {
          setIsAuthenticated(true);
          toast.success('Logged in successfully!');
        } else {
          setAuthenticating(false);
          setResetPasswordRequired(true);
        }
      } catch (error) {
        if (error === 'The user is not authenticated') {
          setAuthenticating(false);
          setResetPasswordRequired(true);
        } else {
          toast.error(error);
        }
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAuthenticating(false);
    }
  }

  const logout = async(event) => {
    event.preventDefault();
    
    try {
      await Auth.signOut();
      //toast.success('Logged out successfully!');
      setIsAuthenticated(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResetPasswordRequired(false);
    }
  }

  const handlePasswordUpdate = async(event) => {
    event.preventDefault();

    setAuthenticating(true);

    let my_password = event.target.password.value.toString();
    
    try {
      await Auth.completeNewPassword(
          userObject,
          my_password,
          {
            name: event.target.user.value,
          }
      );
      let user = await Auth.currentAuthenticatedUser();
      setUser(user);
      if (user) {
        setIsAuthenticated(true);
        toast.success(`Welcome, ${user.attributes.name}!`);
        try {
          await Auth.updateUserAttributes(user, {
            'custom:dj-name': event.target.djName.value,
          });
        } catch (error) {
          toast.error(error.message);
        }
      }
    }
    catch (error) {
      toast.error(error.message);
    } finally {
      setAuthenticating(false);
      setResetPasswordRequired(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        let user = await Auth.currentAuthenticatedUser();
        setUser(user);
      } catch (error) {
        console.log(error);
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
      console.log(user);
    } else {
      setIsAuthenticated(false);
    }
  }, [user]);

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
                {
                  isAuthenticated ? (
                    <>
                    <Route path="/*" element={
                      <Dashboard
                        djName = {user.username ?? 'no username'}
                        isAdmin = {isAdmin}
                        logout={logout}
                        altViewAvailable = {(typeof classicView !== 'undefined')}
                      >
                        <Routes>
                          <Route path="/catalog" element={
                            <CatalogPage />
                          } />
                          <Route path="/flowsheet" element={
                            <div>To be implemented!</div>
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
                          <Route path="/login" element={<Navigate to={redirectContext.redirect}/>} />
                          <Route path="/*" element={<Navigate to="/catalog" />} />
                        </Routes>
                      </Dashboard>
                    } />
                    </>
                  ) : (
                    <>
                    <Route path="/*" element={<Navigate to={`/login?continue=${window.location.pathname}`} />} />
                    <Route path="/login" element={
                      <LoginPage
                        authenticating={authenticating}
                        login={login}
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
