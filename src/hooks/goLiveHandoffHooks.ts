"use client";

import type {
  JoinIntent,
  OpenShowHandoff,
} from "@/lib/features/flowsheet/go-live-handoff";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GoLiveOutcome } from "./flowsheetHooks";
import { useOpenShowHandoff } from "./flowsheetHooks";

type GoLiveFn = (
  djNameOverride?: string,
  decision?: { intent: JoinIntent; expected_show_id?: number }
) => Promise<GoLiveOutcome>;

export type GoLivePrompt = {
  handoff: OpenShowHandoff;
  /**
   * The per-show handle the DJ typed before pressing the button, replayed
   * verbatim on whichever answer they give. Everything else in the request is
   * re-derived from the registry, so the override is the only value that can be
   * lost — and on the classic surface it is the entire point of the form.
   */
  djNameOverride?: string;
};

/**
 * Shared state machine behind the go-live handoff prompt, so the two surfaces
 * that can start a show render the same decision rather than two versions of it.
 *
 * Takes `goLive` from the caller's own `useShowControl()` instead of calling it
 * again — both consumers already hold one, and a second call would open a
 * duplicate subscription to the paginated entries query for nothing.
 *
 * The prompt opens from either of two signals, and the ordinary one costs no
 * request at all: the client already polls who is on air, so a handoff is
 * visible before anything is sent, and cancelling therefore sends nothing. The
 * server's own refusal is the backstop for the window where the two disagree.
 */
export const useGoLiveHandoff = (goLive: GoLiveFn) => {
  const openShow = useOpenShowHandoff();
  const [prompt, setPrompt] = useState<GoLivePrompt | null>(null);
  const [deciding, setDeciding] = useState(false);

  const requestGoLive = useCallback(
    async (djNameOverride?: string) => {
      if (openShow) {
        setPrompt({ handoff: openShow, djNameOverride });
        return;
      }
      const outcome = await goLive(djNameOverride);
      if (outcome.status === "conflict") {
        setPrompt({ handoff: outcome.handoff, djNameOverride });
      } else if (outcome.status === "error") {
        toast.error(outcome.message);
      }
    },
    [openShow, goLive]
  );

  const decide = useCallback(
    async (intent: JoinIntent) => {
      if (!prompt || deciding) return;
      setDeciding(true);
      const outcome = await goLive(prompt.djNameOverride, {
        intent,
        // Only a takeover names a show to close; a co-host join is happy to
        // land on whatever is open.
        expected_show_id:
          intent === "takeover" ? prompt.handoff.showId : undefined,
      });
      setDeciding(false);

      // The show moved on between the prompt and the click. Re-prompt with the
      // server's fresh answer rather than closing: the DJ asked to end a
      // specific show, and nothing was ended.
      if (outcome.status === "conflict") {
        setPrompt({
          handoff: outcome.handoff,
          djNameOverride: prompt.djNameOverride,
        });
        return;
      }
      if (outcome.status === "error") toast.error(outcome.message);
      setPrompt(null);
    },
    [prompt, deciding, goLive]
  );

  const cancel = useCallback(() => setPrompt(null), []);

  return { prompt, deciding, requestGoLive, decide, cancel };
};
