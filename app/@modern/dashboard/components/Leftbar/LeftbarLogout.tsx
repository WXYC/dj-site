"use client";
import { useLogout } from "@/app/hooks/authenticationHooks";
import { User } from "@/lib/features/authentication/types";
import { LogoutOutlined, PersonOutlined } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useState } from "react";

export default function LeftbarLogout({ user }: { user: User }): JSX.Element {
  const [logoutHovered, setLogoutHovered] = useState(false);

  const { handleLogout, loggingOut } = useLogout();

  return (
    <Tooltip
      title={
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 320,
            justifyContent: "center",
            p: 1,
          }}
        >
          <Typography level="body-sm">@{user?.username}</Typography>
          <Stack direction="row" gap={1}>
            <Typography level="body-lg">{user?.realName}</Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <Typography
                level="body-xs"
                sx={{
                  height: "1.5em",
                }}
              >
                aka
              </Typography>
            </Box>
            <Typography level="body-lg">DJ {user?.djName}</Typography>
          </Stack>
          <Typography level="body-md" color="primary">
            Click to Log Out
          </Typography>
        </Box>
      }
      placement="right"
      arrow
      variant="outlined"
    >
      <form onSubmit={handleLogout}>
        <IconButton
          type="submit"
          variant="outlined"
          onMouseOver={() => setLogoutHovered(true)}
          onMouseOut={() => setLogoutHovered(false)}
          loading={loggingOut}
        >
          {logoutHovered ? <LogoutOutlined /> : <PersonOutlined />}
        </IconButton>
      </form>
    </Tooltip>
  );
}
