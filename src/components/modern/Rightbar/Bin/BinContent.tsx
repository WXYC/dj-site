"use client";

import { useBin } from "@/src/hooks/binHooks";
import { Card, Divider, Skeleton, Typography } from "@mui/joy";
import BinContainer from "./BinContainer";
import BinEntry from "./BinEntry";

export default function BinContent() {
  const { bin, isError, loading } = useBin();

  if (loading) {
    return (
      <BinContainer>
        <Skeleton
          variant="rectangular"
          sx={{
            overflowY: "scroll",
            width: { xs: "100%", sm: 300, lg: 400 },
            height: 350,
            borderRadius: "max((8px - 1px) - 1rem, min(1rem / 2, (8px - 1px) / 2))",
          }}
        />
      </BinContainer>
    );
  }

  return (
    <BinContainer>
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
    </BinContainer>
  );
}
