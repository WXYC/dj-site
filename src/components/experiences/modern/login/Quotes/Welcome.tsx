import { Typography } from "@mui/joy";

export type WelcomeQuote = [greeting: string, fragment: string, artist: string];

const greetingsAndArtists: WelcomeQuote[] = [
  ["Welcome...", "to the Jungle", "Guns N' Roses"],
  ["Welcome...", "to the Hotel California", "Eagles"],
  ["Welcome...", "to the Black Parade", "My Chemical Romance"],
  ["Welcome...", "to the Pleasuredome", "Frankie Goes to Hollywood"],
  ["Welcome...", "Home", "Coheed and Cambria"],
  ["Welcome...", "to My Life", "Simple Plan"],
  ["Welcome...", "to the Family", "Avenged Sevenfold"],
  ["Welcome...", "to the Machine", "Pink Floyd"],
  ["Welcome...", "to the Club", "Manian ft. Aila"],
  ["Welcome...", "to Wonderland", "Little Simz"],
  ["Welcome...", "to Love", "Pharoah Sanders"],
  ["Welcome...", "to the Magnetic Fields", "The Magnetic Fields"],
  ["Welcome...", "Home", "Dolly Parton"],
  ["Welcome...", "to the Monkey House", "The Dandy Warhols"],
  ["Welcome...", "", "Harmonia & Brian Eno"],
  ["Welcome...", "to the Terrordome", "Public Enemy"],
  ["Welcome...", "to Four Tet", "Four Tet"],
  ["Welcome...", "Back", "Theo Parrish"],
  ["Hello...", "", "Erykah Badu ft. André 3000"],
  ["Come On...", "Let's Go", "Broadcast"],
];

// Pick in the nearest Server Component ancestor so the chosen quote is in the
// initial HTML and identical on hydration — #975.
export function pickWelcomeQuote(): WelcomeQuote {
  return greetingsAndArtists[
    Math.floor(Math.random() * greetingsAndArtists.length)
  ];
}

export default function WelcomeQuotes({ quote }: { quote: WelcomeQuote }) {
  const [greeting, fragment, artist] = quote;

  return (
    <div>
      <Typography level="h1">{greeting}</Typography>
      <Typography level="h1">{fragment}</Typography>
      <Typography level="body-md" sx={{ my: 1, mb: 3, textAlign: "right" }}>
        - {artist}
      </Typography>
    </div>
  );
}
