"use client";

import {
  formatDjNames,
  type JoinIntent,
  type OpenShowHandoff,
} from "@/lib/features/flowsheet/go-live-handoff";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GoLiveDecision, GoLiveOutcome } from "./flowsheetHooks";
import { useCallerIsOnAir, useOpenShowHandoff } from "./flowsheetHooks";

type GoLiveFn = (
  djNameOverride?: string,
  decision?: GoLiveDecision,
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
  /**
   * Whether this DJ was already on air on the open show when the prompt opened.
   *
   * Captured here rather than read again at render time so the buttons cannot
   * change under the reader's hands mid-decision, and so the answer is taken at
   * the same instant as the handoff it belongs to.
   *
   * True removes co-hosting from the offer: the DJ is already a co-host, so the
   * request that button sends is a no-op the server answers 200 — the prompt
   * would close having done nothing, which is the dead end it exists to remove.
   */
  callerIsOnAir: boolean;
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
  const readOpenShow = useOpenShowHandoff();
  const readCallerIsOnAir = useCallerIsOnAir();
  const [prompt, setPrompt] = useState<GoLivePrompt | null>(null);
  const [deciding, setDeciding] = useState(false);

  const requestGoLive = useCallback(
    async (djNameOverride?: string) => {
      // Classic renders its prompt inline and leaves the submit button live, so
      // without this a DJ can fire a second, UNDECIDED join while a decided one
      // is still in flight. On modern the Joy backdrop happens to prevent it —
      // the guarantee belongs to the shared hook, not to one surface's markup.
      if (prompt || deciding) return;
      // Read at press time, not at render time: the DJ acts on a snapshot, and
      // this is the freshest one available without a round trip.
      const openShow = readOpenShow();
      if (openShow) {
        // False by construction on this path — `readOpenShow` answers null for
        // a DJ already on the roster — but read rather than hardcoded, so the
        // two hooks cannot drift into disagreeing about the same roster.
        setPrompt({
          handoff: openShow,
          djNameOverride,
          callerIsOnAir: readCallerIsOnAir(),
        });
        return;
      }
      const outcome = await goLive(djNameOverride);
      if (outcome.status === "conflict") {
        // The path that can be true: the server refuses a non-owner, and an
        // active co-host is a non-owner. Asked after the response rather than
        // before the request, because the join mutation invalidates the on-air
        // roster — so by now this DJ's own membership reflects whatever the
        // server just decided, which is the state the buttons have to describe.
        setPrompt({
          handoff: outcome.handoff,
          djNameOverride,
          callerIsOnAir: readCallerIsOnAir(),
        });
      } else if (outcome.status === "error") {
        toast.error(outcome.message);
      }
    },
    [prompt, deciding, readOpenShow, readCallerIsOnAir, goLive],
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
          callerIsOnAir: readCallerIsOnAir(),
        });
        return;
      }
      // Nothing was sent (no resolved user yet), so nothing was decided.
      // Closing here would reproduce the dead end this prompt exists to remove.
      if (outcome.status === "skipped") return;

      if (outcome.status === "error") toast.error(outcome.message);
      // The DJ is on air, but as a guest on the show they asked to end. Say so
      // — this is the one outcome they explicitly declined, and the show they
      // wanted closed is still open.
      if (outcome.status === "cohosted") {
        // Lead with being on air: that is the part the DJ most needs, and it
        // is true. The possessive is load-bearing — `formatDjNames` can return
        // several names, and any phrasing that puts them in subject position
        // needs a verb agreement a template string cannot express.
        toast.error(
          `You're on air as a co-host of ${formatDjNames(
            prompt.handoff.djNames,
          )}'s show. Ending another DJ's show isn't available yet, so your tracks will log under theirs.`,
        );
      }
      setPrompt(null);
    },
    [prompt, deciding, readCallerIsOnAir, goLive],
  );

  const cancel = useCallback(() => setPrompt(null), []);

  return { prompt, deciding, requestGoLive, decide, cancel };
};
