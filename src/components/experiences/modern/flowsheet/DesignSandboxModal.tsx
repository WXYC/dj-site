"use client";

import { Mic, PlayArrow, QueueMusic, Timer } from "@mui/icons-material";
import Close from "@mui/icons-material/Close";
import {
  Box,
  Card,
  CardContent,
  Chip,
  ColorPaletteProp,
  Divider,
  IconButton,
  Modal,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import type { ReactNode } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { CatalogFilterSection } from "../catalog/Search/CatalogFilterSection";
import {
  catalogFilterTagFontSx,
  getGenreFilterChipProps,
  getTagFilterChipProps,
} from "../catalog/Search/catalogFilterChipStyles";
import { getCatalogTagLabel } from "../catalog/Search/catalogTagFilters";
import { filterControlFontSx } from "../catalog/Search/catalogFilterStyles";

const SANDBOX_TYPED_ENTRY = {
  artist: "Shape Fixture Artist Alpha",
  song: "Track 1",
  album: "Shape Fixture Album Alpha 2",
  label: "",
} as const;

const SANDBOX_NEARBY_ROTATION: AlbumEntry[] = [
  {
    id: 4201,
    title: "Shape Fixture Album Alpha 2",
    entry: 2,
    format: "Vinyl",
    label: "Fixture Records",
    alternate_artist: undefined,
    rotation_bin: "H",
    rotation_id: 12,
    plays: 3,
    add_date: "2024-01-15",
    on_streaming: false,
    artist: {
      id: 101,
      name: "Shape Fixture Artist Alpha",
      lettercode: "SF",
      numbercode: 101,
      genre: "Rock",
    },
  },
];

const SANDBOX_NEARBY_CATALOG: AlbumEntry[] = [
  {
    id: 4202,
    title: "Shape Fixture Album Beta",
    entry: 1,
    format: "CD",
    label: "Fixture Records",
    alternate_artist: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: 0,
    add_date: "2023-11-02",
    artist: {
      id: 101,
      name: "Shape Fixture Artist Alpha",
      lettercode: "SF",
      numbercode: 101,
      genre: "Rock",
    },
  },
  {
    id: 4203,
    title: "Alpha Variations",
    entry: 4,
    format: "CD",
    label: "Indie Fixture Co.",
    alternate_artist: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: 1,
    add_date: "2022-06-20",
    artist: {
      id: 102,
      name: "Shape Fixture Artist Alph",
      lettercode: "SF",
      numbercode: 118,
      genre: "Electronic",
    },
  },
  {
    id: 4204,
    title: "Fixture Sessions Vol. 1",
    entry: 3,
    format: "Vinyl",
    label: "Fixture Records",
    alternate_artist: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: 2,
    add_date: "2021-09-14",
    on_streaming: false,
    artist: {
      id: 101,
      name: "Shape Fixture Artist Alpha",
      lettercode: "SF",
      numbercode: 101,
      genre: "Rock",
    },
  },
  {
    id: 4205,
    title: "Gamma Echoes",
    entry: 7,
    format: "CD",
    label: "North Fixture Press",
    alternate_artist: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: 0,
    add_date: "2020-03-08",
    artist: {
      id: 103,
      name: "Shape Fixture Artist Gamma",
      lettercode: "SF",
      numbercode: 142,
      genre: "Jazz",
    },
  },
];

function SandboxAlbumArt({
  selected = false,
  label = "SF",
}: {
  selected?: boolean;
  label?: string;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 42,
        height: 42,
        flex: "0 0 auto",
        borderRadius: "md",
        overflow: "hidden",
        position: "relative",
        border: "1px solid",
        borderColor: selected
          ? "rgba(255,255,255,0.42)"
          : "neutral.outlinedBorder",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 42%, rgba(191,57,103,0.38))",
        boxShadow: selected
          ? "0 8px 20px rgba(0,0,0,0.24)"
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 6,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.22)",
        }}
      />

      <Typography
        level="body-xs"
        sx={{
          position: "absolute",
          left: 7,
          bottom: 5,
          fontSize: "0.65rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: selected ? "white" : "text.secondary",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function SandboxMetaChip({
  children,
  color = "neutral",
}: {
  children: ReactNode;
  color?: ColorPaletteProp;
}) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={color}
      sx={{
        "--Chip-minHeight": "0.95rem",
        minHeight: "0.95rem",
        borderRadius: "xs",
        fontSize: "0.54rem",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "0.015em",
        px: 0.125,

        "& .MuiChip-label": {
          px: 0.375,
        },
      }}
    >
      {children}
    </Chip>
  );
}

