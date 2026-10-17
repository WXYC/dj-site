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
}

/**
 * One titled lane of review intake: a heading over a list of rows, or an
 * empty line when there are none. Shared by the lanes of the Reviews page: the DJ's own lanes and the music directors' tab.
 */
export default function IntakeLane<Row extends { id: number }>({ title, rows, empty, row: renderRow }: IntakeLaneProps<Row>) {
  return (
    <HeadedSection title={title} titleLevel="title-lg" sx={{ display: "block" }}>
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
