"use client";

import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { Box, CircularProgress } from "@mui/joy";
import AspectRatio from "@mui/joy/AspectRatio";
import Card from "@mui/joy/Card";
import CardContent from "@mui/joy/CardContent";
import CardOverflow from "@mui/joy/CardOverflow";
import Divider from "@mui/joy/Divider";
import Typography from "@mui/joy/Typography";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import EntryText from "./EntryText";

export default function NowPlayingMain({
  width,
  height,
  entry,
  live,
  onAirDJ,
  loading,
}: {
  entry?: FlowsheetEntry;
  live: boolean;
  onAirDJ?: string;
  loading?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: width || "100%",
        height: height || "100%",
        minWidth: 0,
        maxWidth: "100%",
        minHeight: "150px",
      }}
    >
      <CardOverflow>
        <AspectRatio ratio="2.5" variant="plain">
          <Box
            sx={{
              background: "linear-gradient(135deg, #ff6ec4, #7873f5, #00f2fe)",
            }}
          />
        </AspectRatio>
        <Box
          sx={{
            position: "absolute",
            minWidth: "100px",
            right: "50%",
            bottom: "50%",
            transform: "translateX(50%) translateY(50%) scale(1.3)",
            display: "flex",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <AlbumArtAndIcons entry={entry} />
        </Box>
      </CardOverflow>
      <CardContent>
        <EntryText entry={entry} />
      </CardContent>
      <CardOverflow variant="soft" color={live ? "primary" : "neutral"}>
        <Divider inset="context" />
        <CardContent orientation="horizontal">
          <Typography level="body-xs">{live ? "LIVE" : "OFF AIR"}</Typography>
          {(live || loading) && (
            <>
              <Divider orientation="vertical" />
              {loading ? (
                <CircularProgress
                  size="sm"
                  variant="solid"
                  color="neutral"
                  sx={{ "--CircularProgress-size": "15px" }}
                />
              ) : (
                <Typography level="body-xs">{onAirDJ}</Typography>
              )}
            </>
          )}
        </CardContent>
      </CardOverflow>
    </Card>
  );
}
