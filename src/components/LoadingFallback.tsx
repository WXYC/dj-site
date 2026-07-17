import { Box, CircularProgress } from "@mui/joy";

// Portal-free fallback for route-segment loading.tsx files. LoadingPage's Joy
// Modal is unusable here: Portal mounts client-only (renders null during SSR
// streaming — the blank screen loading.tsx exists to prevent), and an open
// Modal scroll-locks and focus-traps the app on every navigation.
export function LoadingFallback() {
  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        width: "100%",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default LoadingFallback;
