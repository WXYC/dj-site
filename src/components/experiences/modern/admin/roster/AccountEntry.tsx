"use client";

import { authClient } from "@/lib/features/authentication/client";
import {
  getAppOrganizationIdClient,
} from "@/lib/features/authentication/organization-utils";
import {
  Account,
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";
import { WXYCRole } from "@/lib/features/authentication/types";
import { DeleteForever, SyncLock } from "@mui/icons-material";
import { IconButton, Option, Select, Stack, Tooltip } from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

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
 * Get the roles that a user with the given authority can assign.
 */
function getAssignableRoles(authority: Authorization): WXYCRole[] {
  if (authority >= Authorization.ADMIN) {
    return [...ALL_ROLES];
  }
  if (authority >= Authorization.SM) {
    // Station managers can assign all roles except admin
    return ["stationManager", "musicDirector", "dj", "member"];
  }
  return [];
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

export const AccountEntry = ({
  account,
  isSelf,
  currentUserAuthority,
  onAccountChange,
}: {
  account: Account;
  isSelf: boolean;
  currentUserAuthority: Authorization;
  onAccountChange?: () => Promise<void>;
}) => {
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentRole = authorizationToRole(account.authorization);
  const assignableRoles = getAssignableRoles(currentUserAuthority);
  const canChangeRole = !isSelf && assignableRoles.length > 0;

  /**
   * Resolve organization slug to organization ID
   */
  const resolveOrganizationId = async (): Promise<string> => {
    const orgSlugOrId = process.env.NEXT_PUBLIC_APP_ORGANIZATION || getAppOrganizationIdClient();

    if (!orgSlugOrId) {
      throw new Error("Organization not configured (NEXT_PUBLIC_APP_ORGANIZATION not set)");
    }

    const orgResult = await authClient.organization.getFullOrganization({
      query: {
        organizationSlug: orgSlugOrId,
      },
    });

    if (orgResult.data?.id) {
      return orgResult.data.id;
    }

    return orgSlugOrId;
  };

  /**
   * Get the member ID for a user in the organization
   */
  const resolveMemberId = async (userId: string, organizationId: string): Promise<string> => {
    const result = await authClient.organization.listMembers({
      query: {
        organizationId,
        filterField: "userId",
        filterOperator: "eq",
        filterValue: userId,
        limit: 1,
      },
    });

    if (result.error) {
      throw new Error(result.error.message || "Failed to fetch member");
    }

    const member = result.data?.members?.find((m: { userId: string }) => m.userId === userId);
    if (!member) {
      throw new Error("User is not a member of the organization");
    }

    return member.id;
  };

  /**
   * Update user's role in the organization
   */
  const updateOrganizationRole = async (userId: string, newRole: WXYCRole) => {
    const organizationId = await resolveOrganizationId();
    const memberId = await resolveMemberId(userId, organizationId);

    const result = await authClient.organization.updateMemberRole({
      memberId,
      organizationId,
      role: newRole,
    });

    if (result.error) {
      throw new Error(result.error.message || "Failed to update role");
    }

    return result;
  };

  const resolveUserId = async () => {
    if (account.id) {
      return account.id;
    }

    const listResult = await authClient.admin.listUsers({
      query: {
        searchValue: account.email || account.userName,
        searchField: account.email ? "email" : "name",
        limit: 1,
      },
    });

    if (
      listResult.error ||
      !listResult.data?.users ||
      listResult.data.users.length === 0
    ) {
      throw new Error(`User with username ${account.userName} not found`);
    }

    return listResult.data.users[0].id;
  };

  const handleRoleChange = async (newRole: WXYCRole | null) => {
    if (!newRole || newRole === currentRole) return;

    // Prevent non-admins from promoting to admin
    if (newRole === "admin" && currentUserAuthority < Authorization.ADMIN) {
      toast.error("Only admins can promote users to admin");
      return;
    }

    const roleName = ROLE_DISPLAY_NAMES[newRole];
    const confirmed = confirm(
      `Are you sure you want to change ${account.realName}${
        account.realName.length > 0 ? "'s" : ""
      } role to ${roleName}?`
    );

    if (!confirmed) return;

    setIsUpdatingRole(true);
    try {
      const targetUserId = await resolveUserId();
      await updateOrganizationRole(targetUserId, newRole);

      toast.success(`${account.realName} role updated to ${roleName}`);
      if (onAccountChange) {
        await onAccountChange();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update role";
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
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
          disabled={!canChangeRole || isUpdatingRole}
          size="sm"
          sx={{ minWidth: 140 }}
        >
          {assignableRoles.map((role) => (
            <Option key={role} value={role}>
              {ROLE_DISPLAY_NAMES[role]}
            </Option>
          ))}
          {/* Show current role even if not assignable (e.g., viewing admin as SM) */}
          {!assignableRoles.includes(currentRole) && (
            <Option key={currentRole} value={currentRole} disabled>
              {ROLE_DISPLAY_NAMES[currentRole]}
            </Option>
          )}
        </Select>
      </td>
      <td>{account.realName}</td>
      <td>{account.userName}</td>
      <td>
        {account.djName.length > 0 && "DJ"} {account.djName}
      </td>
      <td>{account.email}</td>
      <td>
        <Stack direction="row" spacing={0.5}>
          <Tooltip
            title={`Reset ${account.realName}${
              account.realName.length > 0 ? "'s" : ""
            } Password`}
            arrow={true}
            placement="top"
            variant="outlined"
            size="sm"
          >
            <IconButton
              color={"success"}
              variant="solid"
              size="sm"
              disabled={
                account.authType != AdminAuthenticationStatus.Confirmed ||
                isSelf ||
                isResetting
              }
              loading={isResetting}
              onClick={async () => {
                if (
                  confirm(
                    "Are you sure you want to reset this user's password?"
                  )
                ) {
                  setIsResetting(true);
                  try {
                    const targetUserId = await resolveUserId();

                    const tempPassword = String(process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || "temppass123");

                    const result = await authClient.admin.setUserPassword({
                      userId: targetUserId,
                      newPassword: tempPassword,
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to reset password");
                    }

                    toast.success(`Password reset successfully. Temporary password: ${tempPassword}`, {
                      duration: 10000,
                    });
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  } finally {
                    setIsResetting(false);
                  }
                }
              }}
            >
              <SyncLock />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              !isSelf
                ? `Delete ${account.realName}${
                    account.realName.length > 0 ? "'s" : ""
                  } Profile`
                : `You cannot delete yourself!`
            }
            arrow={true}
            placement="top"
            variant="outlined"
            size="sm"
          >
            <IconButton
              color="warning"
              variant="outlined"
              size="sm"
              disabled={isSelf || isDeleting}
              loading={isDeleting}
              onClick={async () => {
                if (
                  confirm(
                    `Are you sure you want to delete ${account.realName}'s account?`
                  )
                ) {
                  setIsDeleting(true);
                  try {
                    const targetUserId = await resolveUserId();

                    const result = await authClient.admin.removeUser({
                      userId: targetUserId,
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to delete user");
                    }

                    toast.success(`${account.realName}'s account deleted successfully`);
                    if (onAccountChange) {
                      await onAccountChange();
                    }
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to delete account";
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  } finally {
                    setIsDeleting(false);
                  }
                }
              }}
            >
              <DeleteForever />
            </IconButton>
          </Tooltip>
        </Stack>
      </td>
    </tr>
  );
};