function SandboxMatchedText({
  children,
  selected = false,
  color = "primary",
}: {
  children: ReactNode;
  selected?: boolean;
  color?: "primary" | "info" | "success";
}) {
  return (
    <Box
      component="span"
      sx={{
        px: "2px",
        py: "1px",
        mx: "-1px",
        borderRadius: "4px",
        fontWeight: 800,
        color: selected ? "white" : `${color}.softColor`,
        bgcolor: selected
          ? "rgba(255,255,255,0.12)"
          : `var(--joy-palette-${color}-softBg)`,
        boxShadow: selected
          ? "inset 0 -1px 0 rgba(255,255,255,0.24)"
          : `inset 0 -1px 0 var(--joy-palette-${color}-outlinedBorder)`,
      }}
    >
      {children}
    </Box>
  );
}

function SandboxResultStatement({
  selected = false,
  albumFirst = false,
  title,
  artist,
  album,
  label,
}: {
  selected?: boolean;
  albumFirst?: boolean;
  title?: string;
  artist: string;
  album: string;
  label?: string;
}) {
  if (albumFirst) {
    return (
      <Typography
        component="div"
        level="body-sm"
        sx={{
          color: selected ? "white" : "text.primary",
          lineHeight: 1.35,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <SandboxMatchedText selected={selected} color="info">
          Shape Fixture Album Al
        </SandboxMatchedText>
        pha 2{" "}
        <Box component="span" sx={{ color: selected ? "neutral.200" : "text.tertiary" }}>
          by
        </Box>{" "}
        <SandboxMatchedText selected={selected}>{artist}</SandboxMatchedText>
        {title ? (
          <>
            {" "}
            <Box
              component="span"
              sx={{ color: selected ? "neutral.200" : "text.tertiary" }}
            >
              off
            </Box>{" "}
            <SandboxMatchedText selected={selected} color="success">
              {title}
            </SandboxMatchedText>
          </>
        ) : null}
        {label ? (
          <>
            {" "}
            <Box
              component="span"
              sx={{ color: selected ? "neutral.200" : "text.tertiary" }}
            >
              via
            </Box>{" "}
            {label}
          </>
        ) : null}
      </Typography>
    );
  }

  return (
    <Typography
      component="div"
      level="body-sm"
      sx={{
        color: selected ? "white" : "text.primary",
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {title ? (
        <>
          <SandboxMatchedText selected={selected} color="success">
            {title}
          </SandboxMatchedText>{" "}
        </>
      ) : null}
      <Box component="span" sx={{ color: selected ? "neutral.200" : "text.tertiary" }}>
        by
      </Box>{" "}
      <SandboxMatchedText selected={selected}>{artist}</SandboxMatchedText>{" "}
      <Box component="span" sx={{ color: selected ? "neutral.200" : "text.tertiary" }}>
        on
      </Box>{" "}
      <SandboxMatchedText selected={selected} color="info">
        Shape Fixture Album Al
      </SandboxMatchedText>
      pha 2
      {label ? (
        <>
          {" "}
          <Box
            component="span"
            sx={{ color: selected ? "neutral.200" : "text.tertiary" }}
          >
            via
          </Box>{" "}
          {label}
        </>
      ) : null}
    </Typography>
  );
}

function SandboxResultMetaRow({
  leading,
  selected = false,
  children,
}: {
  leading?: ReactNode;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{
        mb: 0.35,
        minWidth: 0,
        width: "100%",
      }}
    >
      {leading ? (
        <Typography
          component="div"
          level="body-xs"
          sx={{
            flex: 1,
            minWidth: 0,
            color: selected ? "neutral.200" : "text.tertiary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {leading}
        </Typography>
      ) : (
        <Box sx={{ flex: 1, minWidth: 0 }} />
      )}

      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ flexShrink: 0, ml: "auto" }}
      >
        {children}
      </Stack>
    </Stack>
  );
}

function SandboxResultRow({
  entry,
  selected = false,
  albumFirst = false,
}: {
  entry: AlbumEntry;
  selected?: boolean;
  albumFirst?: boolean;
}) {
  const artist = entry.artist?.name || "Unknown artist";
  const album = entry.title || "Unknown album";
  const isVinyl = entry.format.toLowerCase().includes("vinyl");
  const code = `${entry.artist?.genre ?? "Unknown"} ${entry.artist?.lettercode ?? "?"} ${
    entry.artist?.numbercode ?? "?"
  }/${entry.entry}`;

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      aria-selected={selected}
      sx={{
        px: 0.9,
        py: selected ? 0.875 : 0.75,
        minWidth: 0,
        bgcolor: selected ? "primary.700" : "transparent",
        borderRadius: selected ? "sm" : 0,
        cursor: "default",
      }}
    >
      <SandboxAlbumArt selected={selected} />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <SandboxResultMetaRow
          selected={selected}
          leading={<Box component="span" sx={{ fontFamily: "monospace" }}>{code}</Box>}
        >
          {entry.rotation_bin ? (
            <SandboxMetaChip color="primary">Rotation {entry.rotation_bin}</SandboxMetaChip>
          ) : (
            <SandboxMetaChip color="neutral">Catalog</SandboxMetaChip>
          )}

          <SandboxMetaChip color={isVinyl ? "primary" : "neutral"}>
            {isVinyl ? "vinyl" : "cd"}
          </SandboxMetaChip>

          {entry.on_streaming === false ? (
            <SandboxMetaChip color="danger">exclusive</SandboxMetaChip>
          ) : null}
        </SandboxResultMetaRow>

        <SandboxResultStatement
          selected={selected}
          albumFirst={albumFirst}
          title="Track 1"
          artist={artist}
          album={album}
          label={entry.label || undefined}
        />
      </Box>
    </Stack>
  );
}

function SandboxNearbyResultGroup({
  label,
  results,
}: {
  label: string;
  results: AlbumEntry[];
}) {
  if (results.length === 0) return null;

  return (
    <Box>
      <Typography
        level="body-xs"
        sx={{
          color: "text.tertiary",
          px: 0.9,
          pt: 0.85,
          pb: 0.35,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontSize: "0.65rem",
        }}
      >
        {label}
      </Typography>

      <Stack direction="column" spacing={0}>
        {results.map((entry) => (
          <SandboxResultRow key={entry.id} entry={entry} />
        ))}
      </Stack>
    </Box>
  );
}

/** Static nearby-match list styled like the flowsheet results listbox. */
function SandboxNearbyResults() {
  const topMatch = SANDBOX_NEARBY_ROTATION[0];

  return (
    <Sheet
      variant="plain"
      data-testid="design-sandbox-nearby-results"
      sx={{
        width: "100%",
        minWidth: 0,
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: 400,
        bgcolor: "transparent",
      }}
    >
      <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0, px: 1, pb: 1 }}>
        <Typography
          level="body-xs"
          sx={{
            color: "text.tertiary",
            px: 0.25,
            pt: 1,
            pb: 0.5,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontSize: "0.65rem",
          }}
        >
          Selected match
        </Typography>

        <SandboxResultRow entry={topMatch} selected albumFirst />

        <Divider sx={{ my: 0.75 }} />
        <SandboxNearbyResultGroup label="Card catalog" results={SANDBOX_NEARBY_CATALOG} />
      </Box>
    </Sheet>
  );
}

