"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";

import { ArtistAvatar } from "@/src/components/experiences/modern/catalog/ArtistAvatar";
import {
  AspectRatio,
  Box,
  Button,
  Card,
  CardContent,
  CardOverflow,
  Divider,
  ModalClose,
  Stack,
  Typography,
} from "@mui/joy";
import { useEffect, useState } from "react";

export default function AlbumCard({ album }: { album: AlbumEntry }) {
  const [image, setImage] = useState("");

  return (
    <Card
      variant="outlined"
      sx={{
        width: "50%",
        height: 500,
      }}
    >
      <CardOverflow>
        <AspectRatio ratio="4">
          <img src={image.length > 0 ? image : "/img/wxyc_dark.jpg"} />
        </AspectRatio>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderTopRightRadius: "var(--CardOverflow-radius)",
            borderTopLeftRadius: "var(--CardOverflow-radius)",
            backdropFilter: "blur(0.2rem)",
            pointerEvents: "none",
          }}
        ></Box>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderTopRightRadius: "var(--CardOverflow-radius)",
            borderTopLeftRadius: "var(--CardOverflow-radius)",
            bgcolor: "rgba(0,0,0,0.5)",
          }}
        ></Box>
        <Box
          sx={{
            position: "absolute",
            bottom: 3,
            left: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
          }}
        >
          <Box
            sx={{
              ml: 5,
              width: 70,
              "& > *": {
                transform: "scale(1.8) translateY(13px)",
              },
            }}
          >
            <ArtistAvatar
              artist={album.artist}
              format={album.format}
              entry={album.entry}
              rotation={album.play_freq}
            />
          </Box>
          <Typography
            level="h3"
            sx={{
              overflow: "hidden",
              lineHeight: "1.5em",
              height: "3em",
              pl: 3.2,
              mb: -8.5,
              textOverflow: "ellipsis",
              maxWidth: "calc(100% - 40px)",
            }}
          >
            {album.title}
          </Typography>
        </Box>
        <ModalClose variant="solid" />;
      </CardOverflow>
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            ml: 15,
            mb: 1,
          }}
        >
          <Typography level="body-lg">
            {album.artist.name} &nbsp;&nbsp; • &nbsp;&nbsp; {album.artist.genre}{" "}
            {album.artist.lettercode} {album.artist.numbercode}/{album.entry}{" "}
            &nbsp;&nbsp; • &nbsp;&nbsp; {album?.format ?? ""}
          </Typography>
        </Stack>
        No Reviews Yet!
      </CardContent>
      <CardOverflow
        variant="soft"
        sx={{
          display: "flex",
          gap: 1.5,
          py: 1.5,
          px: "var(--Card-padding)",
          bgcolor: "background.level1",
        }}
      >
        <Stack direction="row" spacing={1}>
        <Typography
          level="body-sm"
          sx={{ fontWeight: "md", color: "text.secondary" }}
        >
          {album.plays ?? 0} plays
        </Typography>
        <Divider orientation="vertical" />
        <Typography
          level="body-sm"
          sx={{ fontWeight: "md", color: "text.secondary" }}
        >
          Added {!album.add_date ? "Unknown Time" : new Date(album.add_date).toLocaleDateString()}
        </Typography>
        </Stack>
      </CardOverflow>
    </Card>
  );
}
