import {
  FlowsheetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { Headphones, Logout, Mic, Timer } from "@mui/icons-material";
import { AspectRatio, Box } from "@mui/joy";

const DEFAULT_ARTWORK_URL = "/img/cassette.png";

export default function AlbumArtAndIcons({
  entry,
}: {
  entry: FlowsheetEntry | undefined;
}) {
  if (!entry) {
    return (
      <ImageWrapper>
        <img
          src={DEFAULT_ARTWORK_URL}
          srcSet={DEFAULT_ARTWORK_URL}
          loading="lazy"
          alt=""
          style={{ width: "100%", objectPosition: "center" }}
        />
      </ImageWrapper>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    const artworkUrl = entry.artwork_url ?? DEFAULT_ARTWORK_URL;
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
        src={DEFAULT_ARTWORK_URL}
        srcSet={DEFAULT_ARTWORK_URL}
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
