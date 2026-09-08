/**
 * The one owner of the force-end refusal's interpretation, copy, and testids —
 * the same job `go-live-handoff.ts` does for the go-live 409. Both
 * `forceEndShow`'s `invalidatesTags` and the operator dialog consume this, so
 * the 409 / benign-400 / refusal / lost-answer split is never derived twice.
 */

/**
 * What a rejected force-end means for the show:
 *
 * - `already_ended` — someone else closed it first. The operator's goal state
 *   is reached; render it as success, not failure.
 * - `now_on_air` — the show became `max(shows.id)` between render and click
 *   and the request carried no `?force=true`. The server's consent gate held;
 *   re-ask, never auto-escalate.
 * - `refused` — the server answered without writing (bad id, missing role,
 *   unknown show). Nothing changed upstream.
 * - `indeterminate` — a 5xx, a dropped connection, or a rejection that never
 *   came off this mutation's wire. The close may have committed on a response
 *   the client never saw, so callers must take the cautious path (invalidate,
 *   re-check) rather than assert nothing happened.
 */
export type ForceEndOutcome =
  | "already_ended"
  | "now_on_air"
  | "refused"
  | "indeterminate";

/**
 * The shape `forceEndShow`'s `transformErrorResponse` emits. The wrap exists to
 * keep the shared `rtkQueryErrorLogger` from toasting `data.message` a second
 * time over the dialog's own precise sentence — the `deleteAlbum` pattern.
 */
type WrappedForceEndError = {
  forceEndShowError: { status?: unknown; data?: unknown };
};

const isWrappedForceEndError = (err: unknown): err is WrappedForceEndError => {
  if (!err || typeof err !== "object") return false;
  const candidate = (err as WrappedForceEndError).forceEndShowError;
  return !!candidate && typeof candidate === "object";
};

const messageOf = (inner: { data?: unknown }): string => {
  const data = inner.data as { message?: unknown } | undefined;
  return typeof data?.message === "string" ? data.message : "";
};

/**
 * Classify a force-end rejection.
 *
 * Only a WRAPPED error is read for a status: `transformErrorResponse` runs
 * before both `invalidatesTags` and the caller's `catch`, so anything
 * unwrapped never came off this mutation's wire (a thrown condition, an
 * aborted dispatch) and its fields — even a plausible-looking 409 — prove
 * nothing about what the server did. RTK also types `invalidatesTags`'s error
 * as the untransformed shape, so a status-keyed read against the raw argument
 * would find `undefined` on every refusal and misfile it; the unwrap here is
 * what makes the function-form tag mapping actually see the status
 * (`releaseDeleteOutcome.ts` documents the same trap).
 *
 * The benign 400 is discriminated by the server's message text — the route
 * sends no machine-readable code, and its other 400s (bad id, missing
 * `expected` params) share the status. Matching on "already ended" is the
 * whole contract; a wording change upstream degrades this to `refused`, which
 * fails safe (an error toast for a reached goal, never a skipped refetch).
 */
export function classifyForceEndError(err: unknown): ForceEndOutcome {
  if (!isWrappedForceEndError(err)) return "indeterminate";
  const inner = err.forceEndShowError;
  const status = inner.status;
  if (typeof status !== "number" || status >= 500) return "indeterminate";
  if (status === 409) return "now_on_air";
  if (status === 400 && /already ended/i.test(messageOf(inner))) {
    return "already_ended";
  }
  return "refused";
}

/**
 * Every sentence the force-end flow shows an operator. The server's own words
 * never surface: its 409 message is a curl instruction ("Re-send with
 * ?force=true…"), and the client can recompute everything the rest convey —
 * the same screen-owns-the-words rule the delete-refusal convention states.
 */
export const FORCE_END_COPY = {
  title: "End this show?",
  /** Leads the danger variant — the one outcome that affects a person live. */
  currentWarning:
    "This is the on-air show — ending it signs the current DJ off the air. Their next flowsheet add will fail until they press Go Live again.",
  choice:
    "The show closes with its end time set to its last logged entry, so the archive stays truthful.",
  confirm: "End Show",
  cancel: "Cancel",
  ended: "Show ended.",
  /** Success-toned toast, never an error: the operator's goal state is reached. */
  alreadyEnded: "That show was already closed.",
  refused: "The server declined to end this show.",
  indeterminate:
    "Could not confirm the show was ended — the list has been refreshed; check it before retrying.",
} as const;

/**
 * `data-testid` values for the dialog. The component and e2e suites spell
 * these as literals on purpose — an importing caller would follow a rename
 * instead of catching it — and the literals are pinned against these values in
 * `tests/unit/lib/features/flowsheet/force-end-outcome.test.ts`, the contract
 * `GO_LIVE_HANDOFF_TESTIDS` established.
 */
export const FORCE_END_TESTIDS = {
  dialog: "force-end-dialog",
  confirm: "force-end-confirm",
  cancel: "force-end-cancel",
} as const;

/**
 * A DOM `id` for `ConfirmDialog`'s `titleId`, NOT a test id — kept out of the
 * object above for the same reason `GO_LIVE_HANDOFF_TITLE_ID` is: filed under
 * test ids it would invite a `getByTestId` that matches nothing.
 */
export const FORCE_END_TITLE_ID = "force-end-title";
