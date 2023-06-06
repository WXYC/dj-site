import logo from './logo.svg';
import './App.css';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import wxycTheme from './theme';

import { Toaster, toast } from 'sonner';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
                      handlePasswordChange={handlePasswordChange}
                      handleUserNameChange={handleUserNameChange}
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
