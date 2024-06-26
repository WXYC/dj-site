"use client";

import {
  getClassicView,
  getClassicViewAvailable,
  isAuthenticating,
  isLoggedIn,
  login,
  needsNewPassword,
  useDispatch,
  useSelector,
} from "@/lib/redux";
import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import { LinearProgress, Link } from "@mui/joy";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormLabel, { formLabelClasses } from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Typography from "@mui/joy/Typography";
import { redirect, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard";
import Logo from "../components/Branding/Logo";
import { ColorSchemeToggle } from "../components/General/Theme/ColorSchemeToggle";
import { ViewStyleToggle } from "../components/General/Theme/ViewStyleToggle";
import ClassicLogin from "./classic";
import { prefix } from "@/utils/prefix";
import PageHeader from "@/utils/head";

/**
 * @page
 * @category Authentication
 * @description The login page for the application.
 * @returns {JSX.Element} The rendered component
 */
export default function LoginPage(): JSX.Element {
  const classicView = useSelector(getClassicView);

  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/dashboard";

  const authenticating = useSelector(isAuthenticating);
  const loggedIn = useSelector(isLoggedIn);
  const resetPasswordRequired = useSelector(needsNewPassword);

  const dispatch = useDispatch();
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = form.username.value;
    const password = form.password.value;

    console.log("Logging in");

    if (username && password) {
      console.log("Dispatching login action");
      dispatch(login({ username, password }));
    }
  };

  const handlePasswordUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const altViewAvailable = useSelector(getClassicViewAvailable);

  const [name, setName] = useState("");
  const [djName, setDjName] = useState("");
  const [value, setValue] = useState(""); // for the password field
  const [confirmValue, setConfirmValue] = useState(""); // for the confirm password field
  const [pWordStrength, setPWordStrength] = useState(""); // for the password strength meter
  const minLength = 8; // for the password strength meter

  const welcomeQuotesAndArtists = [
    ["to the Jungle", "Guns N' Roses"],
    ["to the Hotel California", "Eagles"],
    ["to the Black Parade", "My Chemical Romance"],
    ["to the Pleasuredome", "Frankie Goes to Hollywood"],
    ["Home", "Coheed and Cambria"],
    ["to My Life", "Simple Plan"],
    ["to the Party", "Diplo, French Montana, Lil Pump ft. Zhavia Ward"],
    ["to the Family", "Avenged Sevenfold"],
    ["to the Machine", "Pink Floyd"],
    ["to the Club", "Manian ft. Aila"],
  ];

  const holdOnQuotesAndArtists = [
    ["for one more day.", "Wilson Phillips"],
    ["if you feel like letting go.", "Tom Waits"],
    ["tight to your dreams.", "Electric Light Orchestra"],
    ["be strong, and stay true to yourself.", "2Pac"],
    ["if you believe in love.", "Michael Bublé"],
    ["when everything falls apart.", "Good Charlotte"],
    ["to what you believe in.", "Mumford & Sons"],
    ["I'm still alive.", "Pearl Jam"],
    ["when the night is closing in.", "Chris Cornell"],
    ["to hope if you got it.", "Florence + The Machine"],
  ];

  const randomIndexForWelcomeQuote = Math.floor(
    Math.random() * welcomeQuotesAndArtists.length
  );
  const randomIndexForHoldOnQuote = Math.floor(
    Math.random() * holdOnQuotesAndArtists.length
  );

  useEffect(() => {
    // Needs one capital letter, one lowercase letter, and one number
    // Needs to be at least 8 characters long
    // start with capital letter test:
    let strengthString = "Needs ";
    if (!value.match(/[A-Z]/g)) {
      strengthString += "one capital letter";
    }
    // lowercase letter test:
    if (!value.match(/[a-z]/g)) {
      strengthString +=
        strengthString === "Needs "
          ? "one lowercase letter"
          : ", one lowercase letter";
    }
    // number test:
    if (!value.match(/[0-9]/g)) {
      strengthString +=
        strengthString === "Needs " ? "one number" : ", one number";
    }
    // length test:
    if (value.length < minLength) {
      strengthString +=
        strengthString === "Needs "
          ? `to be at least ${minLength} characters long`
          : `, to be at least ${minLength} characters long`;
    }
    // add 'and' if there are multiple requirements at second-to-last requirement
    if ((strengthString?.match(/,/g)?.length ?? 0) > 0) {
      strengthString = strengthString.replace(/,([^,]*)$/, " and$1");
    }
    // if all tests pass, strengthString will still be 'Needs '
    if (strengthString === "Needs ") {
      strengthString = "Strong";
    }
    setPWordStrength(strengthString);
  }, [value]);

  // REDIRECT IF ALREADY LOGGED IN
  if (!authenticating && loggedIn) redirect(redirectTo);
  // ----------------------------

  if (classicView) {
    return <ClassicLogin />;
  }

  return (
    <Box sx={{ height: "100%" }}>
      <AuthenticationGuard redirectTo="/login" savePath />
      <PageHeader title="Login" />
      <Box
        sx={(theme) => ({
          width:
            "clamp(100vw - var(--Cover-width), (var(--Collapsed-breakpoint) - 100vw) * 999, 100vw)",
          transition: "width var(--Transition-duration)",
          transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          justifyContent: "flex-end",
          backdropFilter: "blur(4px)",
          backgroundColor: "rgba(255 255 255 / 0.6)",
          [theme.getColorSchemeSelector("dark")]: {
            backgroundColor: "rgba(19 19 24 / 0.4)",
          },
        })}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width:
              "clamp(var(--Form-maxWidth), (var(--Collapsed-breakpoint) - 100vw) * 999, 100%)",
            maxWidth: "100%",
            px: 2,
          }}
        >
          <Box
            component="header"
            sx={{
              py: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                height: "clamp(2rem, 10vw, 7rem)",
              }}
            >
              <Logo />
            </Box>
            <Box>
              <ColorSchemeToggle />
              {altViewAvailable && <ViewStyleToggle />}
            </Box>
          </Box>
          <Box
            component="main"
            sx={{
              my: "auto",
              py: 2,
              pb: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              width: 400,
              maxWidth: "100%",
              mx: "auto",
              borderRadius: "sm",
              "& form": {
                display: "flex",
                flexDirection: "column",
                gap: 2,
              },
              [`& .${formLabelClasses.asterisk}`]: {
                visibility: "hidden",
              },
            }}
          >
            {resetPasswordRequired ? (
              <>
                <div>
                  <Link
                    startDecorator={<ArrowLeftIcon />}
                    href="/#/login"
                    level="body-sm"
                    sx={{ alignSelf: "flex-end", mb: 3 }}
                  >
                    Log in with a different account
                  </Link>
                  <Typography level="h1" fontSize={"4.5rem"}>
                    Hold On
                  </Typography>
                  <Typography level="h3" suppressHydrationWarning>
                    ...{holdOnQuotesAndArtists[randomIndexForHoldOnQuote][0]}
                  </Typography>
                  <Typography
                    level="body-md"
                    sx={{ my: 1, mb: 3, textAlign: "right" }}
                    suppressHydrationWarning
                  >
                    - {holdOnQuotesAndArtists[randomIndexForHoldOnQuote][1]}
                  </Typography>
                  <Typography level="body-sm">
                    Actually, we just need some more information from you.
                  </Typography>
                </div>
                <form onSubmit={handlePasswordUpdate} autoComplete="off">
                  <FormControl required>
                    <FormLabel>Real Name</FormLabel>
                    <Input
                      placeholder="Enter your real name"
                      type="text"
                      name="name"
                      disabled={authenticating}
                      color={name.length > 0 ? "success" : "primary"}
                      onChange={(e) => {
                        setName(e.target.value);
                      }}
                      value={name}
                    />
                    <Typography level="body-xs">
                      You can change this later.
                    </Typography>
                  </FormControl>
                  <FormControl required>
                    <FormLabel>DJ Name</FormLabel>
                    <Input
                      placeholder="Enter your DJ name"
                      type="text"
                      name="djName"
                      disabled={authenticating}
                      color={djName.length > 0 ? "success" : "primary"}
                      onChange={(e) => {
                        setDjName(e.target.value);
                      }}
                      value={djName}
                    />

                    <Typography level="body-xs">
                      You can change this later.
                    </Typography>
                  </FormControl>
                  <FormControl
                    required
                    sx={{
                      "--hue": Math.min(value.length * 10, 120),
                    }}
                  >
                    <FormLabel>New Password</FormLabel>
                    <Input
                      placeholder="•••••••"
                      type="password"
                      name="password"
                      disabled={authenticating}
                      onChange={(e) => {
                        setValue(e.target.value);
                      }}
                      value={value}
                      error={pWordStrength !== "Strong"}
                      color={pWordStrength === "Strong" ? "success" : "primary"}
                    />
                    <LinearProgress
                      determinate
                      size="sm"
                      value={Math.min((value.length * 100) / minLength, 100)}
                      sx={{
                        mt: 1,
                        bgcolor: "background.level3",
                        color: "hsl(var(--hue) 80% 40%)",
                      }}
                    />
                    <Typography
                      level="body-xs"
                      sx={{
                        alignSelf: "flex-end",
                        color: "hsl(var(--hue) 80% 30%)",
                      }}
                    >
                      {pWordStrength}
                    </Typography>
                  </FormControl>
                  <FormControl required>
                    <FormLabel>Confirm New Password</FormLabel>
                    <Input
                      placeholder="Confirm your new password"
                      type="password"
                      name="passwordConfirm"
                      disabled={authenticating}
                      onChange={(e) => {
                        setConfirmValue(e.target.value);
                      }}
                      value={confirmValue}
                      error={confirmValue !== value}
                      color={
                        confirmValue === value && value != ""
                          ? "success"
                          : "primary"
                      }
                    />
                  </FormControl>
                  <Button
                    type="submit"
                    variant="solid"
                    color="primary"
                    disabled={
                      authenticating ||
                      name.length === 0 ||
                      djName.length === 0 ||
                      value.length < minLength ||
                      confirmValue !== value ||
                      pWordStrength !== "Strong"
                    }
                    loading={authenticating}
                  >
                    Submit
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div>
                  <Typography level="h1" fontSize={"4.5rem"}>
                    Welcome
                  </Typography>
                  <Typography
                    level="h2"
                    fontSize={"4.5rem"}
                    suppressHydrationWarning
                  >
                    ...{welcomeQuotesAndArtists[randomIndexForWelcomeQuote][0]}
                  </Typography>
                  <Typography
                    level="body-md"
                    sx={{ my: 1, mb: 3, textAlign: "right" }}
                    suppressHydrationWarning
                  >
                    - {welcomeQuotesAndArtists[randomIndexForWelcomeQuote][1]}
                  </Typography>
                </div>
                <form onSubmit={handleLogin} autoComplete="off">
                  <FormControl required>
                    <FormLabel>Username</FormLabel>
                    <Input
                      placeholder="Enter your username"
                      type="text"
                      name="username"
                      disabled={authenticating}
                    />
                  </FormControl>
                  <FormControl required>
                    <FormLabel>Password</FormLabel>
                    <Input
                      placeholder="•••••••"
                      type="password"
                      name="password"
                      disabled={authenticating}
                    />
                  </FormControl>
                  <Button
                    type="submit"
                    fullWidth
                    disabled={authenticating}
                    loading={authenticating}
                  >
                    Sign in
                  </Button>
                </form>
              </>
            )}
          </Box>
          <Box component="footer" sx={{ py: 3 }}>
            <Typography level="body-sm" textAlign="center">
              © WXYC Chapel Hill {new Date().getFullYear()}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box
        sx={(theme) => ({
          height: "100%",
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          left: "clamp(0px, (100vw - var(--Collapsed-breakpoint)) * 999, 100vw - var(--Cover-width))",
          transition:
            "background-image var(--Transition-duration), left var(--Transition-duration) !important",
          transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
          backgroundColor: "background.level1",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundImage: `url("/img/wxyc_color.png")`,
          [theme.getColorSchemeSelector("dark")]: {
            backgroundImage: `url("/img/wxyc_dark.jpg")`,
          },
        })}
      />
    </Box>
  );
}
