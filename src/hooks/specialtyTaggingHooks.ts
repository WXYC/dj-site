import { useState } from "react";
import type { SpecialtyShow } from "@wxyc/shared";
import { useUpdateShowMutation } from "@/lib/features/flowsheet/api";

type Confirmation = { showId: number; program: SpecialtyShow; afterEntryId: number | null };

/**
 * The write-and-confirm half of the set-tagging question, shared by both
 * experiences so neither keeps its own copy: a yes tags the set, a confirmation
 * follows, and Done sends the week's title. `confirmed` is the program just
 * tagged while the confirmation is open, else null.
 */
export function useSpecialtyTagging(showId: number | null, newestEntryId: number | null) {
  const [updateShow, { isLoading }] = useUpdateShowMutation();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [title, setTitle] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  // The confirmation closes by its condition going false, not by clearing state,
  // so a typed title or a refusal would otherwise outlive its question and land
  // on the next show's. Reset them whenever the question's identity changes.
  const identity = `${showId}:${newestEntryId}`;
  const [seenIdentity, setSeenIdentity] = useState(identity);
  if (seenIdentity !== identity) {
    setSeenIdentity(identity);
    setTitle("");
    setRefusal(null);
  }

  const write = async (body: { specialty_id?: number; show_name?: string }) => {
    setRefusal(null);
    try {
      await updateShow({ showId: showId!, ...body }).unwrap();
      return true;
    } catch (error) {
      // Null is a refusal for the site's general handling, which has toasted it.
      setRefusal((error as { sentence?: string }).sentence ?? null);
      return false;
    }
  };

  const tag = async (program: SpecialtyShow) => {
    if (await write({ specialty_id: program.id })) {
      setConfirmation({ showId: showId!, program, afterEntryId: newestEntryId });
    }
  };

  const finish = async () => {
    if (title.trim() && !(await write({ show_name: title.trim() }))) {
      return;
    }
    setConfirmation(null);
    setTitle("");
  };

  // The tag lands before the next poll, so the confirmation outlives the
  // question's matches; it closes on Done or when the next row is logged.
  const confirmed =
    confirmation?.showId === showId && confirmation.afterEntryId === newestEntryId
      ? confirmation.program
      : null;

  return { confirmed, title, setTitle, refusal, isLoading, tag, finish };
}