function SandboxFilterChip({
  label,
  chipProps,
}: {
  label: string;
  chipProps: ReturnType<typeof getGenreFilterChipProps>;
}) {
  return (
    <Chip
      size="sm"
      variant={chipProps.variant ?? "soft"}
      {...(chipProps.color ? { color: chipProps.color } : {})}
      endDecorator={<Close sx={{ fontSize: "0.875rem" }} />}
      sx={{
        minWidth: 0,
        ...catalogFilterTagFontSx,
        ...chipProps.sx,
      }}
    >
      {label}
    </Chip>
  );
}

function SandboxFilterPlaceholder({ label }: { label: string }) {
  return (
    <Typography
      level="body-xs"
      sx={{
        ...filterControlFontSx,
        color: "text.tertiary",
        textAlign: "center",
        width: "100%",
      }}
    >
      {label}
    </Typography>
  );
}

/** Static flowsheet action buttons for the sandbox mockup. */
function SandboxButtons() {
  return (
    <Stack direction="row" spacing={0.5} data-testid="design-sandbox-buttons">
      <IconButton
        size="sm"
        variant="solid"
        color="warning"
        aria-label="Breakpoint"
        tabIndex={-1}
      >
        <Timer />
      </IconButton>

      <IconButton
        size="sm"
        variant="solid"
        color="danger"
        aria-label="Talkset"
        tabIndex={-1}
      >
        <Mic />
      </IconButton>
    </Stack>
  );
}

function SandboxCommitButtons() {
  return (
    <Stack direction="row" spacing={0.75} data-testid="design-sandbox-commit-buttons">
      <IconButton variant="soft" color="success" size="sm" aria-label="Add to queue">
        <QueueMusic />
      </IconButton>

      <IconButton variant="solid" color="primary" size="sm" aria-label="Play now">
        <PlayArrow />
      </IconButton>
    </Stack>
  );
}

