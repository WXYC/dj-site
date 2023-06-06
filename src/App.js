import React, { useState, createContext } from 'react';
import { CssBaseline, CssVarsProvider, GlobalStyles } from '@mui/joy';
import './App.css';
import wxycTheme from './theme';

import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginPage from './pages/login/LoginPage';

export const RedirectContext = createContext({redirect: '/'});

function App() {

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async(event) => {
    event.preventDefault();
    setIsAuthenticated(true);
  }

  const logout = async(event) => {
    event.preventDefault();
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
            styles={{
              ':root': {
                '--Collapsed-breakpoint': '769px',
                '--Cover-width': '40vw',
                '--Form-maxWidth': '700px',
                '--Transition-duration': '0.4s',
              },
            }}
          />
          <Toaster closeButton richColors  />
          <BrowserRouter>
            <Routes>
              {
                isAuthenticated ? (
                  <div>Hello, world!</div>
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
