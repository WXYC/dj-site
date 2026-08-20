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
// initial HTML and identical on hydration.
export function pickWelcomeQuote(): WelcomeQuote {
  return greetingsAndArtists[
    Math.floor(Math.random() * greetingsAndArtists.length)
  ];
}

// Only the greeting is rendered; each quote's fragment and artist are deliberately
// retained in the table above so the full couplet can be restored without re-sourcing it.
export default function WelcomeQuotes({ quote }: { quote: WelcomeQuote }) {
  const [greeting] = quote;

  return (
    <div>
      <Typography level="h1" sx={{ mb: 3 }}>
        {greeting}
      </Typography>
    </div>
  );
}
