"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Box, Sheet, Typography } from "@mui/joy";

export default function ResultsContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { effectiveQuery } = usePlaylistSearch();
  const hasQuery = effectiveQuery.length >= 2;

  return (
    <Sheet
      variant="outlined"
      sx={{
        width: "100%",
        borderRadius: "md",
        flex: 1,
        overflow: hasQuery ? "auto" : "hidden",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 999,
          backdropFilter: hasQuery ? "blur(0)" : "blur(1rem)",
          borderRadius: "lg",
          pointerEvents: hasQuery ? "none" : "auto",
          transition: "backdrop-filter 0.2s",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            height: "80%",
            opacity: hasQuery ? 0 : 1,
            transition: "opacity 0.2s",
            pb: 2,
          }}
        >
          <Logo color="primary" />
          <Typography
            color="primary"
            level="body-lg"
            sx={{ textAlign: "center" }}
          >
            Start typing in the search bar above to explore previous sets!
          </Typography>
        </Box>
      </Box>
      {children}
    </Sheet>
  );
}
