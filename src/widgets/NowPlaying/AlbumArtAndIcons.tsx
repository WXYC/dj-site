import {
  FlowsheetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { useAlbumArtwork } from "@/lib/features/metadata/hooks";
import { Headphones, Logout, Mic, Timer } from "@mui/icons-material";
import { AspectRatio, Box } from "@mui/joy";

export default function AlbumArtAndIcons({
  entry,
}: {
  entry: FlowsheetEntry | undefined;
}) {
  const songEntry = entry && isFlowsheetSongEntry(entry) ? entry : undefined;
  const { artworkUrl, isLoading } = useAlbumArtwork(songEntry?.artist_name, songEntry?.album_title);

  if (!entry || isLoading) {
    return (
      <ImageWrapper>
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
        <img
          src={artworkUrl}
          srcSet={artworkUrl}
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
