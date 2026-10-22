"use client";

import {
  formatDjNames,
  type JoinIntent,
  type OpenShowHandoff,
} from "@/lib/features/flowsheet/go-live-handoff";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GoLiveDecision, GoLiveOutcome, GoLiveTag } from "./flowsheetHooks";
import { useOpenShowHandoff } from "./flowsheetHooks";

type GoLiveFn = (
  djNameOverride?: string,
  decision?: GoLiveDecision,
  tag?: GoLiveTag,
) => Promise<GoLiveOutcome>;

/** The tag to send and, after a one-tap press, the program name the takeover sentence ends with. */
export type OneTap = { tag: GoLiveTag; program?: string };

export type GoLivePrompt = {
  handoff: OpenShowHandoff;
  /**
   * The per-show handle the DJ typed before pressing the button, replayed
   * verbatim on whichever answer they give. Everything else in the request is
   * re-derived from the registry, so the override is the only value that can be
   * lost — and on the classic surface it is the entire point of the form.
   */
  djNameOverride?: string;
  /** Replayed with a takeover only; a join keeps the open show as it is. */
  tag?: GoLiveTag;
  /** Set only after a one-tap press; the takeover sentence ends with it. */
  program?: string;
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
  const [prompt, setPrompt] = useState<GoLivePrompt | null>(null);
  const [deciding, setDeciding] = useState(false);

  const requestGoLive = useCallback(
    async (djNameOverride?: string, oneTap?: OneTap) => {
      // Classic renders its prompt inline and leaves the submit button live, so
      // without this a DJ can fire a second, UNDECIDED join while a decided one
      // is still in flight. On modern the Joy backdrop happens to prevent it —
      // the guarantee belongs to the shared hook, not to one surface's markup.
      if (prompt || deciding) return;
      const promptTag = { tag: oneTap?.tag, program: oneTap?.program };
      // Read at press time, not at render time: the DJ acts on a snapshot, and
      // this is the freshest one available without a round trip.
      const openShow = readOpenShow();
      if (openShow) {
        setPrompt({ handoff: openShow, djNameOverride, ...promptTag });
        return;
      }
      const outcome = await goLive(djNameOverride, undefined, oneTap?.tag);
      if (outcome.status === "conflict") {
        // The server refused a non-owner. That is all it says: an active
        // co-host and a DJ with no connection to the open show reach this line
        // through the identical response, and the prompt offers both of them
        // the same two answers because nothing here can tell them apart. The
        // roster this client polls cannot help — it is the same read that
        // produced the `live === false` gating the press, and the join
        // mutation's own optimistic patch is rolled back synchronously before
        // this line runs, while its tag invalidation has only marked the
        // roster stale. Telling them apart needs the refusal to say so:
        // WXYC/dj-site#1426.
        setPrompt({ handoff: outcome.handoff, djNameOverride, ...promptTag });
      } else if (outcome.status === "error") {
        toast.error(outcome.message);
      }
    },
    [prompt, deciding, readOpenShow, goLive],
  );

  const decide = useCallback(
    async (intent: JoinIntent) => {
      if (!prompt || deciding) return;
      setDeciding(true);
      const outcome = await goLive(
        prompt.djNameOverride,
        {
          intent,
          // Only a takeover names a show to close; a co-host join is happy to
          // land on whatever is open.
          expected_show_id:
            intent === "takeover" ? prompt.handoff.showId : undefined,
        },
        // A join lands on the open show as it is; the server ignores a tag
        // there, and sending one would suggest the show gets re-tagged.
        intent === "takeover" ? prompt.tag : undefined,
      );
      setDeciding(false);

      // The show moved on between the prompt and the click. Re-prompt with the
      // server's fresh answer rather than closing: the DJ asked to end a
      // specific show, and nothing was ended.
      if (outcome.status === "conflict") {
        setPrompt({ ...prompt, handoff: outcome.handoff });
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
    [prompt, deciding, goLive],
  );

  const cancel = useCallback(() => setPrompt(null), []);

  return { prompt, deciding, requestGoLive, decide, cancel };
};
