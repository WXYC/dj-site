"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import AccountEditForm from "../../admin/roster/AccountEditForm";
import RightbarPanelContainer from "../RightbarPanelContainer";

export default function AccountEditPanel() {
  const dispatch = useAppDispatch();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);

  if (panel.type !== "account-edit") return null;

  const { account, isSelf, organizationSlug } = panel;
  const displayName = account.realName || account.userName;
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  return (
    <RightbarPanelContainer
      title={displayName}
      subtitle={account.djName ? `DJ ${account.djName}` : undefined}
      onClose={handleClose}
    >
      <AccountEditForm
        account={account}
        isSelf={isSelf}
        onClose={handleClose}
        organizationSlug={organizationSlug}
      />
    </RightbarPanelContainer>
  );
}
