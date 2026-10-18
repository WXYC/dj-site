import { useId, useState } from "react";
import { Dropdown, ListItemContent, Menu, MenuButton, MenuItem, Typography } from "@mui/joy";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import { AskADjDialog } from "./IntakeRequestPicker";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

type DialogProps = Parameters<typeof AskADjDialog>[0];

interface ShelfMoreMenuProps extends Omit<DialogProps, "open" | "onClose"> {
  /** The record's id, for the links to its page. */
  id: number;
  /** The ids of the elements that name the record (space-separated, as `aria-labelledby` takes them), which name the button for the record it acts on among many. */
  labelledBy: string;
  /** The row's `lock(id, "request")`. */
  busy: { loading: boolean; disabled: boolean };
}

/** One item: its label names it and its description describes it, so a screen reader reads them apart. */
function Described({ label, description, href, disabled, onClick }: { label: string; description: string; href?: string; disabled?: boolean; onClick?: () => void }) {
  const id = useId();
  return (
    <MenuItem {...(href ? { component: "a", href } : { disabled, onClick })} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}>
      <ListItemContent>
        <Typography id={`${id}-label`} level="title-sm">{label}</Typography>
        <Typography id={`${id}-description`} level="body-xs">{description}</Typography>
      </ListItemContent>
    </MenuItem>
  );
}

/**
 * The music director's control on a review shelf row: one More button holding the three ways to get a review. Ask a DJ… opens the search here; the other two go to the record's page, which opens the way the link names.
 */
export default function ShelfMoreMenu({ id, labelledBy, busy, ...dialog }: ShelfMoreMenuProps) {
  const [asking, setAsking] = useState(false);
  const buttonId = useId();
  const page = `/dashboard/admin/intake/${id}`;

  return (
    <>
      <Dropdown>
        {/* The button stays enabled while a request is in flight: the dialog hands focus back to it when it closes, and only the Ask a DJ… item is locked. */}
        <MenuButton
          id={buttonId}
          size="sm"
          variant="outlined"
          endDecorator={<KeyboardArrowDown />}
          aria-labelledby={`${buttonId} ${labelledBy}`}
        >
          {COPY.moreButton}
        </MenuButton>
        <Menu placement="bottom-end">
          <Described label={COPY.askADj} description={COPY.moreAskDescription} disabled={busy.disabled} onClick={() => setAsking(true)} />
          <Described label={COPY.moreCite} description={COPY.moreCiteDescription} href={`${page}?get=cite`} />
          <Described label={COPY.moreRecord} description={COPY.moreRecordDescription} href={`${page}?get=record`} />
        </Menu>
      </Dropdown>
      <AskADjDialog
        {...dialog}
        open={asking}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
