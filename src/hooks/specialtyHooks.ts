import { useGetCurrentShowQuery } from "@/lib/features/flowsheet/api";
import { useGetSpecialtyShowsQuery } from "@/lib/features/specialty/api";
import { programsForStart } from "@/lib/features/specialty/slot-match";
import type { SpecialtyShow } from "@wxyc/shared";

/**
 * The programs that log no songs and whose slot covers now, in catalog order.
 * Each gets a one-tap "Go live as" button: with no songs to show, the program
 * card is all a listener sees, so an untagged gap costs these shows the most.
 * Programs that log songs go through the question instead.
 */
export const useOneTapPrograms = (): SpecialtyShow[] => {
  const { data } = useGetSpecialtyShowsQuery();
  return programsForStart(new Date(), data ?? [])
    .map(({ program }) => program)
    .filter((program) => !program.logs_playcuts);
};

/**
 * Keeps `getCurrentShow` warm while a Go Live control is on screen, so the
 * handoff prompt can name the open show's program without waiting on the
 * server's refusal. `useOpenShowHandoff` only reads the cache at press time.
 */
export const useWarmCurrentShow = (): void => {
  useGetCurrentShowQuery();
};
