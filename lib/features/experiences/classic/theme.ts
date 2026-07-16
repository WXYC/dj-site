import { extendTheme } from "@mui/joy/styles";

/** Most styling for the classic experience is handled via CSS, not this theme object. */
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

