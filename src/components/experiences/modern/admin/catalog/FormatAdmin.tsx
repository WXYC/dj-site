"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  List,
  ListItem,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAddFormatMutation, useGetFormatsQuery } from "@/lib/features/catalog/api";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

function FormatAdmin() {
  const { data: formats } = useGetFormatsQuery();
  const [addFormat, { isLoading }] = useAddFormatMutation();
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Format name can't be blank");
      return;
    }

    try {
      await addFormat({ name: trimmed }).unwrap();
      setName("");
    } catch (err) {
      // The global rtkQueryErrorLogger middleware already toasts the server
      // message for the common failure (e.g. a 409 duplicate-name reply);
      // only surface a fallback here for the gap it leaves silent. That gap
      // now also covers a rejection with no `status` at all (a `SerializedError`
      // — the shared predicate's own no-`status` branch): this used to stay
      // silent when this file carried its own local copy of the predicate,
      // which returned `false` for that shape. Toasting it is intentional —
      // the alternative is a failed add nobody is ever told about — but it is
      // a behavior change from before the shared extraction.
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to add format");
      }
    }
  };

  return (
    <RequireMD>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Typography level="title-md" sx={{ mb: 1 }}>
          Formats
        </Typography>
        <List size="sm" sx={{ mb: 2 }}>
          {(formats ?? []).map((format) => (
            <ListItem key={format.id}>{format.format_name}</ListItem>
          ))}
        </List>
        <form onSubmit={handleSubmit}>
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>New format</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cassette"
                required
              />
            </FormControl>
            <Button type="submit" loading={isLoading}>
              Add Format
            </Button>
          </Stack>
        </form>
      </Sheet>
    </RequireMD>
  );
}

export default FormatAdmin;
