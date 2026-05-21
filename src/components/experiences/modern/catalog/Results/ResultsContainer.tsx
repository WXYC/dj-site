"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import {
  useAdminCatalogSearch,
  useCatalogQuerySearch,
} from "@/src/hooks/catalogHooks";
import { DoubleArrow } from "@mui/icons-material";
import { Box, Button, ColorPaletteProp, Sheet, Typography } from "@mui/joy";
import { useRef } from "react";
import { useAddToBin } from "@/src/hooks/binHooks";
import { toast } from "sonner";

function CatalogResultsContainerInner({
  children,
  hasActiveQuery,
  selected,
  clearSelection,
  showBinBulk,
  color = "primary",
  emptyHint = "Build a query above to explore the library, or just pick a sort to browse the catalog.",
}: {
  children: React.ReactNode;
  hasActiveQuery: boolean;
  selected: number[];
  clearSelection: () => void;
  showBinBulk: boolean;
  color?: ColorPaletteProp;
  emptyHint?: string;
}) {
  const { addToBin, loading } = useAddToBin();
  const tableRef = useRef<HTMLTableElement>(null);

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
            opacity: hasActiveQuery ? 0 : 1,
            transition: "opacity 0.2s",
            pb: 2,
          }}
        >
          <Logo color={color} />
          <Typography
            color={color}
            level="body-lg"
            sx={{ textAlign: "center" }}
          >
            {emptyHint}
          </Typography>
        </Box>
      </Box>
      {children}
      {showBinBulk && selected.length > 0 && (
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

function CatalogResultsContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hasActiveQuery, selected, clearSelection } = useCatalogQuerySearch();
  return (
    <CatalogResultsContainerInner
      hasActiveQuery={hasActiveQuery}
      selected={selected}
      clearSelection={clearSelection}
      showBinBulk
    >
      {children}
    </CatalogResultsContainerInner>
  );
}

function AdminResultsContainer({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: ColorPaletteProp;
}) {
  const { searchString, selected, clearSelection } = useAdminCatalogSearch();
  const hasActiveQuery = searchString.length > 0;
  return (
    <CatalogResultsContainerInner
      hasActiveQuery={hasActiveQuery}
      selected={selected}
      clearSelection={clearSelection}
      showBinBulk={false}
      color={color ?? "success"}
      emptyHint="Start typing in the search bar above to explore the library!"
    >
      {children}
    </CatalogResultsContainerInner>
  );
}

export default function ResultsContainer({
  children,
  scope = "catalog",
  color,
}: {
  children: React.ReactNode;
  scope?: "catalog" | "admin";
  color?: ColorPaletteProp;
}) {
  if (scope === "admin") {
    return (
      <AdminResultsContainer color={color}>{children}</AdminResultsContainer>
    );
  }
  return <CatalogResultsContainer>{children}</CatalogResultsContainer>;
}
