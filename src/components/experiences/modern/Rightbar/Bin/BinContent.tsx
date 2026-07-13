"use client";

import { useBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";
import ClearBinButton from "./ClearBinButton";
import { useGetRightbarQuery } from "@/lib/features/application/api";
import { useShowControl } from "@/src/hooks/flowsheetHooks";

export default function BinContent() {
  const { data: max } = useGetRightbarQuery();
  const { bin, isError, loading } = useBin();
  // Hoist the live subscription once for all rows (shared, like the catalog).
  const { live } = useShowControl();

  // Fixed-size box: reserves a consistent blank area and scrolls internally
  // once its content exceeds it, rather than growing the rightbar downward.
  const height = max ? 500 : 335;

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
            height: height,
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
          height: height,
        }}
      >
        {!hasEntries ? (
          <div>
            <Typography level="body-md">An empty record...</Typography>
          </div>
        ) : (
          bin.map((entry, index) => (
            <div key={`bin-${entry.id}`}>
              <BinEntry entry={entry} live={live} />
              {index < bin.length - 1 && <Divider />}
            </div>
          ))
        )}
      </Card>
    </RightBarContentContainer>
  );
}
