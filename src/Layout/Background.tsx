import { Box } from "@mui/joy";
import { ReactNode } from "react";

// Serializable stand-in for theme.getColorSchemeSelector("dark"): a function-valued
// `sx` cannot cross the RSC boundary into Joy's client Box (request-time
// serialization error on dynamic routes — next build does not catch it). Hardcodes
// Joy's scheme attribute, same coupling as src/styles/classic/*.css.
const DARK_SCHEME_SELECTOR =
  '&[data-joy-color-scheme="dark"], [data-joy-color-scheme="dark"] &';

export function BackgroundImage() {
  return (
    <Box
      sx={{
        height: "100%",
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        left: "clamp(0px, (100vw - var(--Collapsed-breakpoint)) * 999, 100vw - var(--Cover-width))",
        transition:
          "background-image var(--Transition-duration), left var(--Transition-duration) !important",
        transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
        backgroundColor: "background.level1",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundImage: `url("/img/wxyc_color.png")`,
        [DARK_SCHEME_SELECTOR]: {
          backgroundImage: `url("/img/wxyc_dark.jpg")`,
        },
      }}
    />
  );
}

export function BackgroundBox({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width:
          "clamp(100vw - var(--Cover-width), (var(--Collapsed-breakpoint) - 100vw) * 999, 100vw)",
        transition: "width var(--Transition-duration)",
        transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
        position: "relative",
        zIndex: 1,
        minHeight: "100%",
        display: "flex",
        justifyContent: "flex-end",
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(255 255 255 / 0.6)",
        [DARK_SCHEME_SELECTOR]: {
          backgroundColor: "rgba(19 19 24 / 0.4)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width:
            "clamp(var(--Form-maxWidth), (var(--Collapsed-breakpoint) - 100vw) * 999, 100%)",
          maxWidth: "100%",
          px: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
