import { Typography } from "@mui/joy";

export type ForgotQuote = [title: string, artist: string, fragment: string];

const forgottenQuotesAndArtists: ForgotQuote[] = [
  ["Forgotten", "Linkin Park", "your password?"],
  ["Don't You (Forget About Me)", "Simple Minds", "or your password, next time!"],
  ["Forgot About Dre", "Dr. Dre ft. Eminem", "and your password!"],
  ["The Forgotten", "Green Day", "password"],
  ["Forgotten Years", "Midnight Oil", "forgotten passwords..."],
  ["Forget Her", "Jeff Buckley", "and your password!"],
  ["Forget You", "CeeLo Green", "and your password!"],
  ["Forget About It", "Alison Krauss", "but don't forget your password!"],
];

// Pick in the nearest Server Component ancestor so the chosen quote is in the
// initial HTML and identical on hydration — #975.
export function pickForgotQuote(): ForgotQuote {
  return forgottenQuotesAndArtists[
    Math.floor(Math.random() * forgottenQuotesAndArtists.length)
  ];
}

export default function ForgotQuotes({ quote }: { quote: ForgotQuote }) {
  const [title, artist, fragment] = quote;

  return (
    <div>
      <Typography level="h2">{title}</Typography>
      <Typography level="body-md" sx={{ mb: 0.5, textAlign: "right" }}>
        ...{fragment}
      </Typography>
      <Typography
        level="body-sm"
        sx={{ my: 0, mb: 3, textAlign: "right", color: "text.secondary" }}
      >
        - {artist}
      </Typography>
    </div>
  );
}
