// Keep in sync with apps/backend/services/requestLine/matching/compilation.ts.
const COMPILATION_KEYWORDS = [
  "various",
  "soundtrack",
  "compilation",
  "v/a",
  "v.a.",
];

export function isCompilationArtistName(
  artist: string | null | undefined
): boolean {
  if (!artist) return false;
  const lower = artist.toLowerCase();
  for (const keyword of COMPILATION_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  return false;
}
