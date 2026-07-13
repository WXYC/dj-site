"use client";

import { useBin, useDeleteFromBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import { useMemo } from "react";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";
import ClearBinButton from "./ClearBinButton";
import { useGetRightbarQuery } from "@/lib/features/application/api";
import {
  useFlowsheet,
  useQueue,
  useShowControl,
} from "@/src/hooks/flowsheetHooks";
import type { BinEntryActionDeps } from "./useBinEntryActions";

export default function BinContent() {
  const { data: max } = useGetRightbarQuery();
  const { bin, isError, loading } = useBin();
  // Hoist the live subscription once for all rows (shared, like the catalog).
  const { live } = useShowControl();
  // Same for the write callbacks the row actions need: useQueue/useFlowsheet
  // subscribe to the whole queue/flowsheet state (plus a localStorage load on
  // mount), far too heavy to run once per bin row.
  const { addToQueue } = useQueue();
  const { addToFlowsheet } = useFlowsheet();
  const { deleteFromBin } = useDeleteFromBin();
  const actionDeps: BinEntryActionDeps = useMemo(
    () => ({ addToQueue, addToFlowsheet, deleteFromBin }),
    [addToQueue, addToFlowsheet, deleteFromBin],
  );

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
            // The index suffix disambiguates duplicate album ids — nothing
            // stops the same album being mailed to the bin twice (no unique
            // constraint backend-side), and duplicate React keys would
            // collapse the rows.
            <div key={`bin-${entry.id}-${index}`}>
              <BinEntry entry={entry} live={live} actionDeps={actionDeps} />
              {index < bin.length - 1 && <Divider />}
            </div>
          ))
        )}
      </Card>
    </RightBarContentContainer>
  );
}
