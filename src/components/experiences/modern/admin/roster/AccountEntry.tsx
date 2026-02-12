"use client";

import { authClient } from "@/lib/features/authentication/client";
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
  const [, setPromoteError] = useState<Error | null>(null);
  const [, setResetError] = useState<Error | null>(null);
  const [, setDeleteError] = useState<Error | null>(null);
  const toAdminRole = (
    role: "member" | "dj" | "musicDirector" | "stationManager"
  ) =>
    (role === "stationManager" ? "admin" : "user") as
      | "user"
      | "admin"
      | ("user" | "admin")[];
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
          verticalAlign: "middle",
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

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: toAdminRole("stationManager"),
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to promote user");
                    }

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
                  } finally {
                    setIsPromoting(false);
                  }
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

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: toAdminRole("musicDirector"),
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to update user role");
                    }

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
                  } finally {
                    setIsPromoting(false);
                  }
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

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: toAdminRole("musicDirector"),
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to promote user");
                    }

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
                  } finally {
                    setIsPromoting(false);
                  }
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

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: toAdminRole("dj"),
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to update user role");
                    }

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
                  } finally {
                    setIsPromoting(false);
                  }
                }
              }
            }}
          />
        </ButtonGroup>
      </td>
      <td>{account.realName}</td>
      <td>{account.userName}</td>
      <td>
        {account.djName && account.djName.length > 0 && "DJ"} {account.djName ?? ""}
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

                    // Generate a temporary password
                    const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

                    // Reset password via better-auth admin API
                    const result = await (
                      authClient.admin.updateUser as unknown as (args: {
                        userId: string;
                        password: string;
                      }) => Promise<{ error?: { message?: string } | null }>
                    )({
                      userId: targetUserId,
                      password: tempPassword,
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
