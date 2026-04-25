"use client";

import { invalidateRoster } from "@/lib/features/admin/roster-events";
import { authBaseURL, authClient } from "@/lib/features/authentication/client";
import { resolveOrganizationIdAdmin } from "@/lib/features/authentication/organization-utils";
import {
  Account,
  Authorization,
} from "@/lib/features/admin/types";
import {
  AUTHORIZATION_LABELS,
  authorizationToRole,
} from "@/lib/features/authentication/types";
import { DeleteForever, Edit, Language, Send, SyncLock } from "@mui/icons-material";
import {
  Button,
  Chip,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

type AccountEditFormProps = {
  account: Account;
  isSelf: boolean;
  onClose: () => void;
  organizationSlug: string;
};

export default function AccountEditForm({
  account,
  isSelf,
  onClose,
  organizationSlug,
}: AccountEditFormProps) {
  const [isPromoting, setIsPromoting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingCapabilities, setIsUpdatingCapabilities] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(account.email ?? "");

  const userCapabilities = (account.capabilities ?? []) as ("editor" | "webmaster")[];
  const isIncomplete = account.hasCompletedOnboarding === false;

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

  const resolveOrganizationId = async (): Promise<string> => {
    const orgId = await resolveOrganizationIdAdmin(organizationSlug);
    if (!orgId) {
      throw new Error("Organization not configured");
    }
    return orgId;
  };

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

  const updateCapabilities = async (newCapabilities: ("editor" | "webmaster")[]) => {
    const userId = await resolveUserId();

    const result = await (authClient.admin as any).updateUser({
      userId,
      data: { capabilities: newCapabilities },
    });

    if (result.error) {
      throw new Error(result.error.message || "Failed to update capabilities");
    }

    return result.data;
  };

  const handleRoleChange = async (newAuth: Authorization) => {
    if (newAuth === account.authorization) return;

    const newRole = authorizationToRole(newAuth);
    const label = AUTHORIZATION_LABELS[newAuth];

    if (!confirm(`Are you sure you want to change ${account.realName}'s role to ${label}?`)) {
      return;
    }

    setIsPromoting(true);
    try {
      const targetUserId = await resolveUserId();
      await updateOrganizationRole(targetUserId, newRole);
      toast.success(`${account.realName}'s role updated to ${label}`);
      invalidateRoster();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update role";
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
    } finally {
      setIsPromoting(false);
    }
  };

  const handleCapabilityToggle = async (capability: "editor" | "webmaster") => {
    const hasCapability = userCapabilities.includes(capability);
    const newCapabilities = hasCapability
      ? userCapabilities.filter((c) => c !== capability)
      : [...userCapabilities, capability];

    const action = hasCapability ? "remove" : "grant";
    const confirmMessage = `Are you sure you want to ${action} the "${capability}" capability ${hasCapability ? "from" : "to"} ${account.realName}?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsUpdatingCapabilities(true);
    try {
      await updateCapabilities(newCapabilities);
      toast.success(
        `${capability} capability ${hasCapability ? "removed from" : "granted to"} ${account.realName}`
      );
      invalidateRoster();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update capabilities";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingCapabilities(false);
    }
  };

  const handleEmailUpdate = async () => {
    if (!newEmail || newEmail === account.email) {
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to change ${account.realName}'s email to ${newEmail}? This will take effect immediately without verification.`
    );

    if (!confirmed) {
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const targetUserId = await resolveUserId();

      const result = await authClient.admin.updateUser({
        userId: targetUserId,
        data: { email: newEmail, emailVerified: true },
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to update email");
      }

      toast.success(`Email updated to ${newEmail}`);
      invalidateRoster();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update email";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!confirm("Are you sure you want to reset this user's password?")) {
      return;
    }

    setIsResetting(true);
    try {
      const targetUserId = await resolveUserId();

      const tempPassword =
        process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || crypto.randomUUID().replace(/-/g, "").slice(0, 16);

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
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${account.realName}'s account?`)) {
      return;
    }

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
      onClose();
      invalidateRoster();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete account";
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!account.email) {
      toast.error("No email address on file.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const targetUserId = await resolveUserId();

      // Un-verify the email so the verification endpoint will send a new email
      await authClient.admin.updateUser({
        userId: targetUserId,
        data: { emailVerified: false },
      });

      const response = await fetch(`${authBaseURL}/send-verification-email`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          callbackURL: "/login",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invite email");
      }

      toast.success(`Invite email sent to ${account.email}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invite email";
      toast.error(errorMessage);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!account.email) {
      toast.error("No email address on file.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;

      const result = await authClient.requestPasswordReset({
        email: account.email,
        redirectTo,
      });

      if ((result as any).error) {
        throw new Error((result as any).error.message || "Failed to send password reset");
      }

      toast.success(`Password reset email sent to ${account.email}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send password reset email";
      toast.error(errorMessage);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ mt: 1 }}>
      {/* Role */}
      <FormControl>
        <FormLabel>Role</FormLabel>
        <Select
          size="sm"
          color="success"
          value={account.authorization}
          disabled={isSelf || isPromoting}
          onChange={(_, newValue) => {
            if (newValue !== null) handleRoleChange(newValue as Authorization);
          }}
          slotProps={{
            button: { sx: { whiteSpace: "nowrap" } },
            listbox: { sx: { zIndex: 10001 } },
          }}
        >
          <Option value={Authorization.NO}>Member</Option>
          <Option value={Authorization.DJ}>DJ</Option>
          <Option value={Authorization.MD}>Music Director</Option>
          <Option value={Authorization.SM}>Station Manager</Option>
        </Select>
        {isSelf && (
          <Typography level="body-xs" sx={{ mt: 0.5 }}>
            You cannot change your own role.
          </Typography>
        )}
      </FormControl>

      {/* Capabilities */}
      <FormControl>
        <FormLabel>Capabilities</FormLabel>
        <Stack direction="row" spacing={1}>
          <Tooltip
            title={
              isSelf
                ? "You cannot modify your own capabilities"
                : userCapabilities.includes("editor")
                  ? "Remove editor capability"
                  : "Grant editor capability (allows website editing)"
            }
            arrow
            placement="top"
            variant="outlined"
            size="sm"
          >
            <Chip
              variant={userCapabilities.includes("editor") ? "solid" : "outlined"}
              color={userCapabilities.includes("editor") ? "success" : "neutral"}
              size="md"
              startDecorator={<Edit sx={{ fontSize: 16 }} />}
              onClick={() => !isSelf && handleCapabilityToggle("editor")}
              disabled={isSelf || isUpdatingCapabilities}
              sx={{
                cursor: isSelf ? "not-allowed" : "pointer",
                opacity: isUpdatingCapabilities ? 0.5 : 1,
              }}
            >
              Editor
            </Chip>
          </Tooltip>
          <Tooltip
            title={
              isSelf
                ? "You cannot modify your own capabilities"
                : userCapabilities.includes("webmaster")
                  ? "Remove webmaster capability"
                  : "Grant webmaster capability (can delegate editor)"
            }
            arrow
            placement="top"
            variant="outlined"
            size="sm"
          >
            <Chip
              variant={userCapabilities.includes("webmaster") ? "solid" : "outlined"}
              color={userCapabilities.includes("webmaster") ? "primary" : "neutral"}
              size="md"
              startDecorator={<Language sx={{ fontSize: 16 }} />}
              onClick={() => !isSelf && handleCapabilityToggle("webmaster")}
              disabled={isSelf || isUpdatingCapabilities}
              sx={{
                cursor: isSelf ? "not-allowed" : "pointer",
                opacity: isUpdatingCapabilities ? 0.5 : 1,
              }}
            >
              Webmaster
            </Chip>
          </Tooltip>
        </Stack>
      </FormControl>

      {/* Email */}
      <FormControl>
        <FormLabel>Email</FormLabel>
        <Stack direction="row" spacing={1} alignItems="center">
          <Input
            size="sm"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isSelf || isUpdatingEmail}
            sx={{ flex: 1 }}
          />
          {!isSelf && newEmail !== account.email && (
            <Button
              size="sm"
              color="success"
              variant="solid"
              loading={isUpdatingEmail}
              onClick={handleEmailUpdate}
            >
              Save
            </Button>
          )}
        </Stack>
      </FormControl>

      <Divider />

      {/* Account actions */}
      <Stack spacing={1.5}>
        <Typography level="title-sm">Account Actions</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {!isSelf && (
            <Button
              size="sm"
              color="primary"
              variant="solid"
              startDecorator={<Send />}
              disabled={isSendingEmail}
              loading={isSendingEmail}
              onClick={isIncomplete ? handleSendInvite : handleSendPasswordReset}
            >
              {isIncomplete ? "Send Invite" : "Send Password Reset"}
            </Button>
          )}
          <Button
            size="sm"
            color="success"
            variant="solid"
            startDecorator={<SyncLock />}
            disabled={isSelf || isResetting}
            loading={isResetting}
            onClick={handlePasswordReset}
          >
            Reset Password
          </Button>
          <Button
            size="sm"
            color="danger"
            variant="outlined"
            startDecorator={<DeleteForever />}
            disabled={isSelf || isDeleting}
            loading={isDeleting}
            onClick={handleDelete}
          >
            Delete Account
          </Button>
        </Stack>
        {isSelf && (
          <Typography level="body-xs">
            You cannot modify your own account from here.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
