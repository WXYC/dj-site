"use client";

import { useState, type FormEvent } from "react";
import {
  WHOS_ON_ROLES,
  whosOnCopy,
} from "@/lib/features/flowsheet/whos-on-copy";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { useWhosOn } from "@/src/hooks/whosOnHooks";
import { Person } from "@mui/icons-material";
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalDialog,
  Option,
  Select,
  Tooltip,
  Typography,
} from "@mui/joy";
import type { SpotlightRole } from "@wxyc/shared";

export default function WhosOnButton() {
  const { live } = useFlowsheetSearch();
  const { available, defaultRole, isLoading, refusal, clearRefusal, add } =
    useWhosOn();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<SpotlightRole>(defaultRole);
  const [name, setName] = useState("");

  if (!available) {
    return null;
  }

  const close = () => {
    setOpen(false);
    clearRefusal();
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    // The dialog is portalled out of the searchbar's form, but React still
    // bubbles its submit up to that form's handler.
    e.preventDefault();
    e.stopPropagation();
    if (await add(role, name)) {
      setName("");
      close();
    }
  };

  return (
    <>
      <Tooltip
        placement="top"
        size="sm"
        variant="outlined"
        title={defaultRole === "guest" ? whosOnCopy.guestTooltip : whosOnCopy.tooltip}
      >
        <IconButton
          size="sm"
          variant="solid"
          color="neutral"
          data-testid="flowsheet-whoson-button"
          disabled={!live}
          onClick={() => {
            setRole(defaultRole);
            setOpen(true);
          }}
          sx={{ zIndex: 8001 }}
        >
          <Person />
        </IconButton>
      </Tooltip>
      <Modal open={open} onClose={close}>
        <ModalDialog component="form" onSubmit={submit} sx={{ minWidth: 320 }}>
          <Typography level="title-md">{whosOnCopy.title}</Typography>
          <FormControl>
            <FormLabel>{whosOnCopy.roleLabel}</FormLabel>
            <Select
              value={role}
              onChange={(_, value) => value && setRole(value)}
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
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ input: { maxLength: 128 } }}
            />
            <FormHelperText>{whosOnCopy.publicNotice(role)}</FormHelperText>
          </FormControl>
          {refusal && (
            <Typography level="body-sm" color="danger" role="alert">
              {refusal}
            </Typography>
          )}
          <Button type="submit" loading={isLoading} disabled={name.trim() === ""}>
            {whosOnCopy.add}
          </Button>
        </ModalDialog>
      </Modal>
    </>
  );
}
