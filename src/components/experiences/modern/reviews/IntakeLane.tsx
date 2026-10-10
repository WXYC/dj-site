import type { ReactNode } from "react";
import { List, ListItem, Stack, Typography } from "@mui/joy";

interface IntakeLaneBaseProps<Row extends { id: number }> {
  /** The lane heading. It is also the section's accessible name, so both screens' tests (and any later count suffix) key off it. */
  title: string;
  /** The lane's rows, keyed by `id`. */
  rows: Row[];
  /** Shown instead of the list when there are no rows. */
  empty: string;
}

/** A lane draws each row as a `label` and its optional `extra`, or as a whole `row` (a `RecordRow`); the compiler requires one of the two. */
type IntakeLaneProps<Row extends { id: number }> = IntakeLaneBaseProps<Row> &
  (
    | {
        /** Returns the whole label node; the lane adds no wrapper, so each screen keeps its own markup. */
        label: (row: Row) => ReactNode;
        /** Rendered after the label, in the same wrapping row. Omitted by lanes that have none (the Filed lane). */
        extra?: (row: Row) => ReactNode;
        row?: never;
      }
    | {
        /** Renders the whole list item's content (a `RecordRow`) in place of `label` + `extra`. */
        row: (row: Row) => ReactNode;
        label?: never;
        extra?: never;
      }
  );

/**
 * One titled lane of review intake: a heading over a list of rows, or an
 * empty line when there are none. Each row is its `label` followed by its
 * optional `extra`, or whatever its `row` renders. Shared by the lanes of the Reviews page: the DJ's own lanes and the music directors' tab.
 */
export default function IntakeLane<Row extends { id: number }>({ title, rows, empty, label, extra, row: renderRow }: IntakeLaneProps<Row>) {
  return (
    <section aria-label={title}>
      <Typography level="title-lg">{title}</Typography>
      {rows.length === 0 ? (
        <Typography level="body-sm">{empty}</Typography>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>
              {renderRow ? (
                renderRow(row)
              ) : (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {label?.(row)}
                  {extra?.(row)}
                </Stack>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </section>
  );
}
