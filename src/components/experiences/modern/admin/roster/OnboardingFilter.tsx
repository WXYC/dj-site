"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import type { OnboardingFilter as OnboardingFilterValue } from "@/lib/features/admin/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { HowToReg } from "@mui/icons-material";
import { FormControl, Option, Select } from "@mui/joy";

/**
 * The label for each side of the signup flow.
 *
 * "Onboarding" rather than "signup" so the picker, the row's "New" chip
 * tooltip and the login-time message an admin will be asked about all use one
 * word for one thing.
 */
const ONBOARDING_LABELS: Record<Exclude<OnboardingFilterValue, "all">, string> = {
  incomplete: "Onboarding incomplete",
  complete: "Onboarding complete",
};

/**
 * Narrows the roster to the DJs who have — or have not — finished setting
 * their account up.
 *
 * The incomplete side is the one this exists for: a provisioned DJ who never
 * completed onboarding is locked out of the flowsheet, and until now the only
 * way to find them was to read every page of the roster looking for the "New"
 * chip. Both sides are offered because the complement is what tells an admin a
 * chase is finished.
 *
 * Single-select, unlike the role filter: the two values are complements, so
 * selecting both is the default and selecting neither is empty.
 */
export default function OnboardingFilter() {
  const onboardingFilter = useAppSelector(adminSlice.selectors.getOnboardingFilter);
  const dispatch = useAppDispatch();

  return (
    <FormControl size="sm">
      <Select
        size="sm"
        color="success"
        startDecorator={<HowToReg />}
        value={onboardingFilter}
        onChange={(_, selected) =>
          dispatch(
            adminSlice.actions.setOnboardingFilter((selected ?? "all") as OnboardingFilterValue)
          )
        }
        slotProps={{
          button: { "aria-label": "Filter by onboarding status", sx: { whiteSpace: "nowrap" } },
          listbox: { sx: { zIndex: "modal" } },
        }}
        sx={{ minWidth: "180px" }}
      >
        <Option value="all">All accounts</Option>
        <Option value="incomplete">{ONBOARDING_LABELS.incomplete}</Option>
        <Option value="complete">{ONBOARDING_LABELS.complete}</Option>
      </Select>
    </FormControl>
  );
}
