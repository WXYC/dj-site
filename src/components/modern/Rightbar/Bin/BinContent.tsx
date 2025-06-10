"use client";

import { useBin } from "@/src/hooks/binHooks";
import { Inbox } from "@mui/icons-material";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import RightBarContentContainer from "../RightBarContentContainer";
import BinEntry from "./BinEntry";

export default function BinContent() {
  const { bin, isError, loading } = useBin();

  if (loading) {
    return (
      <RightBarContentContainer
        label="Mail Bin"
        decorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
      >
        <Skeleton
          variant="rectangular"
          sx={{
            overflowY: "scroll",
            width: { xs: "100%", sm: 300, lg: 400 },
            height: 350,
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
      decorator={<Inbox sx={{ mt: 0.3, mr: 1 }} />}
    >
      <Card
        variant="outlined"
        sx={{
          overflowY: "scroll",
          width: { xs: "100%", sm: 300, lg: 400 },
          height: 350,
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
