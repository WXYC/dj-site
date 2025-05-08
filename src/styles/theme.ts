import { extendTheme } from "@mui/joy/styles";

import { Kanit } from "next/font/google";
import localFont from "next/font/local";

const bodyFont = Kanit({
  weight: "400",
  style: "normal",
  subsets: ["latin"],
});

const titleFont = localFont({
  src: "/fonts/Minbus.otf",
});

declare module "@mui/joy/styles" {
  interface TypographySystemOverrides {
    "body-xxs": true;
  }
}

const wxycTheme = extendTheme({
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
    display: bodyFont.style.fontFamily,
    body: bodyFont.style.fontFamily,
  },
  typography: {
    h1: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "4.5rem",
    },
    h2: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "3.75rem",
    },
    h3: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "3rem",
    },
    h4: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "2.125rem",
    },
    "body-xxs": {
      fontFamily: bodyFont.style.fontFamily,
      fontSize: "0.6rem"
    },
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
        success: {
          50: "#e0f2f1",
          100: "#b2dfdb",
          200: "#80cbc4",
          300: "#4db6ac",
          400: "#26a69a",
          500: "#009688",
          600: "#00897b",
          700: "#00796b",
          800: "#00695c",
          900: "#004d40",
        },
        warning: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
        },
        danger: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75"
        }
      },
    },
    dark: {
      palette: {
        primary: {
          50: "#faeaef",
          100: "#ecadc0",
          200: "#e383a0",
          300: "#d95a81",
          400: "#d03161",
          500: "#a6274e",
          600: "#922244",
          700: "#531427",
          800: "#3e0f1d",
          900: "#15050a",
        },
        danger: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81"
        },
        success: {
          50: "#e8f3f4",
          100: "#b9dcdf",
          200: "#74b9bf",
          300: "#45a1a9",
          400: "#178a94",
          500: "#126e76",
          600: "#106168",
          700: "#0c454a",
          800: "#07292c",
          900: "#051c1e",
        },
      },
    },
  },
});

export default wxycTheme;
