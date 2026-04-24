"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { AccountCircle } from "@mui/icons-material";
import { CircularProgress, Box } from "@mui/joy";
import RightbarPanelContainer from "../RightbarPanelContainer";
import SettingsForm from "../../settings/SettingsForm";

export default function SettingsPanel() {
  const dispatch = useAppDispatch();
  const { data, authenticating } = useAuthentication();
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  const user = isAuthenticated(data) ? data.user : undefined;

  if (authenticating || !user) {
    return (
      <RightbarPanelContainer
        title="Your Information"
        startDecorator={<AccountCircle />}
        onClose={handleClose}
      >
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size="sm" />
        </Box>
      </RightbarPanelContainer>
    );
  }

  return (
    <RightbarPanelContainer
      title="Your Information"
      startDecorator={<AccountCircle />}
      onClose={handleClose}
    >
      <SettingsForm user={user} />
    </RightbarPanelContainer>
  );
}
