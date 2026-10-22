import { useCallback, useState } from "react";
import {
  useAddToFlowsheetMutation,
  useGetCurrentShowQuery,
} from "@/lib/features/flowsheet/api";
import {
  isSpotlightDisabled,
  whosOnCopy,
} from "@/lib/features/flowsheet/whos-on-copy";
import type { SpotlightRole } from "@wxyc/shared";

/**
 * What the who's-on control needs from the open show: whether to offer it, the
 * role it opens on, and the write itself.
 *
 * Offered on a freeform set (opening on Guest) and on a program the catalog
 * gives a usual role; a program without one has no button, though the server
 * would accept the row. Withheld until the open show has answered, and when
 * its program cannot be read, so a program's DJ is never offered a role set
 * that is about to change or that the catalog has not given them.
 */
export function useWhosOn() {
  const { data: show } = useGetCurrentShowQuery();
  const [addToFlowsheet, { isLoading }] = useAddToFlowsheetMutation();
  const [refusal, setRefusal] = useState<string | null>(null);

  const specialty = show?.specialty ?? null;
  const usualRole = specialty?.default_spotlight_role ?? null;
  // A show that answered with null has no readable program, so it is neither
  // freeform nor specialty: the control is withheld.
  const hasShow = show !== undefined && show !== null;

  // Resolves true once the row is written. A refusal while the server flag is
  // off is worded here; every other failure is the global toast's.
  const add = useCallback(
    async (role: SpotlightRole, name: string): Promise<boolean> => {
      try {
        await addToFlowsheet({
          entry_type: "spotlight",
          spotlight_role: role,
          spotlight_name: name.trim(),
        }).unwrap();
        setRefusal(null);
        return true;
      } catch (error) {
        setRefusal(isSpotlightDisabled(error) ? whosOnCopy.disabled : null);
        return false;
      }
    },
    [addToFlowsheet]
  );

  return {
    available: hasShow && (specialty === null || usualRole !== null),
    defaultRole: usualRole ?? ("guest" as SpotlightRole),
    isLoading,
    refusal,
    clearRefusal: () => setRefusal(null),
    add,
  };
}
