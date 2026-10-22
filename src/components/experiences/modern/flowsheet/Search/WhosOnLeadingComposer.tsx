"use client";

import { useState, type FormEvent } from "react";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { useWhosOn } from "@/src/hooks/whosOnHooks";
import { Box, Button, Link } from "@mui/joy";
import type { SpotlightRole } from "@wxyc/shared";
import WhosOnFields from "./WhosOnFields";

/**
 * The composer for a show that logs no songs: the program's usual role and a
 * name, with a link back to the song fields.
 */
export default function WhosOnLeadingComposer({
  onLogSong,
}: {
  onLogSong: () => void;
}) {
  const { defaultRole, isLoading, refusal, add } = useWhosOn();
  const { info } = useRegistry();
  const [role, setRole] = useState<SpotlightRole>(defaultRole);
  // Untouched until the DJ types, so a handle that arrives late still shows.
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? info?.dj_name ?? "";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (await add(role, name)) {
      setTyped("");
    }
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      data-testid="flowsheet-whoson-leading"
      sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}
    >
      <WhosOnFields
        role={role}
        onRoleChange={setRole}
        name={name}
        onNameChange={setTyped}
        refusal={refusal}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Button type="submit" loading={isLoading} disabled={name.trim() === ""}>
          {whosOnCopy.add}
        </Button>
        <Link component="button" type="button" onClick={onLogSong}>
          {whosOnCopy.logSong}
        </Link>
      </Box>
    </Box>
  );
}
