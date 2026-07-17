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
import Image from "next/image";
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
    return <DefaultArtwork />;
  }

  if (isFlowsheetSongEntry(entry)) {
    // entry.artwork_url, when present, is resolved from a third-party host at
    // runtime (see the img-src CSP comment in next.config.mjs) — next/image
    // needs a build-time-known remote pattern, so only the local
    // DEFAULT_ARTWORK_URL fallback below converts; a live artwork_url keeps
    // the plain <img>.
    if (entry.artwork_url) {
      return (
        <ImageWrapper>
          <img
            src={entry.artwork_url}
            srcSet={entry.artwork_url}
            loading="lazy"
            alt=""
            style={{ width: "100%", objectPosition: "center" }}
          />
        </ImageWrapper>
      );
    }
    return <DefaultArtwork />;
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

  return <DefaultArtwork />;
}

// AspectRatio clones its first child with `data-first-child`, which its own
// styles target for the fill/cover sizing (see @mui/joy AspectRatio.js) —
// `Image fill` becomes that first child directly, no extra wrapper needed.
// unoptimized: see next.config.mjs images.unoptimized comment; `sizes` is
// moot alongside it (the optimizer's width negotiation never runs).
const DefaultArtwork = () => (
  <ImageWrapper>
    <Image src={DEFAULT_ARTWORK_URL} alt="" fill unoptimized />
  </ImageWrapper>
);

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
