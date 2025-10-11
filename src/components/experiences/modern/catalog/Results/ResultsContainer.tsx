"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import { DoubleArrow } from "@mui/icons-material";
import { Box, Button, Sheet, Table, Typography } from "@mui/joy";
import { useRef } from "react";
import { useAddToBin } from "@/src/hooks/binHooks";
import { toast } from "sonner";

export default function ResultsContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { searchString, selected, clearSelection } = useCatalogSearch();
  const { addToBin, loading } = useAddToBin();
  const tableRef = useRef<HTMLTableElement>(null);

  const handleAddSelectedToBin = () => {
    if (selected.length === 0) return;
    
    // Add each selected album to bin
    selected.forEach((albumId) => {
      addToBin(albumId);
    });
    
    toast.success(`Added ${selected.length} album${selected.length > 1 ? 's' : ''} to bin`);
    clearSelection();
  };

  return (
    <Sheet
      id="OrderTableContainer"
      variant="outlined"
      sx={{
        width: "100%",
        borderRadius: "md",
        flex: 1,
        overflow: searchString.length > 0 ? "auto" : "hidden",
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
          backdropFilter: searchString.length > 0 ? "blur(0)" : "blur(1rem)",
          borderRadius: "lg",
          pointerEvents: searchString.length > 0 ? "none" : "auto",
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
            opacity: searchString.length > 0 ? 0 : 1,
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
            Start typing in the search bar above to explore the library!
          </Typography>
        </Box>
      </Box>
        {children}
      {selected.length > 0 && (
        <Box
          sx={{
            position: "sticky",
            bottom: 20,
            left: 0,
            width: "100%",
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Button
            endDecorator={<DoubleArrow />}
            variant="solid"
            color="primary"
            size="lg"
            loading={loading}
            sx={{
              marginRight: "1rem",
            }}
            onClick={handleAddSelectedToBin}
          >
            Add {selected.length} to bin
          </Button>
        </Box>
      )}
    </Sheet>
  );
}
