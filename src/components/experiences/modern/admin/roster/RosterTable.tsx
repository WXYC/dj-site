"use client";

import { authClient } from "@/lib/features/authentication/client";
import { adminSlice } from "@/lib/features/admin/frontend";
import { NewAccountParams, Authorization } from "@/lib/features/admin/types";
import { User, WXYCRole } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useAccountListResults } from "@/src/hooks/adminHooks";
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
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AccountEntry } from "./AccountEntry";
import AccountSearchForm from "./AccountSearchForm";
import ExportDJsButton from "./ExportCSV";
import NewAccountForm from "./NewAccountForm";

/**
 * Helper function to resolve organization slug to ID
 */
async function getOrganizationId(): Promise<string | null> {
  const orgSlugOrId = process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  if (!orgSlugOrId) {
    console.warn("NEXT_PUBLIC_APP_ORGANIZATION not set");
    return null;
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
}

export default function RosterTable({ user }: { user: User }) {
  const { data, isLoading, isError, error, refetch } = useAccountListResults();

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);

  const dispatch = useAppDispatch();
  const isAdding = useAppSelector(adminSlice.selectors.getAdding);
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

        const newAccount: NewAccountParams = {
          realName: (formData.get("realName") as string)?.trim() || "",
          username: (formData.get("username") as string)?.trim() || "",
          djName: formData.get("djName")
            ? (formData.get("djName") as string).trim()
            : "Anonymous",
          email: (formData.get("email") as string)?.trim() || "",
          temporaryPassword: tempPassword,
          authorization: authorizationOfNewAccount,
        };

        // Validate required fields
        if (!newAccount.realName) {
          throw new Error("Name is required");
        }
        if (!newAccount.username) {
          throw new Error("Username is required");
        }
        if (!newAccount.email) {
          throw new Error("Email is required");
        }

        // Map Authorization enum to better-auth role
        let role: WXYCRole = "member";
        if (authorizationOfNewAccount === Authorization.ADMIN) {
          role = "admin";
        } else if (authorizationOfNewAccount === Authorization.SM) {
          role = "stationManager";
        } else if (authorizationOfNewAccount === Authorization.MD) {
          role = "musicDirector";
        } else if (authorizationOfNewAccount === Authorization.DJ) {
          role = "dj";
        }
        // Better-auth types only include default roles; allow our custom roles.
        const adminRole = role as unknown as "user" | "admin" | ("user" | "admin")[];

        // Create user via better-auth admin API
        // Email will be auto-verified by the backend since admin is a trusted source
        const result = await authClient.admin.createUser({
          name: newAccount.realName || newAccount.username,
          email: newAccount.email,
          password: newAccount.temporaryPassword,
          role: adminRole,
          data: {
            username: newAccount.username,
            realName: newAccount.realName || undefined,
            djName: newAccount.djName || undefined,
          },
        });

        if (result.error) {
          throw new Error(result.error.message || "Failed to create user");
        }

        // Add user to the organization with the appropriate role
        const organizationId = await getOrganizationId();

        if (organizationId && result.data?.user?.id) {
          // Use server-side addMember API to directly add user to organization
          // This bypasses the invitation flow which requires user acceptance
          const addMemberResponse = await fetch("/api/admin/organization/add-member", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: result.data.user.id,
              organizationId,
              role,
            }),
          });

          if (!addMemberResponse.ok) {
            const errorData = await addMemberResponse.json().catch(() => ({}));
            console.error("Failed to add user to organization:", errorData);
            // Don't fail the whole operation, but log the warning
            toast.warning("User created but could not be added to organization. Role management may not work.");
          }
        } else if (!organizationId) {
          console.warn("Organization ID not configured, user created without organization membership");
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
              <th
                style={{
                  width: 160,
                  verticalAlign: "center",
                  textAlign: "center",
                }}
              >
                <Tooltip
                  title="User Role"
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
                  currentUserAuthority={user.authority}
                  onAccountChange={refetch}
                />
              ))
            )}
            {!isLoading && isAdding ? (
              <NewAccountForm currentUserAuthority={user.authority} />
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
      </form>
    </Sheet>
  );
}
