import { extendTheme } from "@mui/joy/styles";

/**
 * Base theme configuration shared across all experiences
 * Individual experiences can extend or override these settings
 */
export const baseTheme = extendTheme({
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
});

export default baseTheme;

