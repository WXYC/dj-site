import type { SxProps } from "@mui/joy/styles/types";

/** Bar shell height: micro-label + value row. */
export const FLOWSHEET_BAR_HEIGHT_REM = 3;

export const flowsheetSearchShellSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  minWidth: 0,
  borderRadius: "8px",
  bgcolor: "background.surface",
  border: "1px solid",
  borderColor: "neutral.outlinedBorder",
  minHeight: `${FLOWSHEET_BAR_HEIGHT_REM}rem`,
  transition: "border-color 0.15s, box-shadow 0.15s",
  "&:hover": {
    borderColor: "neutral.700",
  },
  "&:focus-within": {
    borderColor: "primary.400",
    boxShadow: "0 0 0 2px",
    boxShadowColor: "primary.100",
  },
};

export const flowsheetSegmentGridSx: SxProps = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.8fr) auto",
  },
  alignItems: "stretch",
  flex: 1,
  minWidth: 0,
};

export const flowsheetSegmentSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  px: 1.5,
  py: 1,
  minWidth: 0,
  borderRight: "1px solid",
  borderColor: "divider",
  "&:last-of-type": { borderRight: "none" },
  "&[data-focused='true']": {
    bgcolor: "background.level1",
  },
  "&[data-dimmed='true']": {
    opacity: 0.65,
  },
  "&[data-autofilled='true']": {
    bgcolor: "primary.softBg",
  },
};

export const flowsheetSegmentLabelSx: SxProps = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "text.tertiary",
  lineHeight: 1,
  mb: 0.25,
  userSelect: "none",
};

export const flowsheetSegmentInputSx: SxProps = {
  background: "transparent",
  outline: "none",
  border: "none",
  fontFamily: "inherit",
  fontSize: "var(--joy-fontSize-sm)",
  lineHeight: 1.25,
  minWidth: 0,
  width: "100%",
  p: 0,
  color: "text.primary",
};

export const flowsheetSubmitButtonSx: SxProps = {
  minHeight: "2rem",
  minWidth: "4.5rem",
  alignSelf: "center",
  mx: 0.5,
  borderRadius: "sm",
};

export const flowsheetUtilityButtonSx: SxProps = {
  minWidth: "2rem",
  minHeight: "2rem",
};

export const flowsheetListboxSx: SxProps = {
  borderRadius: "md",
  boxShadow: "lg",
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
  py: 0.5,
  display: "flex",
  justifyContent: "flex-end",
};
