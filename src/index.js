import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { sendToVercelAnalytics } from './vitals';
import ViewProvider from './components/theme/viewStyleToggle';

import { Amplify } from 'aws-amplify';
import awsExports from './services/authentication/aws-exports';
import { RouterProvider, createHashRouter } from 'react-router-dom';

Amplify.configure({
  Auth: {
    region: awsExports.REGION,
    userPoolId: awsExports.USER_POOL_ID,
    userPoolWebClientId: awsExports.USER_POOL_APP_CLIENT_ID,
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <ViewProvider>
      <App />
    </ViewProvider>
);
