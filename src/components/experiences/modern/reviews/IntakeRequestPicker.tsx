import { useState } from "react";
import { Button, Option, Select } from "@mui/joy";
import type { Reviewer } from "@wxyc/shared";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

interface IntakeRequestPickerProps {
  reviewers: Reviewer[];
  /** The row's `lock(id, "request")`. */
  busy: { loading: boolean; disabled: boolean };
  onRequest: (djId: string) => void;
}

/** Picks one of the accounts that can review and asks them to review one record. */
export default function IntakeRequestPicker({ reviewers, busy, onRequest }: IntakeRequestPickerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  // A reloaded list may no longer carry the account that was picked.
  const djId = reviewers.some((r) => r.id === picked) ? picked : null;
  return (
    <>
      <Select
        size="sm"
        placeholder={COPY.djToAsk}
        value={djId}
        onChange={(_e, id) => setPicked(id)}
        disabled={busy.disabled}
        slotProps={{ button: { "aria-label": COPY.djToAsk } }}
      >
        {reviewers.map((r) => (
          <Option key={r.id} value={r.id}>{r.name}</Option>
        ))}
      </Select>
      <Button size="sm" variant="outlined" {...busy} disabled={busy.disabled || djId == null} onClick={() => onRequest(djId!)}>
        {COPY.request}
      </Button>
    </>
  );
}
