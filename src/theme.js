import { extendTheme } from '@mui/joy/styles';

const wxycTheme = extendTheme({
  components: {
    JoyTooltip: {
      styleOverrides: {
        root: {
          zIndex: 10000,
        }
      }
    },
  },
  fontFamily: {
    display: 'Kanit',
    body: 'Kanit',
  },
  typography: {
    h1: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
    h2: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
    h3: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
    h4: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
    h5: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
    h6: {
      fontFamily: 'Minbus',
      fontWeight: '100',
    },
  },
  "colorSchemes": {
    "light": {
      "palette": {
        "primary": {
          "50": "#fce4ec",
          "100": "#f8bbd0",
          "200": "#f48fb1",
          "300": "#f06292",
          "400": "#ec407a",
          "500": "#e91e63",
          "600": "#d81b60",
          "700": "#c2185b",
          "800": "#ad1457",
          "900": "#880e4f"
        },
        "neutral": {
          "50": "#fffbeb",
          "100": "#fef3c7",
          "200": "#fde68a",
          "300": "#fcd34d",
          "400": "#fbbf24",
          "500": "#f59e0b",
          "600": "#d97706",
          "700": "#b45309",
          "800": "#92400e",
          "900": "#78350f"
        },
        "danger": {
          "50": "#e0f7fa",
          "100": "#b2ebf2",
          "200": "#80deea",
          "300": "#4dd0e1",
          "400": "#26c6da",
          "500": "#00bcd4",
          "600": "#00acc1",
          "700": "#0097a7",
          "800": "#00838f",
          "900": "#006064"
        },
        "info": {
          "50": "#f0fdfa",
          "100": "#ccfbf1",
          "200": "#99f6e4",
          "300": "#5eead4",
          "400": "#2dd4bf",
          "500": "#14b8a6",
          "600": "#0d9488",
          "700": "#0f766e",
          "800": "#115e59",
          "900": "#134e4a"
        }
      }
    },
    "dark": {
      "palette": {
        "primary": {
          "50": "#faeaef",
          "100": "#ecadc0",
          "200": "#e383a0",
          "300": "#d95a81",
          "400": "#d03161",
          "500": "#a6274e",
          "600": "#922244",
          "700": "#531427",
          "800": "#3e0f1d",
          "900": "#15050a"
        },
        "danger": {
          "50": "#fdf2f2",
          "100": "#fad9d9",
          "200": "#f7c0c0",
          "300": "#f3a6a6",
          "400": "#ee8080",
          "500": "#8f4d4d",
          "600": "#472626",
          "700": "#301a1a",
          "800": "#180d0d",
          "900": "#000000"
        },
        "info": {
          "50": "#f2f7f6",
          "100": "#e5efed",
          "200": "#d9e8e3",
          "300": "#cce0da",
          "400": "#bfd8d1",
          "500": "#acc2bc",
          "600": "#73827d",
          "700": "#606c69",
          "800": "#39413f",
          "900": "#131615"
        },
        "success": {
          "50": "#e8f3f4",
          "100": "#b9dcdf",
          "200": "#74b9bf",
          "300": "#45a1a9",
          "400": "#178a94",
          "500": "#126e76",
          "600": "#106168",
          "700": "#0c454a",
          "800": "#07292c",
          "900": "#051c1e"
        }
      }
    }
  }
});

export default wxycTheme;
