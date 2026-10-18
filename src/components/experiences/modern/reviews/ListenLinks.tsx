import { Box, Link } from "@mui/joy";
import type { ListenLink } from "@/lib/features/reviews/listenLinks";
import { REVIEW_COPY } from "./copy";

/** The lead-in and the links to hear a record before reviewing it, each in a new tab; nothing at all when there are none. */
export default function ListenLinks({ links }: { links?: ListenLink[] }) {
  if (!links?.length) {
    return null;
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1, alignItems: "baseline" }}>
      <Box component="span" sx={{ typography: "body-sm" }}>{REVIEW_COPY.listen.leadIn}</Box>
      {links.map((link) => (
        <Link key={link.label} level="body-sm" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</Link>
      ))}
    </Box>
  );
}
