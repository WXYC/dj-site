"use client";

import type { JSX } from "react";
import Link from "next/link";
import { Button } from "@mui/joy";
import { ArrowBack } from "@mui/icons-material";

export default function BackToShelfButton(): JSX.Element {
  return (
    <Button
      component={Link}
      href="/dashboard/admin/rotation"
      variant="plain"
      color="neutral"
      startDecorator={<ArrowBack />}
      sx={{ flexGrow: 0 }}
    >
      Rotation shelf
    </Button>
  );
}
