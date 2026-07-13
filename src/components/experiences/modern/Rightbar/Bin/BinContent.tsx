"use client";

import { useBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";
import ClearBinButton from "./ClearBinButton";

// Safety cap so a very large bin scrolls internally instead of dominating the
// rightbar column; short bins size to their content and waste no space.
const BIN_MAX_HEIGHT = 500;

export default function BinContent() {
  const { bin, isError, loading } = useBin();

  if (loading) {
    return (
      <RightBarContentContainer
        label="Mail Bin"
        startDecorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
      >
        <Skeleton
          variant="rectangular"
          sx={{
            width: { xs: "100%", sm: 300, lg: 400 },
            height: 335,
            borderRadius:
              "max((8px - 1px) - 1rem, min(1rem / 2, (8px - 1px) / 2))",
          }}
        />
      </RightBarContentContainer>
    );
  }

  const hasEntries = !!bin && bin.length > 0 && !isError;

  return (
    <RightBarContentContainer
      label="Mail Bin"
      startDecorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
      endDecorator={hasEntries ? <ClearBinButton count={bin.length} /> : undefined}
    >
      <Card
        variant="outlined"
        sx={{
          overflowY: "auto",
          width: { xs: "100%", sm: 300, lg: 400 },
          maxHeight: BIN_MAX_HEIGHT,
        }}
      >
        {!hasEntries ? (
          <div>
            <Typography level="body-md">An empty record...</Typography>
          </div>
        ) : (
          bin.map((entry, index) => (
            <div key={`bin-${entry.id}`}>
              <BinEntry entry={entry} />
              {index < bin.length - 1 && <Divider />}
            </div>
          ))
        )}
      </Card>
    </RightBarContentContainer>
  );
}
