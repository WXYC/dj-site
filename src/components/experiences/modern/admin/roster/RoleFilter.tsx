"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization, ROSTER_ROLES } from "@/lib/features/admin/types";
import { AUTHORIZATION_LABELS } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { FilterList } from "@mui/icons-material";
import { Chip, FormControl, Option, Select } from "@mui/joy";

/**
 * Narrows the roster to one or more station roles.
 *
 * A filter rather than a search box because role labels share substrings with
 * names — see `roster-filter.ts`.
 */
export default function RoleFilter() {
  const roleFilter = useAppSelector(adminSlice.selectors.getRoleFilter);
  const dispatch = useAppDispatch();

  return (
    <FormControl size="sm">
      <Select
        multiple
        size="sm"
        color="success"
        placeholder="All roles"
        startDecorator={<FilterList />}
        value={roleFilter}
        onChange={(_, selected) =>
          dispatch(adminSlice.actions.setRoleFilter(selected as Authorization[]))
        }
        slotProps={{
          button: { "aria-label": "Filter by role", sx: { whiteSpace: "nowrap" } },
          listbox: { sx: { zIndex: "modal" } },
        }}
        renderValue={(selected) => (
          <>
            {selected.map((option) => (
              <Chip key={option.value} size="sm" variant="soft" color="success">
                {option.label}
              </Chip>
            ))}
          </>
        )}
        sx={{ minWidth: "180px" }}
      >
        {ROSTER_ROLES.map((role) => (
          <Option key={role} value={role}>
            {AUTHORIZATION_LABELS[role]}
          </Option>
        ))}
      </Select>
    </FormControl>
  );
}
