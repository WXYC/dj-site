"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SettingsIcon from "@mui/icons-material/Settings";
import { Badge, ListItem, ListItemButton, Tooltip } from "@mui/joy";

export default function LeftbarSettingsButton() {
  const dispatch = useAppDispatch();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);
  const isActive = panel.type === "settings";

  return (
    <ListItem>
      <Tooltip
        title="Settings"
        arrow={true}
        placement="right"
        size="sm"
        variant="outlined"
      >
        <ListItemButton
          variant={isActive ? "solid" : "plain"}
          onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "settings" }))}
        >
          <Badge
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            badgeInset={"-50%"}
            badgeContent={null}
            size="sm"
          >
            <SettingsIcon />
          </Badge>
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
}
