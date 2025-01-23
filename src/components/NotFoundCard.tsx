"use client";

import { Button, Card, CardContent, Divider, Typography } from "@mui/joy";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFoundCard() {
  const lostQuotes: {
    prefix: string | undefined;
    quote: string;
    author: string;
  }[] = [
    {
      prefix: "That page is a... ",
      quote: "Lost Cause",
      author: "Billie Eilish",
    },
    {
      prefix: "I guess you could say we're... ",
      quote: "Lost in the Citadel",
      author: "Lil Nas X",
    },
    {
      prefix: "You're... ",
      quote: "Lost",
      author: "Frank Ocean",
    },
    {
      prefix: "That page might've been...",
      quote: "Lost in Yesterday",
      author: "Tame Impala",
    },
    {
      prefix: undefined,
      quote: "You Lost Me",
      author: "Christina Aguilera",
    },
    {
      prefix: "That page might've been one of the...",
      quote: "Things We Lost in the Fire",
      author: "Bastille",
    },
    {
      prefix: "Is that page...",
      quote: "Lost on You",
      author: "LP",
    },
    {
      prefix: "We're...",
      quote: "Lost for Words",
      author: "Pink Floyd",
    },
  ];

  const [randomQuote, setRandomQuote] = useState(lostQuotes[0]);

  useEffect(() => {
    setRandomQuote(lostQuotes[Math.floor(Math.random() * lostQuotes.length)]);
  }, []);

  return (
    <Card
      className="ignoreClassic"
      sx={{
        width: "clamp(300px, 100%, 600px)",
        p: 2,
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "background.surface",
      }}
      variant="outlined"
      color="neutral"
    >
      <CardContent suppressHydrationWarning>
        <Typography level="body-md" suppressHydrationWarning>
          {randomQuote.prefix}
        </Typography>
        <Typography level="h1" fontSize={"4.5rem"} suppressHydrationWarning>
          {randomQuote.quote.substring(0, randomQuote.quote.indexOf("Lost"))}
          <Typography color="primary" suppressHydrationWarning>
            Lost
          </Typography>
          {randomQuote.quote.substring(randomQuote.quote.indexOf("Lost") + 4)}
        </Typography>
        <Typography
          level="body-md"
          sx={{ textAlign: "right" }}
          suppressHydrationWarning
        >
          - {randomQuote.author}
        </Typography>
      </CardContent>
      <Divider />
      <CardContent>
        <Typography level="body-md" sx={{ mb: 2 }}>
          We couldn't find the resource you were looking for.
        </Typography>
        <Link href={String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE)}>
          <Button variant="solid" color="primary" fullWidth>
            Back to Safety
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
