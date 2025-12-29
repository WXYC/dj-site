import { extendTheme } from "@mui/joy/styles";

/**
 * Classic experience theme configuration
 * Features: Minimal theme, legacy browser support, traditional styling
 * Note: Most styling for classic experience is handled via CSS
 */
export const classicTheme = extendTheme({
  cssVarPrefix: "wxyc",
  components: {
    JoyTooltip: {
      styleOverrides: {
        root: {
          zIndex: 10000,
        },
      },
    },
  },
  fontFamily: {
    display: "Arial, Helvetica, sans-serif",
    body: "Arial, Helvetica, sans-serif",
  },
  typography: {
    h1: {
      fontFamily: "Verdana, Geneva, Arial, Helvetica, sans-serif",
      fontWeight: "bold",
    },
    h2: {
      fontFamily: "Verdana, Geneva, Arial, Helvetica, sans-serif",
      fontWeight: "bold",
    },
    h3: {
      fontFamily: "Verdana, Geneva, Arial, Helvetica, sans-serif",
      fontWeight: "bold",
    },
    h4: {
      fontFamily: "Verdana, Geneva, Arial, Helvetica, sans-serif",
      fontWeight: "bold",
    },
  },
});

export default classicTheme;

