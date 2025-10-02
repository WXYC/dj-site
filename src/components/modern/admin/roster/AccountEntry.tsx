"use client";

import {
  useDeleteAccountMutation,
  usePromoteAccountMutation,
  useResetPasswordMutation,
} from "@/lib/features/admin/api";
import {
  Account,
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";
import { useDeleteDJInfoMutation } from "@/lib/features/authentication/api";
import { DeleteForever, SyncLock } from "@mui/icons-material";
import { ButtonGroup, Checkbox, IconButton, Stack, Tooltip } from "@mui/joy";

export const AccountEntry = ({
  account,
  isSelf,
}: {
  account: Account;
  isSelf: boolean;
}) => {
  const [promoteAccount, promoteResult] = usePromoteAccountMutation();
  const [resetPassword, resetResult] = useResetPasswordMutation();
  const [deleteAccount, deleteResult] = useDeleteAccountMutation();
  const [clearInfo, clearResult] = useDeleteDJInfoMutation();

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
            onChange={(e) => {
              if (e.target.checked) {
                if (
                  confirm(
                    `Are you sure you want to promote ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } account to Station Manager?`
                  )
                ) {
                  promoteAccount({
                    username: account.userName,
                    currentAuthorization: account.authorization,
                    nextAuthorization: Authorization.SM,
                  });
                }
              } else {
                if (
                  confirm(
                    `Are you sure you want to remove ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } access to Station Manager privileges?`
                  )
                ) {
                  promoteAccount({
                    username: account.userName,
                    currentAuthorization: account.authorization,
                    nextAuthorization: Authorization.MD,
                  });
                }
              }
            }}
          />
          <Checkbox
            disabled={
              isSelf ||
              account.authorization == Authorization.SM ||
              promoteResult.isLoading
            }
            color={"success"}
            sx={{ transform: "translateY(3px)" }}
            checked={
              account.authorization == Authorization.SM ||
              account.authorization == Authorization.MD
            }
            onChange={(e) => {
              if (e.target.checked) {
                if (
                  confirm(
                    `Are you sure you want to promote ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } account to Music Director?`
                  )
                ) {
                  promoteAccount({
                    username: account.userName,
                    currentAuthorization: account.authorization,
                    nextAuthorization: Authorization.MD,
                  });
                }
              } else {
                if (
                  confirm(
                    `Are you sure you want to remove ${account.realName}${
                      account.realName.length > 0 ? "'s" : ""
                    } access to Music Director privileges?`
                  )
                ) {
                  promoteAccount({
                    username: account.userName,
                    currentAuthorization: account.authorization,
                    nextAuthorization: Authorization.DJ,
                  });
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
                resetResult.isSuccess
              }
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to reset this user's password?"
                  )
                ) {
                  resetPassword(account.userName);
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
              disabled={isSelf || deleteResult.isSuccess}
              loading={deleteResult.isLoading}
              onClick={() => {
                if (
                  confirm(
                    `Are you sure you want to delete ${account.realName}'s account?`
                  )
                ) {
                  deleteAccount(account.userName).then(async () => {
                    return await clearInfo({ username: account.userName });
                  });
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
