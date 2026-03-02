import {
  FlowsheetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { useAlbumImages } from "@/src/hooks/applicationHooks";
import { Headphones, Logout, Mic, Timer } from "@mui/icons-material";
import { AspectRatio, Box } from "@mui/joy";
import { useEffect } from "react";

export default function AlbumArtAndIcons({
  entry,
}: {
  entry: FlowsheetEntry | undefined;
}) {
  const { setAlbum, setArtist, loading, url } = useAlbumImages();

  useEffect(() => {
    if (entry) {
      if (isFlowsheetSongEntry(entry)) {
        setAlbum(entry.album_title);
        setArtist(entry.artist_name);
      } else {
        setAlbum(undefined);
        setArtist(undefined);
      }
    }
  }, [entry, setAlbum, setArtist]);

  if (!entry || loading) {
    return (
      <ImageWrapper>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/cassette.png"
          srcSet="/img/cassette.png"
          loading="lazy"
          alt=""
          style={{ width: "100%", objectPosition: "center" }}
        />
      </ImageWrapper>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    return (
      <ImageWrapper>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          srcSet={url}
          loading="lazy"
          alt=""
          style={{ width: "100%", objectPosition: "center" }}
        />
      </ImageWrapper>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <BoxWrapper>
        <Timer fontSize="large" color="warning" />
      </BoxWrapper>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <BoxWrapper>
        <Headphones fontSize="large" color="success" />
      </BoxWrapper>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <BoxWrapper>
        <Logout fontSize="large" color="warning" />
      </BoxWrapper>
    );
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <BoxWrapper>
        <Mic fontSize="large" color="secondary" sx={{ scale: "200%" }} />
      </BoxWrapper>
    );
  }

  return (
    <ImageWrapper>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/img/cassette.png"
        srcSet="/img/cassette.png"
        loading="lazy"
        alt=""
      />
    </ImageWrapper>
  );
}

const BoxWrapper = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return (
    <Box
      sx={{
        width: "100px",
        height: "100px",
        borderRadius: "md",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.body",
        boxShadow: "lg",
      }}
    >
      {children}
    </Box>
  );
};

const ImageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <AspectRatio
      ratio="1"
      sx={{
        borderRadius: "md",
        boxShadow: "lg",
        width: "100px"
      }}
    >
      {children}
    </AspectRatio>
  );
};
