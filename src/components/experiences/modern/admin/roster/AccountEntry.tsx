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
import { DeleteForever, SyncLock } from "@mui/icons-material";
import { ButtonGroup, Checkbox, IconButton, Stack, Tooltip } from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

export const AccountEntry = ({
  account,
  isSelf,
  onAccountChange,
}: {
  account: Account;
  isSelf: boolean;
  onAccountChange?: () => Promise<void>;
}) => {
  const [isPromoting, setIsPromoting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [promoteError, setPromoteError] = useState<Error | null>(null);
  const [resetError, setResetError] = useState<Error | null>(null);
  const [deleteError, setDeleteError] = useState<Error | null>(null);
  /**
   * Resolve organization slug to organization ID
   */
  const resolveOrganizationId = async (): Promise<string> => {
    // Use NEXT_PUBLIC_APP_ORGANIZATION directly - inlined at build time by Next.js
    const orgSlugOrId = process.env.NEXT_PUBLIC_APP_ORGANIZATION || getAppOrganizationIdClient();

    if (!orgSlugOrId) {
      throw new Error("Organization not configured (NEXT_PUBLIC_APP_ORGANIZATION not set)");
    }

    // Try to resolve slug to ID
    const orgResult = await authClient.organization.getFullOrganization({
      query: {
        organizationSlug: orgSlugOrId,
      },
    });

    if (orgResult.data?.id) {
      return orgResult.data.id;
    }

    // If slug lookup fails, assume it's already an ID
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
  const updateOrganizationRole = async (
    userId: string,
    newRole: "member" | "dj" | "musicDirector" | "stationManager"
  ) => {
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

  return (
    <tr>
      <td
        style={{
          verticalAlign: "center",
          textAlign: "center",
        }}
      >
        <ButtonGroup>
          <Checkbox
            color={"success"}
            sx={{ transform: "translateY(3px)" }}
            checked={account.authorization == Authorization.SM}
            disabled={isSelf || isPromoting}
            onChange={async (e) => {
              if (e.target.checked) {
                if (
                  confirm(
                    `Are you sure you want to promote ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } account to Station Manager?`
                  )
                ) {
                  setIsPromoting(true);
                  setPromoteError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Update organization member role
                    await updateOrganizationRole(targetUserId, "stationManager");

                    toast.success(`${account.realName} promoted to Station Manager`);
                    if (onAccountChange) {
                      await onAccountChange();
                    }
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to promote user";
                    setPromoteError(err instanceof Error ? err : new Error(errorMessage));
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  }
                  setIsPromoting(false);
                }
              } else {
                if (
                  confirm(
                    `Are you sure you want to remove ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } access to Station Manager privileges?`
                  )
                ) {
                  setIsPromoting(true);
                  setPromoteError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Update organization member role - demote to Music Director
                    await updateOrganizationRole(targetUserId, "musicDirector");

                    toast.success(`${account.realName} role updated to Music Director`);
                    if (onAccountChange) {
                      await onAccountChange();
                    }
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to update user role";
                    setPromoteError(err instanceof Error ? err : new Error(errorMessage));
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  }
                  setIsPromoting(false);
                }
              }
            }}
          />
          <Checkbox
            disabled={
              isSelf ||
              account.authorization == Authorization.SM ||
              isPromoting
            }
            color={"success"}
            sx={{ transform: "translateY(3px)" }}
            checked={
              account.authorization == Authorization.SM ||
              account.authorization == Authorization.MD
            }
            onChange={async (e) => {
              if (e.target.checked) {
                if (
                  confirm(
                    `Are you sure you want to promote ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } account to Music Director?`
                  )
                ) {
                  setIsPromoting(true);
                  setPromoteError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Update organization member role
                    await updateOrganizationRole(targetUserId, "musicDirector");

                    toast.success(`${account.realName} promoted to Music Director`);
                    if (onAccountChange) {
                      await onAccountChange();
                    }
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to promote user";
                    setPromoteError(err instanceof Error ? err : new Error(errorMessage));
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  }
                  setIsPromoting(false);
                }
              } else {
                if (
                  confirm(
                    `Are you sure you want to remove ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } access to Music Director privileges?`
                  )
                ) {
                  setIsPromoting(true);
                  setPromoteError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Update organization member role - demote to DJ
                    await updateOrganizationRole(targetUserId, "dj");

                    toast.success(`${account.realName} role updated to DJ`);
                    if (onAccountChange) {
                      await onAccountChange();
                    }
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to update user role";
                    setPromoteError(err instanceof Error ? err : new Error(errorMessage));
                    if (errorMessage.trim().length > 0) {
                      toast.error(errorMessage);
                    }
                  }
                  setIsPromoting(false);
                }
              }
            }}
          />
        </ButtonGroup>
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
                  setResetError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Use the configured temporary password for consistency with user creation
                    const tempPassword = String(process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || "temppass123");

                    // Reset password via better-auth admin API
                    const result = await (
                      authClient.admin.updateUser as unknown as (args: {
                        userId: string;
                        data: { password: string };
                      }) => Promise<{ error?: { message?: string } | null }>
                    )({
                      userId: targetUserId,
                      data: { password: tempPassword },
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to reset password");
                    }

                    toast.success(`Password reset successfully. Temporary password: ${tempPassword}`, {
                      duration: 10000, // Show longer so admin can copy password
                    });
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
                    setResetError(err instanceof Error ? err : new Error(errorMessage));
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
                  setDeleteError(null);
                  try {
                    const targetUserId = await resolveUserId();

                    // Delete user via better-auth admin API
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
                    setDeleteError(err instanceof Error ? err : new Error(errorMessage));
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
