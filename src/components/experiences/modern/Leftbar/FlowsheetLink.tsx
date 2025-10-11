"use client";

import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { Stream } from "@mui/icons-material";
import { Badge } from "@mui/joy";
import LeftbarLink from "./LeftbarLink";

export default function FlowsheetLink() {
  const { live } = useShowControl();

  return (
    <Badge
      size="sm"
      invisible={!live}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{
        "& span.MuiBadge-badge": {
          top: "20%",
        },
      }}
    >
      <LeftbarLink path="/dashboard/flowsheet" title={`Flowsheet${live ? "      🔴 [ON AIR]" : ""}`}>
        <Stream />
      </LeftbarLink>
    </Badge>
  );
}
