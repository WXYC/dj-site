import type { ReactNode } from "react";
import { List, ListItem, Typography } from "@mui/joy";
import HeadedSection from "./HeadedSection";

interface IntakeLaneProps<Row extends { id: number }> {
  /** The lane heading. It is also the section's accessible name, so both screens' tests (and any later count suffix) key off it. */
  title: string;
  /** The lane's rows, keyed by `id`. */
  rows: Row[];
  /** Shown instead of the list when there are no rows. */
  empty: string;
  /** Renders the whole list item's content: a `RecordRow`, so every lane draws a record the same way and no lane can put its buttons inline. */
  row: (row: Row) => ReactNode;
  /** Takes the heading off the screen while it still names the section, for a lane whose tab already says where you are. */
  hideTitle?: boolean;
  /** Lets the section take the focus from code, not from the Tab key, so the focus has somewhere named to go when the last row leaves. */
  focusable?: boolean;
}

/**
 * One titled lane of review intake: a heading over a list of rows, or an
 * empty line when there are none. Shared by the lanes of the Reviews page: the DJ's own lanes and the music directors' tab.
 */
export default function IntakeLane<Row extends { id: number }>({ title, rows, empty, hideTitle, focusable, row: renderRow }: IntakeLaneProps<Row>) {
  return (
    <HeadedSection title={title} titleLevel="title-lg" hideTitle={hideTitle} tabIndex={focusable ? -1 : undefined} sx={{ display: "block", ...(focusable && { outline: "none" }) }}>
      {rows.length === 0 ? (
        <Typography level="body-sm">{empty}</Typography>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>{renderRow(row)}</ListItem>
          ))}
        </List>
      )}
    </HeadedSection>
  );
}