/** Static catalog-style filter gutter for the sandbox mockup. */
function SandboxFilters() {
  return (
    <Box
      data-testid="design-sandbox-filters"
      sx={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
      }}
    >
      <CatalogFilterSection>
        <SandboxFilterChip label="Rock" chipProps={getGenreFilterChipProps("Rock")} />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <SandboxFilterPlaceholder label="All formats..." />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <SandboxFilterChip
          label={getCatalogTagLabel("H")}
          chipProps={getTagFilterChipProps("H")}
        />
      </CatalogFilterSection>
    </Box>
  );
}

function SandboxSmartToken({
  color = "primary",
  children,
}: {
  color?: "primary" | "info" | "success";
  children: ReactNode;
}) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline",
        px: "4px",
        py: "1px",
        mx: "-1px",
        borderRadius: "5px",
        color: `${color}.softColor`,
        bgcolor: `${color}.softBg`,
        boxShadow: `inset 0 -1px 0 var(--joy-palette-${color}-outlinedBorder)`,
        whiteSpace: "pre-wrap",
        fontWeight: 700,
      }}
    >
      {children}
    </Box>
  );
}

function SandboxSmartInputLine() {
  return (
    <Box
      role="textbox"
      tabIndex={0}
      aria-label="Flowsheet entry input"
      sx={{
        flexGrow: 1,
        minWidth: 0,
        minHeight: 44,
        display: "flex",
        alignItems: "flex-start",
        alignContent: "flex-start",
        flexWrap: "wrap",
        px: 0.5,
        py: 0.25,
        borderRadius: "sm",
        fontSize: "sm",
        lineHeight: 1.85,
        color: "text.primary",
        outline: "none",

        "&:focus-visible": {
          boxShadow: "0 0 0 2px var(--joy-palette-primary-outlinedBorder)",
        },
      }}
    >
      <Typography
        component="span"
        level="body-sm"
        sx={{
          color: "text.primary",
          whiteSpace: "pre-wrap",
          fontWeight: 700,
        }}
      >
        Track 1{" "}
      </Typography>

      <Typography
        component="span"
        level="body-sm"
        sx={{
          color: "text.secondary",
          whiteSpace: "pre-wrap",
          opacity: 0.65,
        }}
      >
        by{" "}
      </Typography>

      <SandboxSmartToken color="primary">Shape Fixture Artist Alpha</SandboxSmartToken>

      <Typography
        component="span"
        level="body-sm"
        sx={{
          color: "text.secondary",
          whiteSpace: "pre-wrap",
          opacity: 0.65,
        }}
      >
        {" "}
        on{" "}
      </Typography>

      <SandboxSmartToken color="info">Shape Fixture Album Al</SandboxSmartToken>

      <Typography
        component="span"
        level="body-sm"
        sx={{
          color: "text.secondary",
          whiteSpace: "pre-wrap",
          opacity: 0.65,
        }}
      >
        pha 2{" "}
      </Typography>

      <Box
        component="span"
        aria-hidden
        sx={{
          width: "1px",
          height: "1.2em",
          ml: "2px",
          bgcolor: "primary.solidBg",
          display: "inline-block",
          verticalAlign: "text-bottom",
          animation: "sandboxCaretBlink 1s step-end infinite",

          "@keyframes sandboxCaretBlink": {
            "50%": {
              opacity: 0,
            },
          },
        }}
      />
    </Box>
  );
}

function SandboxComposer() {
  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.level1",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        sx={{
          px: 2,
          pt: 2,
          pb: 1.25,
        }}
      >
        <SandboxSmartInputLine />
      </Stack>

      <Divider />

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1,
          py: 0.75,
          minHeight: 48,
          bgcolor: "background.surface",
        }}
      >
        <SandboxButtons />

        <Divider orientation="vertical" sx={{ alignSelf: "stretch" }} />

        <Box
          sx={{
            flex: 1,
            minWidth: 0,

            "& [data-testid='design-sandbox-filters']": {
              minHeight: 32,
            },
          }}
        >
          <SandboxFilters />
        </Box>

        <Divider orientation="vertical" sx={{ alignSelf: "stretch" }} />

        <SandboxCommitButtons />
      </Stack>
    </Box>
  );
}

/**
 * Temporary design sandbox: an always-open modal over the flowsheet for
 * prototyping the next entry-bar concept in place. Not for production —
 * remove before merging.
 */
export default function DesignSandboxModal() {
  return (
    <Modal open disableAutoFocus disableEnforceFocus>
      <Card
        variant="outlined"
        data-testid="design-sandbox-card"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(960px, calc(100vw - 3rem))",
          minHeight: 580,
          borderRadius: "lg",
          boxShadow: "0px 34px 48px -12px rgba(0,0,0,0.55)",
          outline: "none",
          p: 0,
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: 0, gap: 0 }}>
          <SandboxComposer />
          <SandboxNearbyResults />
        </CardContent>
      </Card>
    </Modal>
  );
}