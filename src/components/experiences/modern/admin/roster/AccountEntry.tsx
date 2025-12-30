"use client";

import { authClient } from "@/lib/features/authentication/client";
import {
  Account,
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";
import { useDeleteDJInfoMutation } from "@/lib/features/authentication/api";
import { DeleteForever, SyncLock } from "@mui/icons-material";
import { ButtonGroup, Checkbox, IconButton, Stack, Tooltip } from "@mui/joy";
import { useState } from "react";

export const AccountEntry = ({
  account,
  isSelf,
}: {
  account: Account;
  isSelf: boolean;
}) => {
  const [clearInfo, clearResult] = useDeleteDJInfoMutation();
  const [isPromoting, setIsPromoting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [promoteError, setPromoteError] = useState<Error | null>(null);
  const [resetError, setResetError] = useState<Error | null>(null);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

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
            disabled={isSelf || promoteResult.isLoading}
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: "stationManager",
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to promote user");
                    }

                    window.location.reload();
                  } catch (err) {
                    setPromoteError(err instanceof Error ? err : new Error(String(err)));
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: "musicDirector",
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to update user role");
                    }

                    window.location.reload();
                  } catch (err) {
                    setPromoteError(err instanceof Error ? err : new Error(String(err)));
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: "musicDirector",
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to promote user");
                    }

                    window.location.reload();
                  } catch (err) {
                    setPromoteError(err instanceof Error ? err : new Error(String(err)));
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Update user role
                    const result = await authClient.admin.setRole({
                      userId: targetUserId,
                      role: "dj",
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to update user role");
                    }

                    window.location.reload();
                  } catch (err) {
                    setPromoteError(err instanceof Error ? err : new Error(String(err)));
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Generate a temporary password
                    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

                    // Reset password via better-auth admin API
                    const result = await authClient.admin.updateUser({
                      userId: targetUserId,
                      password: tempPassword,
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to reset password");
                    }

                    alert(`Password reset successfully. Temporary password: ${tempPassword}`);
                  } catch (err) {
                    setResetError(err instanceof Error ? err : new Error(String(err)));
                    alert(err instanceof Error ? err.message : "Failed to reset password");
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
                    // Find user by username
                    const listResult = await authClient.admin.listUsers({
                      query: {
                        searchValue: account.userName,
                        searchField: "name",
                        limit: 1,
                      },
                    });

                    if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
                      throw new Error(`User with username ${account.userName} not found`);
                    }

                    const targetUserId = listResult.data.users[0].id;

                    // Delete user via better-auth admin API
                    const result = await authClient.admin.deleteUser({
                      userId: targetUserId,
                    });

                    if (result.error) {
                      throw new Error(result.error.message || "Failed to delete user");
                    }

                    // Clear DJ info
                    await clearInfo(account.userName);

                    window.location.reload();
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err : new Error(String(err)));
                    alert(err instanceof Error ? err.message : "Failed to delete account");
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
