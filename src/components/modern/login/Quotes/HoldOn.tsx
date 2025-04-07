"use client";
import { Typography } from "@mui/joy";

export default function HoldOnQuotes() {
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

  const randomIndexForHoldOnQuote = Math.floor(
    Math.random() * holdOnQuotesAndArtists.length
  );

  return (
    <div>
      <Typography level="h4">Hold On...</Typography>
      <Typography level="h3" suppressHydrationWarning>
        {holdOnQuotesAndArtists[randomIndexForHoldOnQuote][0]}
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
  );
}
