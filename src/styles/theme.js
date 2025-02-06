import { extendTheme } from "@mui/joy/styles";

import { Kanit } from "next/font/google";
import localFont from "next/font/local";

const kanit = Kanit({
  weight: "400",
  style: "normal",
  subsets: ["latin"],
});

const minbus = localFont({
  src: "/fonts/Minbus.otf",
});

const wxycTheme = extendTheme({
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
    display: kanit.style.fontFamily,
    body: kanit.style.fontFamily,
  },
  typography: {
    h1: {
      fontFamily: minbus.style.fontFamily,
      fontWeight: "100",
      fontSize: "4.5rem",
    },
    h2: {
      fontFamily: minbus.style.fontFamily,
      fontWeight: "100",
      fontSize: "3.75rem",
    },
    h3: {
      fontFamily: minbus.style.fontFamily,
      fontWeight: "100",
      fontSize: "3rem",
    },
    h4: {
      fontFamily: minbus.style.fontFamily,
      fontWeight: "100",
      fontSize: "2.125rem",
    },
    h5: {
      fontFamily: kanit.style.fontFamily,
      fontWeight: "100",
      fontSize: "1.5rem",
    },
    h6: {
      fontFamily: kanit.style.fontFamily,
      fontWeight: "100",
      fontSize: "1rem",
    }
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: "#e1f5fe",
          100: "#b3e5fc",
          200: "#81d4fa",
          300: "#4fc3f7",
          400: "#29b6f6",
          500: "#03a9f4",
          600: "#039be5",
          700: "#0288d1",
          800: "#0277bd",
          900: "#01579b"
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
          900: "#004d40"
        },
        info: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
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
          50: "#fdf2f2",
          100: "#fad9d9",
          200: "#f7c0c0",
          300: "#f3a6a6",
          400: "#ee8080",
          500: "#8f4d4d",
          600: "#472626",
          700: "#301a1a",
          800: "#180d0d",
          900: "#000000",
        },
        info: {
          50: "#f2f7f6",
          100: "#e5efed",
          200: "#d9e8e3",
          300: "#cce0da",
          400: "#bfd8d1",
          500: "#acc2bc",
          600: "#73827d",
          700: "#606c69",
          800: "#39413f",
          900: "#131615",
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
