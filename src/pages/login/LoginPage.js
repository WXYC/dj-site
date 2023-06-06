import React, { useState } from 'react';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Checkbox from '@mui/joy/Checkbox';
import FormControl from '@mui/joy/FormControl';
import FormLabel, { formLabelClasses } from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Typography from '@mui/joy/Typography';
import Logo from '../../components/branding/logo';
import { ColorSchemeToggle } from '../../components/theme/colorSchemeToggle';

export default function LoginPage({
  handlePasswordChange,
  handleUserNameChange,
  login
}) {

    const redirectContext = useContext(RedirectContext);

    useEffect(() => {
        let query = new URLSearchParams(window.location.search);
        let redirect = query.get('continue');

        if (redirect) redirectContext.redirect = redirect;
    }, []);
    
  const quotesAndArtists = [
    ["to the Jungle", "Guns N' Roses"],
    ["to the Hotel California", "Eagles"],
    ["to the Black Parade", "My Chemical Romance"],
    ["to the Pleasuredome", "Frankie Goes to Hollywood"],
    ["Home", "Coheed and Cambria"],
    ["to My Life", "Simple Plan"],
    ["to the Party", "Diplo, French Montana, Lil Pump ft. Zhavia Ward"],
    ["to the Family", "Avenged Sevenfold"],
    ["to the Machine", "Pink Floyd"],
    ["to the Club", "Manian ft. Aila"]
  ];
  
  
const [randomIndexForQuote, setRIFQ] = useState(Math.floor(Math.random() * quotesAndArtists.length));

  return (
    <>
      <Box
        sx={(theme) => ({
          width:
            'clamp(100vw - var(--Cover-width), (var(--Collapsed-breakpoint) - 100vw) * 999, 100vw)',
          transition: 'width var(--Transition-duration)',
          transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(255 255 255 / 0.6)',
          [theme.getColorSchemeSelector('dark')]: {
            backgroundColor: 'rgba(19 19 24 / 0.4)',
          },
        })}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            width:
              'clamp(var(--Form-maxWidth), (var(--Collapsed-breakpoint) - 100vw) * 999, 100%)',
            maxWidth: '100%',
            px: 2,
          }}
        >
          <Box
            component="header"
            sx={{
              py: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box
            sx = {{
              height: 'clamp(2rem, 10vw, 7rem)',
            }}
            >
              <Logo />
            </Box>
            <ColorSchemeToggle />
          </Box>
          <Box
            component="main"
            sx={{
              my: 'auto',
              py: 2,
              pb: 5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              width: 400,
              maxWidth: '100%',
              mx: 'auto',
              borderRadius: 'sm',
              '& form': {
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              },
              [`& .${formLabelClasses.asterisk}`]: {
                visibility: 'hidden',
              },
            }}
          >
            <div>
              <Typography 
                level="h1"
                fontSize={'4.5rem'}
              >
                Welcome
              </Typography>
              <Typography
                level="h2"
                fontSize={'4.5rem'}
                >
                ...{quotesAndArtists[randomIndexForQuote][0]}
                </Typography>
              <Typography level="body2" sx={{ my: 1, mb: 3, textAlign: 'right' }}>
                - {quotesAndArtists[randomIndexForQuote][1]}
              </Typography>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <FormControl required>
                <FormLabel>Username</FormLabel>
                <Input placeholder="Enter your username" type="text" name="user" 
                  onChange={(event) => {
                    handleUserNameChange(event);
                  }}
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Password</FormLabel>
                <Input placeholder="•••••••" type="password" name="password" 
                  onChange={(event) => {
                    handlePasswordChange(event);
                  }}
                />
              </FormControl>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Checkbox size="sm" label="Remember for 30 days" name="persistent" />
              </Box>
              <Button type="submit" fullWidth
                onClick={(event) => {
                  login(event);
                }}
              >
                Sign in
              </Button>
            </form>
          </Box>
          <Box component="footer" sx={{ py: 3 }}>
            <Typography level="body3" textAlign="center">
              © WXYC Chapel Hill {new Date().getFullYear()}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box
        sx={(theme) => ({
          height: '100%',
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          left: 'clamp(0px, (100vw - var(--Collapsed-breakpoint)) * 999, 100vw - var(--Cover-width))',
          transition:
            'background-image var(--Transition-duration), left var(--Transition-duration) !important',
          transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
          backgroundColor: 'background.level1',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundImage:
            'url("/img/wxyc_color.png")',
          [theme.getColorSchemeSelector('dark')]: {
            backgroundImage:
              'url("/img/wxyc_dark.jpg")',
          },
        })}
      />
      </>
  );
}
