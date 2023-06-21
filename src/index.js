import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ViewProvider from './components/theme/viewStyleToggle';
import './index.css';
import { AuthProvider } from './services/authentication/authentication-context';


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <AuthProvider>
    <ViewProvider>
      <App />
    </ViewProvider>
    </AuthProvider>
);
