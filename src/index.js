import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ViewProvider from './components/general/theme/viewStyleToggle';
import './index.css';
import { AuthProvider } from './services/authentication/authentication-context';
import { CssVarsProvider } from '@mui/joy';
import { HashRouter } from 'react-router-dom';
import wxycTheme from './theme';


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <CssVarsProvider
      defaultMode='system'
      disableTransitionOnChange
      theme={wxycTheme}
    >
    <HashRouter basename='/'>
    <AuthProvider>
    <ViewProvider>
      <App />
    </ViewProvider>
    </AuthProvider>
    </HashRouter>
    </CssVarsProvider>
);
