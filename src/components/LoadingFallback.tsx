import { Box, CircularProgress } from "@mui/joy";

// Portal-free fallback for every Suspense boundary that can render on the
// server: route-segment loading.tsx files and ThemedLayout's app-wide boundary.
// A Joy Modal is unusable in that position on both counts -- Portal mounts
// client-only, so it renders null during SSR streaming (the blank screen these
// boundaries exist to prevent), and an open Modal scroll-locks and focus-traps
// the app on every navigation. Worse, Joy's useModal reads
// `children.props.hasOwnProperty("in")`, which throws outright when the
// children reach it across the RSC boundary.
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
