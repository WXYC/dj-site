"use client";

import { useCreateAccountMutation } from "@/lib/features/admin/api";
import { adminSlice } from "@/lib/features/admin/frontend";
import { NewAccountParams, Authorization } from "@/lib/features/admin/types";
import { authorizationToRole } from "@/lib/features/authentication/types";
import { useRegisterDJMutation } from "@/lib/features/authentication/api";
import { User } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useAccountListResults, useCreateUserAccount } from "@/src/hooks/adminHooks";
import { Add, GppBad } from "@mui/icons-material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  Button,
  CircularProgress,
  Sheet,
  Stack,
  Table,
  Tooltip,
  Typography,
} from "@mui/joy";
import { useCallback, useEffect } from "react";
import { AccountEntry } from "./AccountEntry";
import AccountSearchForm from "./AccountSearchForm";
import ExportDJsButton from "./ExportCSV";
import NewAccountForm from "./NewAccountForm";

export default function RosterTable({ user }: { user: User }) {
  const { data, isLoading, isError, error } = useAccountListResults();

  // Use the new better-auth user creation hook
  const { createUserAccount, creating } = useCreateUserAccount();
  
  // Keep the old mutations for backward compatibility if needed
  const [addAccount, addAccountResult] = useCreateAccountMutation();
  const [registerDJ, registerDJResult] = useRegisterDJMutation();

  const dispatch = useAppDispatch();
  const isAdding = useAppSelector(adminSlice.selectors.getAdding);

  const authorizationOfNewAccount = useAppSelector(
    adminSlice.selectors.getFormData
  ).authorization;

  const handleAddAccount = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);

      const userData = {
        realName: formData.get("realName") as string,
        username: formData.get("username") as string,
        djName: formData.get("djName") as string || undefined,
        email: formData.get("email") as string,
        role: authorizationToRole(authorizationOfNewAccount), // Convert Authorization enum to organization role
      };

      // Use the new better-auth user creation
      const result = await createUserAccount(userData);
      
      if (result.success) {
        // Register DJ in the legacy system if needed
        try {
          await registerDJ({
            cognito_user_name: userData.username,
            real_name: userData.realName,
            dj_name: userData.djName || userData.realName,
          });
        } catch (error) {
          console.warn("[RosterTable] DJ registration failed:", error);
          // Don't fail the whole process if DJ registration fails
        }
        
        // Reset the form
        dispatch(adminSlice.actions.setAdding(false));
        dispatch(adminSlice.actions.reset());
      }
      
      return result;
    },
    [authorizationOfNewAccount, createUserAccount, registerDJ, dispatch]
  );

  useEffect(() => {
    if (addAccountResult.isSuccess) {
      dispatch(adminSlice.actions.setAdding(false));
      dispatch(adminSlice.actions.reset());
    }
  }, [addAccountResult.isSuccess, dispatch]);

  return (
    <Sheet
      sx={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        bgcolor: "transparent",
        "--Table-lastColumnWidth": "120px",
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ py: 2, justifyContent: "space-between" }}
      >
        <AccountSearchForm />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: {
              xs: 2,
              lg: 0,
            },
          }}
        >
          <ExportDJsButton />
          <Button
            variant="solid"
            color={"success"}
            size="sm"
            disabled={isAdding}
            onClick={() => dispatch(adminSlice.actions.setAdding(true))}
          >
            Add DJ
          </Button>
        </Stack>
      </Stack>
      <form onSubmit={handleAddAccount}>
        <Table
          stripe="odd"
          sx={{
            fontWeight: "sm",
            textAlign: "left",
            "& tr > *:last-child": {
              position: "sticky",
              right: 0,
            },
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: 55,
                  verticalAlign: "center",
                  textAlign: "center",
                }}
              >
                <Tooltip
                  title="Toggle Admin Status"
                  arrow={true}
                  placement="top"
                  variant="outlined"
                  size="sm"
                >
                  <AdminPanelSettingsIcon />
                </Tooltip>
              </th>
              <th style={{ minWidth: "100px" }}>Name</th>
              <th style={{ minWidth: "100px" }}>Username</th>
              <th style={{ minWidth: "100px" }}>DJ Name</th>
              <th style={{ minWidth: "100px" }}>Email</th>
              <th
                aria-label="last"
                style={{ width: "var(--Table-lastColumnWidth)" }}
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", paddingTop: "2rem" }}
                >
                  <CircularProgress color={"success"} />
                </td>
              </tr>
            ) : isError ? (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", paddingTop: "2rem" }}
                >
                  <GppBad color="error" sx={{ fontSize: "5rem" }} />
                  <Typography level="body-md" sx={{ pb: 2 }}>
                    Something has gone wrong with the admin panel. Please try
                    again later.
                  </Typography>
                  <Typography level="body-sm">{String(error)}</Typography>
                </td>
              </tr>
            ) : (
              data.map((dj) => (
                <AccountEntry
                  key={`roster-entry-${dj.userName}`}
                  account={dj}
                  isSelf={dj.userName === user.username}
                />
              ))
            )}
            {!isLoading && isAdding ? (
              <NewAccountForm />
            ) : (
              <tr>
                <td colSpan={5}></td>
                <td
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    size="sm"
                    color="success"
                    startDecorator={<Add />}
                    onClick={() => dispatch(adminSlice.actions.setAdding(true))}
                  >
                    Add
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </form>
    </Sheet>
  );
}
