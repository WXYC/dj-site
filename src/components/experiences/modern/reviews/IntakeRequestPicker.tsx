import { useState } from "react";
import { Button, Option, Select } from "@mui/joy";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

interface IntakeRequestPickerProps {
  /** The accounts that can be asked to review. */
  djs: { id: string; name: string }[];
  /** The row's `lock(id, "request")`. */
  busy: { loading: boolean; disabled: boolean };
  onRequest: (djId: string) => void;
}

/** Picks a DJ and asks them to review one record. */
export default function IntakeRequestPicker({ djs, busy, onRequest }: IntakeRequestPickerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  // A reloaded list may no longer carry the account that was picked.
  const djId = djs.some((d) => d.id === picked) ? picked : null;
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
        {djs.map((d) => (
          <Option key={d.id} value={d.id}>{d.name}</Option>
        ))}
      </Select>
      <Button size="sm" variant="outlined" {...busy} disabled={busy.disabled || djId == null} onClick={() => onRequest(djId!)}>
        {COPY.request}
      </Button>
    </>
  );
}
