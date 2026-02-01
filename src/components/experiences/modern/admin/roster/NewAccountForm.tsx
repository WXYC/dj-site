"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";
import { WXYCRole } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PersonAdd } from "@mui/icons-material";
import { Button, Input, Option, Select } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";

/**
 * All WXYC roles in display order (highest privilege first).
 */
const ALL_ROLES: WXYCRole[] = ["admin", "stationManager", "musicDirector", "dj", "member"];

/**
 * Display names for roles.
 */
const ROLE_DISPLAY_NAMES: Record<WXYCRole, string> = {
  admin: "Admin",
  stationManager: "Station Manager",
  musicDirector: "Music Director",
  dj: "DJ",
  member: "Member",
};

/**
 * Map WXYCRole to Authorization enum.
 */
function roleToAuthorization(role: WXYCRole): Authorization {
  switch (role) {
    case "admin":
      return Authorization.ADMIN;
    case "stationManager":
      return Authorization.SM;
    case "musicDirector":
      return Authorization.MD;
    case "dj":
      return Authorization.DJ;
    case "member":
    default:
      return Authorization.NO;
  }
}

/**
 * Map Authorization enum to WXYCRole.
 */
function authorizationToRole(auth: Authorization): WXYCRole {
  switch (auth) {
    case Authorization.ADMIN:
      return "admin";
    case Authorization.SM:
      return "stationManager";
    case Authorization.MD:
      return "musicDirector";
    case Authorization.DJ:
      return "dj";
    case Authorization.NO:
    default:
      return "member";
  }
}

/**
 * Get the roles that a user with the given authority can assign.
 */
function getAssignableRoles(authority: Authorization): WXYCRole[] {
  if (authority >= Authorization.ADMIN) {
    return [...ALL_ROLES];
  }
  if (authority >= Authorization.SM) {
    return ["stationManager", "musicDirector", "dj", "member"];
  }
  return [];
}

export default function NewAccountForm({
  currentUserAuthority,
}: {
  currentUserAuthority: Authorization;
}) {
  const dispatch = useAppDispatch();

  const authorizationOfNewAccount = useAppSelector(
    adminSlice.selectors.getFormData
  ).authorization;

  const currentRole = authorizationToRole(authorizationOfNewAccount);
  const assignableRoles = getAssignableRoles(currentUserAuthority);

  const handleRoleChange = (newRole: WXYCRole | null) => {
    if (newRole) {
      dispatch(adminSlice.actions.setFormData({ authorization: roleToAuthorization(newRole) }));
    }
  };

  return (
    <ClickAwayListener
      onClickAway={() => dispatch(adminSlice.actions.setAdding(false))}
    >
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <Select
            value={currentRole}
            onChange={(_, value) => handleRoleChange(value)}
            size="sm"
            sx={{ minWidth: 140 }}
          >
            {assignableRoles.map((role) => (
              <Option key={role} value={role}>
                {ROLE_DISPLAY_NAMES[role]}
              </Option>
            ))}
          </Select>
        </td>
        <td>
          <Input
            name={"realName"}
            size="sm"
            color="success"
            placeholder="Name"
            autoFocus
            required
          />
        </td>
        <td>
          <Input
            name={"username"}
            size="sm"
            color="success"
            placeholder="Username"
            required
          />
        </td>
        <td>
          <Input
            name={"djName"}
            size="sm"
            color="success"
            placeholder="DJ Name (Optional)"
            required={false}
          />
        </td>
        <td>
          <Input
            name={"email"}
            size="sm"
            color="success"
            placeholder="Email"
            required
            type="email"
          />
        </td>
        <td
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            size="sm"
            color="success"
            startDecorator={<PersonAdd />}
            type="submit"
          >
            Save
          </Button>
        </td>
      </tr>
    </ClickAwayListener>
  );
}
