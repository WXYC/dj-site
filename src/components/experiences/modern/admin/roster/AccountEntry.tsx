"use client";

import {
  Account,
} from "@/lib/features/admin/types";
import {
  AUTHORIZATION_LABELS,
} from "@/lib/features/authentication/types";
import { Edit, Language, Settings } from "@mui/icons-material";
import {
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";
import { useState } from "react";
import AccountEditModal from "./AccountEditModal";

const CAPABILITIES = ["editor", "webmaster"] as const;
type Capability = (typeof CAPABILITIES)[number];

export const AccountEntry = ({
  account,
  isSelf,
  onAccountChange,
  organizationSlug,
}: {
  account: Account;
  isSelf: boolean;
  onAccountChange?: () => Promise<void>;
  organizationSlug: string;
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const userCapabilities = (account.capabilities ?? []) as Capability[];

  return (
    <>
      <tr>
        <td style={{ verticalAlign: "middle" }}>
          <Stack spacing={0.5}>
            <Chip
              size="sm"
              variant="soft"
              color="success"
            >
              {AUTHORIZATION_LABELS[account.authorization]}
            </Chip>
            {userCapabilities.length > 0 && (
              <Stack direction="row" spacing={0.5}>
                {userCapabilities.includes("editor") && (
                  <Chip
                    variant="solid"
                    color="success"
                    size="sm"
                    startDecorator={<Edit sx={{ fontSize: 14 }} />}
                  >
                    Editor
                  </Chip>
                )}
                {userCapabilities.includes("webmaster") && (
                  <Chip
                    variant="solid"
                    color="primary"
                    size="sm"
                    startDecorator={<Language sx={{ fontSize: 14 }} />}
                  >
                    Webmaster
                  </Chip>
                )}
              </Stack>
            )}
          </Stack>
        </td>
        <td>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <span>{account.realName}</span>
            {account.hasCompletedOnboarding === false && (
              <Tooltip
                title="Has not completed onboarding"
                arrow
                placement="top"
                variant="outlined"
                size="sm"
              >
                <Chip variant="soft" color="warning" size="sm">
                  New
                </Chip>
              </Tooltip>
            )}
          </Stack>
        </td>
        <td>{account.userName}</td>
        <td>
          {account.djName && account.djName.length > 0 && "DJ"} {account.djName ?? ""}
        </td>
        <td>{account.email}</td>
        <td>
          <Tooltip
            title={`Edit ${account.realName || account.userName}`}
            arrow
            placement="top"
            variant="outlined"
            size="sm"
          >
            <IconButton
              color="success"
              variant="solid"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              aria-label={`Edit ${account.realName || account.userName}`}
            >
              <Settings />
            </IconButton>
          </Tooltip>
        </td>
      </tr>
      <AccountEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        account={account}
        isSelf={isSelf}
        onAccountChange={onAccountChange}
        organizationSlug={organizationSlug}
      />
    </>
  );
};
