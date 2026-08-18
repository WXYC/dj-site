import type { SxProps } from "@mui/joy/styles/types";

/** Outlined section cards in stacked forms — aligned with AlbumCard and the catalog search shell. */
export const formSectionCardSx: SxProps = {
  borderRadius: "md",
  bgcolor: "background.surface",
  flexShrink: 0,
};

/** Focus ring when a card contains active form controls. */
export const formSectionCardInteractiveSx: SxProps = {
  "&:focus-within": {
    borderColor: "var(--wxyc-palette-primary-300)",
    boxShadow: "0 0 0 2px var(--wxyc-palette-primary-100)",
  },
};

export const formSectionCardsStackSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
};
