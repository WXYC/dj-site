"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { Account } from "@/lib/features/admin/types";
import { isOnboardingIncomplete, isPendingManagerReview } from "@/lib/features/admin/roster-filter";
import {
  AUTHORIZATION_LABELS,
} from "@/lib/features/authentication/types";
import { useAppDispatch } from "@/lib/hooks";
import { ADMIN_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import { CAPABILITY_PRESENTATION } from "./capabilityPresentation";
import { CAPABILITIES } from "@wxyc/shared/auth-client";
import { Settings } from "@mui/icons-material";
import {
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";

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
  const badges = CAPABILITIES.filter((c) => account.capabilities?.includes(c));

  return (
    <tr>
      <td style={{ verticalAlign: "middle" }}>
        <Stack spacing={0.5}>
          <Chip size="sm" {...ADMIN_TONES.role}>
            {AUTHORIZATION_LABELS[account.authorization]}
          </Chip>
          {badges.length > 0 && (
            <Stack direction="row" spacing={0.5}>
              {badges.map((c) => {
                const { label, Icon, tone } = CAPABILITY_PRESENTATION[c];
                return (
                  <Chip
                    key={c}
                    {...ADMIN_TONES[tone]}
                    size="sm"
                    startDecorator={<Icon sx={{ fontSize: 14 }} />}
                  >
                    {label}
                  </Chip>
                );
              })}
            </Stack>
          )}
        </Stack>
      </td>
      <td>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <span>{account.realName}</span>
          {isOnboardingIncomplete(account) && (
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
          {isPendingManagerReview(account) && (
            <Tooltip
              title="Self-signed — awaiting manager review"
              arrow
              placement="top"
              variant="outlined"
              size="sm"
            >
              <Chip {...ADMIN_TONES.pendingReview} size="sm">
                Pending review
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
