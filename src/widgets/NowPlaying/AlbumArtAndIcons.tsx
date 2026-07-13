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
import { ENTRY_TONES } from "@/lib/features/experiences/modern/tokens/roles";

const DEFAULT_ARTWORK_URL = "/img/cassette.png";

// These are @mui/icons-material (Material) icons, whose `color` prop is the
// Material palette — not Joy. Drive them from the shared ENTRY_TONES via the
// Joy palette CSS var so they stay consistent with the flowsheet entry rows
// and retheme with the color system.
const entryIconSx = (role: keyof typeof ENTRY_TONES) => ({
  color: `var(--wxyc-palette-${ENTRY_TONES[role].color}-solidBg)`,
});

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
        <Timer fontSize="large" sx={entryIconSx("breakpoint")} />
      </BoxWrapper>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <BoxWrapper>
        <Headphones fontSize="large" sx={entryIconSx("startShow")} />
      </BoxWrapper>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <BoxWrapper>
        <Logout fontSize="large" sx={entryIconSx("endShow")} />
      </BoxWrapper>
    );
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <BoxWrapper>
        <Mic fontSize="large" sx={{ ...entryIconSx("talkset"), scale: "200%" }} />
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
