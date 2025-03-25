"use client";
import React from "react";
import { Box, Typography } from "@mui/joy";

export default function ForgotQuotes() {
  const forgottenQuotesAndArtists = [
    ["Forgotten", "Linkin Park", "your password?"],
    ["Don't You (Forget About Me)", "Simple Minds", "or your password, next time!"],
    ["Forgot About Dre", "Dr. Dre ft. Eminem", "and your password!"],
    ["The Forgotten", "Green Day", "password"],
    ["Forgotten Years", "Midnight Oil", "forgotten passwords..."],
    ["Forget Her", "Jeff Buckley", "and your password!"],
    ["Forget You", "CeeLo Green", "and your password!"],
    ["Forget About It", "Alison Krauss", "but don't forget your password!"]
  ];

  const randomIndexForWelcomeQuote = Math.floor(
    Math.random() * forgottenQuotesAndArtists.length
  );

  return (
    <div>
      <Typography level="h2" suppressHydrationWarning>
        {forgottenQuotesAndArtists[randomIndexForWelcomeQuote][0]}
      </Typography>
      <Typography
        level="body-md"
        sx={{ mb: 0.5, textAlign: "right" }}
        suppressHydrationWarning
      >
        ...{forgottenQuotesAndArtists[randomIndexForWelcomeQuote][2]}
      </Typography>
      <Typography
        level="body-sm"
        sx={{ my: 0, mb: 3, textAlign: "right", color: "text.secondary" }}
        suppressHydrationWarning
      >
        - {forgottenQuotesAndArtists[randomIndexForWelcomeQuote][1]}
      </Typography>
    </div>
  );
}
