"use client";
import React from "react";
import { Box, Typography } from "@mui/joy";

export default function WelcomeQuotes() {
  const welcomeQuotesAndArtists = [
    ["to the Jungle", "Guns N' Roses"],
    ["to the Hotel California", "Eagles"],
    ["to the Black Parade", "My Chemical Romance"],
    ["to the Pleasuredome", "Frankie Goes to Hollywood"],
    ["Home", "Coheed and Cambria"],
    ["to My Life", "Simple Plan"],
    ["to the Family", "Avenged Sevenfold"],
    ["to the Machine", "Pink Floyd"],
    ["to the Club", "Manian ft. Aila"],
  ];

  const randomIndexForWelcomeQuote = Math.floor(
    Math.random() * welcomeQuotesAndArtists.length
  );

  return (
    <div>
      <Typography level="h1" fontSize={"4.5rem"}>
        Welcome...
      </Typography>
      <Typography level="h1" fontSize={"4.5rem"} suppressHydrationWarning>
        {welcomeQuotesAndArtists[randomIndexForWelcomeQuote][0]}
      </Typography>
      <Typography
        level="body-md"
        sx={{ my: 1, mb: 3, textAlign: "right" }}
        suppressHydrationWarning
      >
        - {welcomeQuotesAndArtists[randomIndexForWelcomeQuote][1]}
      </Typography>
    </div>
  );
}
