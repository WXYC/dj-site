"use client";

import { useBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";
import { useAppSelector } from "@/lib/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";

export default function BinContent() {
  const mini = useAppSelector(applicationSlice.selectors.getRightbarMini);
  const { bin, isError, loading } = useBin();

  const height = mini ? 500 : 335;

  if (loading) {
    return (
      <RightBarContentContainer
        label="Mail Bin"
        startDecorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
      >
        <Skeleton
          variant="rectangular"
          sx={{
            overflowY: "scroll",
            width: { xs: "100%", sm: 300, lg: 400 },
            height: height,
            borderRadius:
              "max((8px - 1px) - 1rem, min(1rem / 2, (8px - 1px) / 2))",
          }}
        />
      </RightBarContentContainer>
    );
  }

  return (
    <RightBarContentContainer
      label="Mail Bin"
      startDecorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
    >
      <Card
        variant="outlined"
        sx={{
          overflowY: "scroll",
          width: { xs: "100%", sm: 300, lg: 400 },
          height: height,
        }}
      >
        {!bin || bin.length <= 0 || isError ? (
          <div>
            <Typography level="body-md">An empty record...</Typography>
          </div>
        ) : (
          bin.map((entry, index) => (
            <div key={`bin-${entry.id}-${index}`}>
              <BinEntry key={`bin-entry-${entry.id}`} entry={entry} />
              {index < bin.length - 1 && (
                <Divider key={`bin-divider-${entry.id}`} />
              )}
            </div>
          ))
        )}
      </Card>
    </RightBarContentContainer>
  );
}
