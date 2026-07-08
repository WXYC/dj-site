"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchScope } from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { FilterList } from "@mui/icons-material";
import { Dropdown, IconButton, Menu, MenuButton, MenuItem, Tooltip } from "@mui/joy";
import { flowsheetUtilityButtonSx } from "./flowsheetSearchBarStyles";

const LABELS: Record<FlowsheetSearchScope, string> = {
  all: "All",
  rotation: "Rotation",
};

export default function ScopeControl({ disabled }: { disabled?: boolean }) {
  const dispatch = useAppDispatch();
  const scope = useAppSelector(flowsheetSlice.selectors.getSearchScope);

  return (
    <Dropdown>
      <Tooltip title="Search scope" placement="top">
        <MenuButton
          slots={{ root: IconButton }}
          slotProps={{ root: { size: "sm", disabled, sx: flowsheetUtilityButtonSx } }}
          data-testid="flowsheet-scope-control"
        >
          <FilterList fontSize="small" />
          {LABELS[scope]}
        </MenuButton>
      </Tooltip>
      <Menu placement="bottom-start" size="sm">
        {(Object.keys(LABELS) as FlowsheetSearchScope[]).map((key) => (
          <MenuItem
            key={key}
            selected={scope === key}
            onClick={() =>
              dispatch(flowsheetSlice.actions.setSearchScope(key))
            }
          >
            {LABELS[key]}
          </MenuItem>
        ))}
      </Menu>
    </Dropdown>
  );
}
