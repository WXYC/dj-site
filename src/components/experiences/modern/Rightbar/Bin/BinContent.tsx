"use client";

import { useBin, useDeleteFromBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Stack, Typography } from "@mui/joy";
import { useMemo } from "react";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";
import ClearBinButton from "./ClearBinButton";
import ExportBinButton from "./ExportBinButton";
import {
  useFlowsheetActions,
  useQueue,
  useShowControl,
} from "@/src/hooks/flowsheetHooks";
import type { BinEntryActionDeps } from "./useBinEntryActions";

export default function BinContent() {
  const { bin, isError, loading } = useBin();
  // Hoist the live subscription once for all rows (shared, like the catalog).
  const { live } = useShowControl();
  // Same for the write callbacks the row actions need: useQueue subscribes
  // to the whole queue state (plus a localStorage load on mount), far too
  // heavy to run once per bin row.
  const { addToQueue } = useQueue();
  const { addToFlowsheet } = useFlowsheetActions();
  const { deleteFromBin } = useDeleteFromBin();
  const actionDeps: BinEntryActionDeps = useMemo(
    () => ({ addToQueue, addToFlowsheet, deleteFromBin }),
    [addToQueue, addToFlowsheet, deleteFromBin],
  );

  if (loading) {
    return (
      <RightBarContentContainer
        label="Mail Bin"
        startDecorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
        fill
      >
        <Skeleton
          variant="rectangular"
          sx={{
            width: { xs: "100%", sm: 300, lg: 400 },
            flex: 1,
            minHeight: 0,
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
      endDecorator={
        hasEntries ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ExportBinButton entries={bin} />
            <ClearBinButton count={bin.length} />
          </Stack>
        ) : undefined
      }
      fill
    >
      {/* Fills the leftover column height (see RightBarContentContainer#fill)
          and scrolls internally, so a tall bin no longer pushes the rightbar
          past the viewport. */}
      <Card
        variant="outlined"
        sx={{
          overflowY: "auto",
          width: { xs: "100%", sm: 300, lg: 400 },
          flex: 1,
          minHeight: 0,
        }}
      >
        {isError ? (
          // Distinct from the empty state: a fetch failure must not read as
          // "your saved records are gone". (#637)
          <div>
            <Typography level="body-md" color="danger">
              Couldn&apos;t reach your Mail Bin. Your saved records are safe —
              check your connection and try again.
            </Typography>
          </div>
        ) : !hasEntries ? (
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
