import {
  WHOS_ON_ROLES,
  whosOnCopy,
} from "@/lib/features/flowsheet/whos-on-copy";
import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Option,
  Select,
  Typography,
} from "@mui/joy";
import type { SpotlightRole } from "@wxyc/shared";

/** The role select, name field and refusal line shared by the who's-on dialog and the leading composer. */
export default function WhosOnFields({
  role,
  onRoleChange,
  name,
  onNameChange,
  refusal,
  autoFocus = false,
  disabled = false,
}: {
  role: SpotlightRole;
  onRoleChange: (role: SpotlightRole) => void;
  name: string;
  onNameChange: (name: string) => void;
  refusal: string | null;
  autoFocus?: boolean;
  /** Turns off the role select and the name field. */
  disabled?: boolean;
}) {
  return (
    <>
      <FormControl>
        <FormLabel>{whosOnCopy.roleLabel}</FormLabel>
        <Select
          value={role}
          disabled={disabled}
          onChange={(_, value) => value && onRoleChange(value)}
          slotProps={{ button: { "aria-label": whosOnCopy.roleLabel } }}
        >
          {WHOS_ON_ROLES.map(({ role: value, menu }) => (
            <Option key={value} value={value}>
              {menu}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl>
        <FormLabel>{whosOnCopy.nameLabel(role)}</FormLabel>
        <Input
          autoFocus={autoFocus}
          disabled={disabled}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          slotProps={{ input: { maxLength: 128 } }}
        />
        <FormHelperText>{whosOnCopy.publicNotice(role)}</FormHelperText>
      </FormControl>
      {refusal && (
        <Typography level="body-sm" color="danger" role="alert">
          {refusal}
        </Typography>
      )}
    </>
  );
}
