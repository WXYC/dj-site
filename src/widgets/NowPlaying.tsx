"use client";

import { PlayArrow, Stop } from "@mui/icons-material";
import { AspectRatio, Card, CardOverflow, IconButton } from "@mui/joy";
import { useRef, useState } from "react";

export type NowPlayingWidgetProps = {
  mini: boolean;
};

export default function NowPlaying({ mini = false }: NowPlayingWidgetProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [hovered, setHovered] = useState(false);

  const [imageUrl, setImageUrl] = useState(`/img/cassette.png`);

  const [playing, setPlaying] = useState(false);
  const [isSong, setIsSong] = useState(false);

  return (
    <>
      <audio id="now-playing-music" crossOrigin="anonymous" ref={audioRef} />
      {mini ? (
        <Card
          orientation="horizontal"
          variant="outlined"
          sx={{ width: "100%" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <CardOverflow>
            <AspectRatio ratio="1" sx={{ width: 90 }}>
              <img src={imageUrl} loading="lazy" alt={imageUrl} />
              <IconButton
                size="lg"
                variant="solid"
                color="primary"
                sx={{
                  position: "absolute",
                  zIndex: 2,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => {
                  setPlaying(!playing);
                }}
              >
                {playing ? <Stop /> : <PlayArrow />}\
              </IconButton>
            </AspectRatio>
          </CardOverflow>
        </Card>
      ) : (
        <Card
          variant="outlined"
          sx={{
            width: "100%",
            height: "100%",
            minWidth: "200px",
            minHeight: "225px",
            position: "relative",
          }}
        >
          <CardOverflow>
            <AspectRatio ratio="2">
              <img
                src={imageUrl}
                loading="lazy"
                alt={imageUrl}
                style={{
                  filter: isSong ? "blur(10px)" : "none",
                  zIndex: 0,
                }}
              />
            </AspectRatio>
          </CardOverflow>
        </Card>
      )}
    </>
  );
}
