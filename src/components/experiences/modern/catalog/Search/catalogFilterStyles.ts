/** ~11px controls — smaller than Joy `sm`, borderless plain selects. */
export const filterControlFontSx = {
  fontSize: "0.75rem",
  lineHeight: 1.2,
  fontWeight: 500,
  letterSpacing: "0.01em",
} as const;

export const plainFilterSelectButtonSx = {
  ...filterControlFontSx,
  minHeight: 0,
  height: "auto",
  py: 0,
  px: 0.25,
  "--Button-minHeight": "1.125rem",
  whiteSpace: "nowrap",
  border: "none",
  bgcolor: "transparent",
  boxShadow: "none",
  "&:hover": {
    bgcolor: "transparent",
    boxShadow: "none",
  },
  "&:active": {
    bgcolor: "transparent",
  },
} as const;

export const plainFilterSelectSx = {
  minWidth: 0,
  minHeight: 0,
  "--Select-gap": "0.125rem",
  "--Select-decoratorChildHeight": "0.75rem",
} as const;

export const catalogFilterAutocompleteSx = {
  width: "100%",
  minWidth: 0,
  "--Autocomplete-wrapperGap": "0.25rem",
  "--Input-minHeight": "1.375rem",
} as const;

export const EXCLUSIVES_PURPLE = "#7B2D8E";
export const EXCLUSIVES_PURPLE_HOVER = "#6a2479";
