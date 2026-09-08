import { Box, CircularProgress } from "@mui/joy";

// Suspense fallback for the whole-page experience shell. Fixed-position and
// portal-free on purpose: a Joy Modal here SSR-crashes in @mui/base's
// useModal when the boundary suspends during streaming, and an in-flow box
// occupies the top of the page column while content streams in below it,
// shoving the page down until the boundary resolves. An overlay renders
// during SSR, displaces nothing, and blocks no input while content arrives.
export function LoadingOverlay() {
  return (
    <Box
      component="div"
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
        // Reveal on a delay so boundaries that resolve within it never flash
        // a spinner.
        opacity: 0,
        animation: "loadingReveal 0.2s ease-in 0.25s forwards",
        "@keyframes loadingReveal": {
          to: { opacity: 1 },
        },
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default LoadingOverlay;
