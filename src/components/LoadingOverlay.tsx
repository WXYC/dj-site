import { Box, CircularProgress } from "@mui/joy";

// Whole-page loading spinner: floats over the page (no layout shift) and renders on the server, where a Joy Modal would crash.
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
        // Appears after a short delay so quick loads never flash a spinner.
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
