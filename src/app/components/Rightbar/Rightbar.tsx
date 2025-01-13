"use client";
import { Box, Button, Divider, List, Sheet, Stack, Typography } from "@mui/joy";
import React from "react";

//import NowPlaying from "@/app/widgets/NowPlaying";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import RightbarContent from "./RightbarContent";
import { closeSidebar } from "@/utils/application/sidebarMobileUtilities";

export default function Rightbar(): JSX.Element {
  return (
    <React.Fragment>
      <Box
        className="SecondSidebar-overlay"
        sx={{
          position: "fixed",
          zIndex: 9998,
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          bgcolor: "background.body",
          opacity: "calc(var(--SideNavigation-slideIn, 0) - 0.2)",
          transition: "opacity 0.4s",
          transform: {
            xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))",
            md: "translateX(-100%)",
          },
        }}
        onClick={() => closeSidebar()}
      />
      <Sheet
        className="SecondSidebar"
        sx={{
          position: {
            xs: "fixed",
            md: "sticky",
          },
          transform: {
            xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))",
            md: "none",
          },
          borderLeft: "1px solid",
          borderColor: "divider",
          transition: "transform 0.4s, width 0.4s",
          zIndex: 9999,
          height: "100dvh",
          top: 0,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box
          sx={{
            p: 2,
            py: 3,
          }}
        >
          <Stack direction="column" spacing={2} sx={{ pb: 2 }}>
            <Stack direction="row">
              <PlayArrowOutlinedIcon sx={{ mr: 1 }} />
              Playing Now
            </Stack>
            {/*<NowPlaying sx={{ maxWidth: 295 }} />*/}
          </Stack>
          <RightbarContent />
        </Box>
        <Box>
          <Divider />
          <List
            sx={{
              flex: 0,
              px: 2,
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "flex-end",
                pb: 1,
              }}
            >
              <Typography
                level="body-md"
                sx={{ color: "text.secondary", py: 0 }}
              >
                {`© ${new Date().getFullYear()} WXYC Chapel Hill`}
              </Typography>
              <Typography
                level="body-sm"
                sx={{ color: "text.secondary", pt: 0 }}
              >
                DJ Site v1.0.0
              </Typography>
            </Stack>
            <Button
              size="sm"
              variant="soft"
              color="neutral"
              href="https://docs.google.com/forms/d/e/1FAIpQLSfBMYYQeCEkRGsSBM3CAkjuBcHYA9Lk2Su6-ZncWH4hXwULvA/viewform?usp=sf_link"
              target="_blank"
              component="a"
            >
              Feedback
            </Button>
          </List>
        </Box>
      </Sheet>
    </React.Fragment>
  );
}
