"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import {
  Account,
} from "@/lib/features/admin/types";
import {
  AUTHORIZATION_LABELS,
} from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { ADMIN_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import { Edit, Language, Settings } from "@mui/icons-material";
import {
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";

const CAPABILITIES = ["editor", "webmaster"] as const;
type Capability = (typeof CAPABILITIES)[number];

export const AccountEntry = ({
  account,
  isSelf,
  organizationSlug,
}: {
  account: Account;
  isSelf: boolean;
  organizationSlug: string;
}) => {
  const dispatch = useAppDispatch();
  const userCapabilities = (account.capabilities ?? []) as Capability[];

  return (
    <tr>
      <td style={{ verticalAlign: "middle" }}>
        <Stack spacing={0.5}>
          <Chip size="sm" {...ADMIN_TONES.role}>
            {AUTHORIZATION_LABELS[account.authorization]}
          </Chip>
          {userCapabilities.length > 0 && (
            <Stack direction="row" spacing={0.5}>
              {userCapabilities.includes("editor") && (
                <Chip
                  {...ADMIN_TONES.editor}
                  size="sm"
                  startDecorator={<Edit sx={{ fontSize: 14 }} />}
                >
                  Editor
                </Chip>
              )}
              {userCapabilities.includes("webmaster") && (
                <Chip
                  {...ADMIN_TONES.webmaster}
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
              <Chip {...ADMIN_TONES.newDj} size="sm">
                New
              </Chip>
            </Tooltip>
          )}
        </Stack>
      </td>
      <td>{account.userName}</td>
      <td>
        {account.djName ?? ""}
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
            onClick={() => dispatch(applicationSlice.actions.openPanel({
              type: "account-edit",
              account,
              isSelf,
              organizationSlug,
            }))}
            aria-label={`Edit ${account.realName || account.userName}`}
          >
            <Settings />
          </IconButton>
        </Tooltip>
      </td>
    </tr>
  );
};
