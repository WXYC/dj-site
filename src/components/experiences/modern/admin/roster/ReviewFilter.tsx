"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import type { ReviewFilter as ReviewFilterValue } from "@/lib/features/admin/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PendingActions } from "@mui/icons-material";
import { FormControl, Option, Select } from "@mui/joy";

/**
 * The label for each side of the manager review queue.
 */
const REVIEW_LABELS: Record<Exclude<ReviewFilterValue, "all">, string> = {
  pending: "Pending review",
  reviewed: "Reviewed",
};

/**
 * Narrows the roster to the self-signed accounts a manager still needs to
 * clear, or the ones already cleared.
 *
 * Ordinary admin-provisioned accounts never entered the queue, so they drop
 * out of both narrowed views — only "all" shows them. Single-select, like
 * `OnboardingFilter`.
 */
export default function ReviewFilter() {
  const reviewFilter = useAppSelector(adminSlice.selectors.getReviewFilter);
  const dispatch = useAppDispatch();

  return (
    <FormControl size="sm">
      <Select
        size="sm"
        color="success"
        startDecorator={<PendingActions />}
        value={reviewFilter}
        onChange={(_, selected) =>
          dispatch(adminSlice.actions.setReviewFilter((selected ?? "all") as ReviewFilterValue))
        }
        slotProps={{
          button: { "aria-label": "Filter by review status", sx: { whiteSpace: "nowrap" } },
          listbox: { sx: { zIndex: "modal" } },
        }}
        sx={{ minWidth: "180px" }}
      >
        <Option value="all">All accounts</Option>
        <Option value="pending">{REVIEW_LABELS.pending}</Option>
        <Option value="reviewed">{REVIEW_LABELS.reviewed}</Option>
      </Select>
    </FormControl>
  );
}
