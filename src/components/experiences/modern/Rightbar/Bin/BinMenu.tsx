"use client";
import { applicationSlice } from "@/lib/features/application/frontend";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAppDispatch } from "@/lib/hooks";
import { Dropdown, IconButton, Menu, MenuButton, MenuItem } from "@mui/joy";

import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { MoreVert } from "@mui/icons-material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import AddToQueueFromBin from "./AddToQueueFromBin";
import DeleteFromBin from "./DeleteFromBin";
import PlayFromBin from "./PlayFromBin";

export default function BinMenu({ entry }: { entry: AlbumEntry }) {
  const { live } = useShowControl();
  const dispatch = useAppDispatch();
  return (
    <Dropdown>
      <MenuButton
        slots={{
          root: IconButton,
        }}
        slotProps={{
          root: {
            variant: "plain",
            color: "neutral",
          },
        }}
      >
        <MoreVert />
      </MenuButton>
      <Menu
        sx={{
          zIndex: 10000,
        }}
        popperOptions={{
          placement: "bottom-start",
        }}
      >
        <MenuItem
          color="neutral"
          onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: entry.id }))}
        >
          <InfoOutlined />
          More Info
        </MenuItem>
        {live && <AddToQueueFromBin entry={entry} />}
        {live && <PlayFromBin entry={entry} />}
        <DeleteFromBin album={entry} color="warning" />
      </Menu>
    </Dropdown>
  );
}
