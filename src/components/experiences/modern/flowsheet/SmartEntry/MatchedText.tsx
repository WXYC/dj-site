import { Box } from "@mui/joy";
import { Fragment } from "react";

/**
 * Inline highlight of the portion of `text` that matches the user's typed
 * `query` for that field: bold the predicted remainder on a prefix match, or
 * the typed substring on a contains match (the NN/g rule). No match → plain.
 */
export function MatchedText({
  text,
  query,
}: {
  text: string;
  query?: string;
}) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return <Fragment>{text}</Fragment>;

  const lower = text.toLowerCase();
  const strong = (s: string) => (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {s}
    </Box>
  );

  if (lower.startsWith(q)) {
    return (
      <Fragment>
        {text.slice(0, q.length)}
        {strong(text.slice(q.length))}
      </Fragment>
    );
  }
  const at = lower.indexOf(q);
  if (at === -1) return <Fragment>{text}</Fragment>;
  return (
    <Fragment>
      {text.slice(0, at)}
      {strong(text.slice(at, at + q.length))}
      {text.slice(at + q.length)}
    </Fragment>
  );
}
