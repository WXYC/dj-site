"use client";

import type { JSX } from "react";
import Link from "next/link";
import { Button } from "@mui/joy";
import { Add } from "@mui/icons-material";

/** The shelf's way into filing: an MD write, so it carries the write affordance's success tone. */
export default function AddToRotationButton(): JSX.Element {
  return (
    <Button
      component={Link}
      href="/dashboard/admin/rotation/new"
      color="success"
      startDecorator={<Add />}
      sx={{ flexGrow: 0 }}
    >
      Add to rotation
    </Button>
  );
}
