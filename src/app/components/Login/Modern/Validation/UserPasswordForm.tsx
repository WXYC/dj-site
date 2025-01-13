"use client";
import { handleSignIn } from "@/lib/cognitoActions";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { authenticationSlice } from "@/lib/slices";
import { getIsPending } from "@/lib/slices/authentication/selectors";
import Typography from "@mui/joy/Typography";
import React, { useEffect } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import PasswordBox from "./PasswordBox";
import RequiredBox from "./RequiredBox";
import { ValidatedSubmitButton } from "./ValidatedSubmitButton";

export default function UserPasswordForm(): JSX.Element {
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

  const randomIndexForWelcomeQuote = Math.floor(
    Math.random() * welcomeQuotesAndArtists.length
  );
  const dispatch = useAppDispatch();
  const [response, dispatchSignIn] = useFormState(handleSignIn, undefined);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    dispatch(authenticationSlice.actions.setPending(true));

    const data = new FormData(e.currentTarget);

    dispatchSignIn(data);
  };

  useEffect(() => {
    dispatch(authenticationSlice.actions.setResponse(response));

    if (!(response?.passwordChallenge) && response?.user) {
      dispatch(authenticationSlice.actions.setPending(false));
      toast.error(response.user);
    }
    if (response && response.passwordChallenge) {
      dispatch(authenticationSlice.actions.setPending(false));
    }
  }, [response]);

  const authenticating = useAppSelector(getIsPending);

  return (
    <>
      <div>
        <Typography level="h1" fontSize={"4.5rem"}>
          Welcome
        </Typography>
        <Typography level="h2" fontSize={"4.5rem"} suppressHydrationWarning>
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
        <RequiredBox
          title="Username"
          type="text"
          name="username"
          disabled={authenticating}
        />
        <PasswordBox disabled={authenticating} />
        <ValidatedSubmitButton fullWidth />
      </form>
    </>
  );
}
