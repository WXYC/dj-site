import { Fragment, useId } from "react";
import { Box, Link } from "@mui/joy";
import type { ListenLink } from "@/lib/features/reviews/listenLinks";
import { REVIEW_COPY } from "./copy";

interface ListenLinksProps {
  links?: ListenLink[];
  /** The ids of the elements that name the record (space-separated, as `aria-labelledby` takes them), so a list of rows doesn't read as many links with the same name. */
  labelledBy?: string;
}

/**
 * The lead-in and the links to hear a record before reviewing it, each in a new tab; nothing at all when there are none.
 * Each link is named by its service, the record, then the new-tab hint, which is drawn hidden and read only through those names.
 */
export default function ListenLinks({ links, labelledBy }: ListenLinksProps) {
  const id = useId();
  if (!links?.length) {
    return null;
  }
  const hintId = `${id}hint`;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1, alignItems: "baseline" }}>
      <Box component="span" sx={{ typography: "body-sm" }}>{REVIEW_COPY.listen.leadIn}</Box>
      <span id={hintId} hidden>{REVIEW_COPY.listen.newTab}</span>
      {links.map((link, i) => {
        const linkId = `${id}link${i}`;
        return (
          <Fragment key={link.label}>
            {i > 0 && <Box component="span" aria-hidden="true" sx={{ typography: "body-sm" }}>·</Box>}
            <Link
              id={linkId}
              aria-labelledby={[linkId, labelledBy, hintId].filter(Boolean).join(" ")}
              level="body-sm"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </Link>
          </Fragment>
        );
      })}
    </Box>
  );
}
