import type { ReactNode } from "react";
import { List, ListItem, Stack, Typography } from "@mui/joy";

interface IntakeLaneProps<Row extends { id: number }> {
  title: string;
  rows: Row[];
  empty: string;
  /** Returns the whole label node; the lane adds no wrapper, so each screen keeps its own markup. */
  label: (row: Row) => ReactNode;
  extra?: (row: Row) => ReactNode;
}

export default function IntakeLane<Row extends { id: number }>({ title, rows, empty, label, extra }: IntakeLaneProps<Row>) {
  return (
    <section aria-label={title}>
      <Typography level="title-lg">{title}</Typography>
      {rows.length === 0 ? (
        <Typography level="body-sm">{empty}</Typography>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {label(row)}
                {extra?.(row)}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </section>
  );
}
