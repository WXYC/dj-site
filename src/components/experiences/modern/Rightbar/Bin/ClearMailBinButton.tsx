"use client";

import { useClearMailBin } from "@/src/hooks/binHooks";
import { Button } from "@mui/joy";

export default function ClearMailBinButton() {
  const { requestClear, clearing, disabled } = useClearMailBin();

  return (
    <Button
      size="sm"
      variant="soft"
      color="warning"
      disabled={disabled}
      {...(clearing ? { loading: true } : {})}
      onClick={requestClear}
      aria-label="Clear mail bin"
      data-testid="mail-bin-clear-button"
      suppressHydrationWarning
    >
      Clear
    </Button>
  );
}
