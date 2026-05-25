"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { DoubleArrow } from "@mui/icons-material";
import { Box, Button, ColorPaletteProp, Sheet, Typography } from "@mui/joy";
import { useAddToBin } from "@/src/hooks/binHooks";
import { toast } from "sonner";

export default function ResultsContainer({
  children,
  color = "primary",
}: {
  children: React.ReactNode;
  color?: ColorPaletteProp;
}) {
  const { hasActiveQuery, engageBrowse, selected, clearSelection } =
    useCatalogQuerySearch();
  const { addToBin, loading } = useAddToBin();

  const handleAddSelectedToBin = async () => {
    if (selected.length === 0) return;

    const results = await Promise.allSettled(
      selected.map((albumId) => addToBin(albumId))
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      toast.error(
        `Failed to add ${failures.length} album${failures.length > 1 ? "s" : ""} to bin`
      );
    }

    const successes = results.length - failures.length;
    if (successes > 0) {
      toast.success(
        `Added ${successes} album${successes > 1 ? "s" : ""} to bin`
      );
    }

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
        overflow: hasActiveQuery ? "auto" : "hidden",
        minHeight: 0,
        position: "relative",
        transition: "flex 0.25s ease-in-out, min-height 0.25s ease-in-out",
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
          backdropFilter: hasActiveQuery ? "blur(0)" : "blur(1rem)",
          borderRadius: "lg",
          pointerEvents: hasActiveQuery ? "none" : "auto",
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
            width: "100%",
            opacity: hasActiveQuery ? 0 : 1,
            transition: "opacity 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            py: 1,
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, width: "100%" }}>
            <Logo color={color} />
          </Box>
          <Typography
            color={color}
            level="body-lg"
            sx={{ textAlign: "center", mb: 1.5 }}
          >
            Search or select a genre, format, or tag to browse the catalog.
          </Typography>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Button
              variant="solid"
              color={color}
              size="sm"
              onClick={engageBrowse}
            >
              Enter catalog
            </Button>
          </Box>
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
