"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import { Box, Sheet, Typography } from "@mui/joy";

export default function ResultsContainer({
  children,
  showResults,
}: {
  children: React.ReactNode;
  // Owned by Results via usePlaylistSearchResults, not re-derived here: a
  // second threshold in this file is how the listing came to be fetched and
  // then hidden behind the prompt below.
  showResults: boolean;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        width: "100%",
        borderRadius: "md",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        // The frame never scrolls; the table inside it does. Two nested
        // scrollports put two bars side by side, and the outer one moves a
        // header the inner one has already pinned.
        overflow: "hidden",
        // Containing block for the prompt overlay, which is absolutely
        // positioned and otherwise resolves against the viewport.
        position: "relative",
      }}
    >
      {/* Rendered only while it applies. Kept mounted at opacity 0 it stays in
          the accessibility tree, so a screen reader announces a prompt to keep
          typing over a table that is already listing entries. */}
      {!showResults && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 999,
            backdropFilter: "blur(1rem)",
            borderRadius: "lg",
            pointerEvents: "auto",
            transition: "backdrop-filter 0.2s",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box sx={{ height: "80%", pb: 2 }}>
            <Logo color="primary" />
            <Typography
              color="primary"
              level="body-lg"
              sx={{ textAlign: "center" }}
            >
              Keep typing to search previous sets…
            </Typography>
          </Box>
        </Box>
      )}
      {children}
    </Sheet>
  );
}
