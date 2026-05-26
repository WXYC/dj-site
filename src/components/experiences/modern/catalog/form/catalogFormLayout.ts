import type { SxProps } from "@mui/joy/styles/types";

/** Joy Card form body — single column; two columns for paired fields at modal width. */
export const catalogFormGridSx: SxProps = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 1.5,
  width: "100%",
  "@media (min-width: 520px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
};

export const catalogFormFullWidthSx: SxProps = {
  gridColumn: "1 / -1",
};

/** Full-width chip stepper for add catalog flow. */
export const catalogAddWizardNavSx: SxProps = {
  width: "100%",
  flexWrap: "nowrap",
  alignItems: "center",
};

export const catalogAddWizardStepSx: SxProps = {
  flex: 1,
  minWidth: 0,
  justifyContent: "center",
};

/** Alternate artist (3/4) beside disc quantity (1/4). */
export const catalogFormAlternateDiscRowSx: SxProps = {
  display: "grid",
  gridTemplateColumns: "3fr 1fr",
  gap: 1.5,
  width: "100%",
  alignItems: "start",
};

export const catalogFormFieldGroupsStackSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: "100%",
};

/** Step panels stack in one grid cell; height follows the tallest step. */
export const catalogFormStepStageSx: SxProps = {
  display: "grid",
  width: "100%",
  "& > *": {
    gridArea: "1 / 1",
  },
};

export const catalogFormStepLayerSx = (active: boolean): SxProps => ({
  visibility: active ? "visible" : "hidden",
  pointerEvents: active ? "auto" : "none",
});

export const catalogEntryFormCardSx: SxProps = {
  width: "100%",
  maxHeight: "min(85dvh, 680px)",
  overflow: "auto",
  mx: "auto",
};

/** Plain outer shell — surface and border live on the inner Card (form or AlbumCard). */
export const catalogFormDialogSx: SxProps = {
  bgcolor: "transparent",
  boxShadow: "none",
  border: "none",
};

export const catalogFormDialogContentSx: SxProps = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  p: 1.5,
  bgcolor: "transparent",
};
