"use client";

import type { JSX } from "react";
import { useEffect } from "react";
import { Box, Typography } from "@mui/joy";
import { getPageTitle } from "@/lib/utils/page-title";

const PageHeader = ({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): JSX.Element => {
  // Set the document title client-side, matching PageTitleUpdater. The former
  // PageData component used next/head, a Pages Router API that is a silent
  // no-op in the App Router, so page-specific titles never applied (#640).
  useEffect(() => {
    document.title = getPageTitle(title);
  }, [title]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        my: 1,
        gap: 1,
        flexWrap: "wrap",
        "& > *": {
          minWidth: "clamp(0px, (500px - 100%) * 999, 100%)",
          flexGrow: 1,
        },
      }}
    >
      <Typography level="h2">{title}</Typography>
      <Box sx={{ flex: 999 }}></Box>
      {children}
    </Box>
  );
};

export default PageHeader;
