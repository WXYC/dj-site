"use client";

import { authBaseURL } from "@/lib/features/authentication/client";
import { adminSlice } from "@/lib/features/admin/frontend";
import { NewAccountParams, Authorization, ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";
import { User, authorizationToRole } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useAccountListResults } from "@/src/hooks/adminHooks";
import { Add, GppBad, KeyboardArrowLeft, KeyboardArrowRight, Upload } from "@mui/icons-material";
import {
  Button,
  CircularProgress,
  IconButton,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AccountEntry } from "./AccountEntry";
import AccountSearchForm from "./AccountSearchForm";
import ExportDJsButton from "./ExportCSV";
import ImportCSVModal from "./ImportCSVModal";
import NewAccountForm from "./NewAccountForm";

export default function RosterTable({ user, organizationSlug }: { user: User; organizationSlug: string }) {
  const { data, isLoading, isError, error, refetch } = useAccountListResults();

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const dispatch = useAppDispatch();
  const isAdding = useAppSelector(adminSlice.selectors.getAdding);
  const page = useAppSelector(adminSlice.selectors.getPage);
  const totalAccounts = useAppSelector(adminSlice.selectors.getTotalAccounts);
  const totalPages = Math.max(1, Math.ceil(totalAccounts / ROSTER_PAGE_SIZE));
  const canCreateUser = user.authority >= Authorization.SM;

  const authorizationOfNewAccount = useAppSelector(
    adminSlice.selectors.getFormData
  ).authorization;

  const handleAddAccount = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsCreating(true);
      setCreateError(null);

      try {
        if (!canCreateUser) {
          throw new Error("You do not have permission to add users.");
        }

        const formData = new FormData(e.currentTarget);

        const tempPassword = String(
          process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || ""
        );

        if (!tempPassword) {
          throw new Error("Missing onboarding temp password configuration.");
        }

        if (!organizationSlug) {
          throw new Error("Organization not configured.");
        }

        const newAccount: NewAccountParams = {
          realName: formData.get("realName") as string,
          username: formData.get("username") as string,
          djName: formData.get("djName")
            ? (formData.get("djName") as string)
            : "Anonymous",
          email: formData.get("email") as string,
          temporaryPassword: tempPassword,
          authorization: authorizationOfNewAccount,
        };

        const role = authorizationToRole(authorizationOfNewAccount);

        const response = await fetch(`${authBaseURL}/admin/provision-user`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: newAccount.email,
            username: newAccount.username,
            password: newAccount.temporaryPassword,
            name: newAccount.realName || newAccount.username,
            organizationSlug,
            role,
            realName: newAccount.realName || undefined,
            djName: newAccount.djName || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || errorData?.error || `Failed to create user (${response.status})`);
        }

        toast.success(`Account created successfully for ${newAccount.username}`);

        dispatch(adminSlice.actions.setAdding(false));
        dispatch(adminSlice.actions.reset());

        // Refresh account list
        await refetch();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create account";
        setCreateError(err instanceof Error ? err : new Error(errorMessage));
        if (errorMessage.trim().length > 0) {
          toast.error(errorMessage);
        }
      } finally {
        setIsCreating(false);
      }
    },
    [authorizationOfNewAccount, canCreateUser, dispatch, refetch]
  );

  return (
    <Sheet
      sx={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        bgcolor: "transparent",
        "--Table-lastColumnWidth": "60px",
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
            variant="outlined"
            color="success"
            size="sm"
            disabled={!canCreateUser}
            startDecorator={<Upload />}
            onClick={() => setImportModalOpen(true)}
          >
            Import CSV
          </Button>
          <Button
            variant="solid"
            color={"success"}
            size="sm"
            disabled={isAdding || !canCreateUser}
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
              <th style={{ minWidth: "120px" }}>Role</th>
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
                  onAccountChange={refetch}
                  organizationSlug={organizationSlug}
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
                    disabled={!canCreateUser}
                  >
                    Add
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        {!isLoading && totalPages > 1 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ py: 2, justifyContent: "center", alignItems: "center" }}
          >
            <IconButton
              size="sm"
              color="success"
              variant="outlined"
              disabled={page === 0}
              onClick={() => dispatch(adminSlice.actions.setPage(page - 1))}
              aria-label="Previous page"
            >
              <KeyboardArrowLeft />
            </IconButton>
            <Typography level="body-sm">
              Page {page + 1} of {totalPages}
            </Typography>
            <IconButton
              size="sm"
              color="success"
              variant="outlined"
              disabled={page >= totalPages - 1}
              onClick={() => dispatch(adminSlice.actions.setPage(page + 1))}
              aria-label="Next page"
            >
              <KeyboardArrowRight />
            </IconButton>
          </Stack>
        )}
      </form>
      <ImportCSVModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onComplete={() => {
          setImportModalOpen(false);
          refetch();
        }}
        organizationSlug={organizationSlug}
      />
    </Sheet>
  );
}
