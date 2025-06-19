"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Dropdown, IconButton, Menu, MenuButton } from "@mui/joy";

import { MenuLinkItem } from "@/src/components/General/LinkButton";
import { useShiftKey } from "@/src/hooks/applicationHooks";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { MoreVert } from "@mui/icons-material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import AddToQueueFromBin from "./AddToQueueFromBin";
import DeleteFromBin from "./DeleteFromBin";
import PlayFromBin from "./PlayFromBin";

export default function BinMenu({ entry }: { entry: AlbumEntry }) {
  const { live } = useShowControl();
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
        <MenuLinkItem href={`/dashboard/album/${entry.id}`} color="neutral">
          <InfoOutlined />
          More Info
        </MenuLinkItem>
        {live && <AddToQueueFromBin entry={entry} />}
        {live && <PlayFromBin entry={entry} />}
        <DeleteFromBin album={entry} color="warning" />
      </Menu>
    </Dropdown>
  );
}
