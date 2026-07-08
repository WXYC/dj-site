import type { SxProps } from "@mui/joy/styles/types";

export const flowsheetSearchShellSx: SxProps = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flexGrow: 1,
  minWidth: 0,
  borderRadius: "8px",
  background: "transparent",
  border: "1px solid",
  borderColor: "neutral.outlinedBorder",
  minHeight: "var(--Input-minHeight)",
  paddingInline: "0.5rem",
  transition: "border-color 0.15s, box-shadow 0.15s",
  "&:hover": {
    borderColor: "neutral.700",
  },
  "&:focus-within": {
    borderColor: "primary.400",
    boxShadow: "0 0 0 1px var(--joy-palette-primary-400)",
  },
};

export const flowsheetSegmentGridSx: SxProps = {
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  flex: 1,
  minWidth: 0,
};

export const flowsheetSegmentSx: SxProps = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
};

export const flowsheetSegmentInputSx: SxProps = {
  background: "transparent",
  outline: "none",
  border: "none",
  fontFamily: "inherit",
  fontSize: "var(--joy-fontSize-sm)",
  minWidth: 0,
  width: "100%",
  flex: 1,
  px: 1,
  minHeight: "2rem",
  color: "text.primary",
};

export const flowsheetSubmitButtonSx: SxProps = {
  minHeight: "22px",
  maxWidth: "22px !important",
  borderRadius: "0.3rem",
  alignSelf: "center",
};

export const flowsheetUtilityButtonSx: SxProps = {
  minWidth: "2rem",
  minHeight: "2rem",
};

export const flowsheetListboxSx: SxProps = {
  borderRadius: "md",
  boxShadow: "0px 34px 24px -9px rgba(0,0,0,0.5)",
  maxHeight: "min(70vh, 480px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

export const flowsheetListboxScrollSx: SxProps = {
  overflowY: "auto",
  flex: 1,
};

export const flowsheetListboxFooterSx: SxProps = {
  flexShrink: 0,
  borderTop: "1px solid",
  borderColor: "divider",
  px: 1,
  py: 0.25,
  display: "flex",
  justifyContent: "flex-end",
};
