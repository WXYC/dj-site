"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { Authorization } from "@/lib/features/admin/types";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import AccountEditForm from "../../admin/roster/AccountEditForm";
import RightbarPanelContainer from "../RightbarPanelContainer";

export default function AccountEditPanel() {
  const dispatch = useAppDispatch();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);
  // Read the viewer from the session rather than from whatever dispatched
  // "account-edit" — see the module doc on AccountEditForm's approve action.
  // A viewer the session hasn't resolved yet (or isn't authenticated) falls
  // back to the lowest authority, so the approve gate fails closed instead of
  // trusting an absent claim.
  const { data: authData } = useAuthentication();
  const viewer = isAuthenticated(authData) ? authData.user : undefined;

  if (panel.type !== "account-edit") return null;

  const { account, isSelf, organizationSlug } = panel;
  const viewerRole = viewer?.authority ?? Authorization.NO;
  const viewerId = viewer?.id;
  const displayName = account.realName || account.userName;
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  return (
    <RightbarPanelContainer
      title={displayName}
      subtitle={account.djName || undefined}
      onClose={handleClose}
    >
      <AccountEditForm
        // Remount when the target account changes so field state seeded from
        // `account` (names, email) never leaks across accounts.
        key={account.id ?? account.userName}
        account={account}
        isSelf={isSelf}
        onClose={handleClose}
        organizationSlug={organizationSlug}
        viewerRole={viewerRole}
        viewerId={viewerId}
      />
    </RightbarPanelContainer>
  );
}
