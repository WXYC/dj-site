"use client";

import {
  FlowsheetEntry,
  OnAirDJResponse,
} from "@/lib/features/flowsheet/types";
import { Headset } from "@mui/icons-material";
import { Card, CardContent, CardOverflow, Chip, Stack } from "@mui/joy";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import EntryText from "./EntryText";

export default function NowPlayingMini({
  entry,
  live,
  onAirDJs,
}: {
  entry?: FlowsheetEntry;
  live: boolean;
  onAirDJs?: OnAirDJResponse[];
}) {
  return (
    <Card
      orientation="horizontal"
      variant="outlined"
      sx={{
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <CardContent sx={{
        maxWidth: "calc(100px + 1.5rem)"
      }}>
        <AlbumArtAndIcons entry={entry} />
      </CardContent>
      <CardContent sx={{ justifyContent: "space-between", minWidth: 0, flex: 1, overflow: "hidden" }}>
        <EntryText entry={entry} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          {onAirDJs
            ?.map((dj) => ({ dj, name: dj.dj_name?.trim() ?? "" }))
            // An anonymous DJ resolves to no name at all, and a chip with
            // nothing in it reads as a rendering fault rather than as a DJ.
            // The trim matches the blank-name filter the on-air banner
            // applies, so both surfaces agree on who has a name; liveness is
            // carried by the LIVE badge, which counts the roster rather than
            // the chips.
            .filter(({ name }) => name.length > 0)
            .map(({ dj, name }, index) => (
              <Chip
                // Neither field alone can key this row: names are not unique,
                // and `id` is null for a show whose DJ has no account. The
                // `#` prefix keeps the positional fallback out of the id
                // space so the two can never coincide.
                key={dj.id ?? `#${index}`}
                variant="soft"
                startDecorator={<Headset />}
              >
                {name}
              </Chip>
            ))}
        </Stack>
      </CardContent>
      <CardOverflow
        variant="soft"
        color={live ? "primary" : "neutral"}
        sx={{
          px: 0.2,
          writingMode: "vertical-rl",
          justifyContent: "center",
          fontSize: "xs",
          fontWeight: "xl",
          letterSpacing: "1px",
          textTransform: "uppercase",
          borderLeft: "1px solid",
          borderColor: "divider",
        }}
      >
        {live ? "LIVE" : "OFF AIR"}
      </CardOverflow>
    </Card>
  );
}
