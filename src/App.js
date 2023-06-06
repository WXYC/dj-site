import React, { useState, createContext, useContext } from 'react';
import { CssBaseline, CssVarsProvider, GlobalStyles } from '@mui/joy';
import './App.css';
import wxycTheme from './theme';

import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginPage from './pages/login/LoginPage';
import Dashboard from './pages/dashboard/DashboardPage';

export const RedirectContext = createContext({redirect: '/'});

function App() {

  const redirectContext = useContext(RedirectContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async(event) => {
    setIsAuthenticated(true);
  }

  const logout = async(event) => {
    setIsAuthenticated(false);
  }

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
                '--Header-height': '52px',
                [theme.breakpoints.up('md')]: {
                  '--Header-height': '0px',
                },
              },
            })}
          />
          <Toaster closeButton richColors  />
          <BrowserRouter>
            <Routes>
              {
                isAuthenticated ? (
                  <>
                  <Route path="/*" element={
                    <Dashboard
                      logout={logout}
                    >
                      <Routes>
                        <Route path="/catalog" element={<div>To be implemented!</div>} />
                        <Route path="/flowsheet" element={<div>To be implemented!</div>} />
                        <Route path="/playlist" element={<div>To be implemented!</div>} />
                        <Route path="/insights" element={<div>To be implemented!</div>} />
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
                      handlePasswordChange={(event) => console.log(event.target.value)}
                      handleUserNameChange={(event) => console.log(event.target.value)}
                      login={login}
                    />
                  } />
                  </>
                )
              }
            </Routes>
          </BrowserRouter>
        </CssVarsProvider>
    </div>
  );
}

export default App;
