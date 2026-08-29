/**
 * The pure half of the go-live handoff prompt: what to tell a DJ about the show
 * that is in the way, and how to read the server's refusal to guess.
 *
 * Pressing "Go Live" while someone else's show is still open used to attach the
 * DJ to that show as a guest, silently. The prompt exists so the choice is
 * made out loud — and it is only useful if it answers the question a DJ
 * actually has at a handoff, which is not "who owns this show" but "did they
 * leave?". Elapsed time since the last logged entry is what separates those two
 * readings, so it is the headline here, not the show's start time.
 */

/** The wire values `POST /flowsheet/join` accepts for an explicit decision. */
export type JoinIntent = "join" | "takeover";

/**
 * What `POST /flowsheet/join` answers a 2xx with, narrowed to the one field
 * that tells the two outcomes apart: a takeover the server honoured returns the
 * newly started `Show` (which has an `id`), while a co-host join returns the
 * `ShowDJ` membership row instead (`show_id` / `dj_id`, and no `id`).
 */
export type JoinShowResult = {
  id?: number;
  show_id?: number;
  dj_id?: string;
};

/**
 * Whether the server really ended the open show and started a new one.
 *
 * A takeover is a request the server may decline *silently*: it is gated behind
 * a server-side flag, and while that flag is off `intent` is ignored altogether
 * and the caller is co-hosted onto the open show with a 200. Without this check
 * a DJ presses a button reading "End Existing Show", watches the prompt close,
 * and is added to the very show they asked to end — the original defect, now
 * wearing an affirmative confirmation that lies about what it did. Nothing in
 * the status code distinguishes the two.
 *
 * Tested by IDENTITY, not by shape. A honoured takeover ends the named show and
 * starts a fresh one, so the id that comes back is a *different* show; a
 * co-host join lands on the show the DJ named. Sniffing for the mere presence
 * of an `id` would also read as honoured the day the server starts returning
 * the joined show on a co-host join — a natural API improvement that would
 * silently restore the original lie. Both shapes declare every field optional
 * in the shared contract, so presence was never a discriminant to begin with.
 */
export function takeoverWasHonored(
  result: JoinShowResult | undefined,
  expectedShowId: number | undefined
): boolean {
  return typeof result?.id === "number" && result.id !== expectedShowId;
}

/** What the prompt renders, and what a takeover has to echo back. */
export type OpenShowHandoff = {
  /** `shows.id` of the open show — the `expected_show_id` a takeover sends. */
  showId: number;
  /**
   * Who is on air. Sourced from `GET /flowsheet/djs-on-air`
   * (active `show_djs` membership), never from the show's own resolved
   * `dj_name`: for an abandoned show the latter names whoever started it, which
   * is the one answer a DJ deciding whether to take over must not be given.
   */
  djNames: readonly string[];
  /**
   * ISO-8601 `add_time` of the show's newest entry. Null means UNKNOWN, not
   * "nothing logged": the server's refusal carries no timestamp, so a prompt
   * built from it has to say less rather than assert something false.
   */
  lastLoggedAt: string | null;
};

/**
 * The shape Backend-Service refuses a guess-less join with: a 409 carrying
 * `code: 'show_already_open'` and the open show's identity.
 */
type ShowAlreadyOpenBody = {
  code?: unknown;
  details?: { show?: { id?: unknown; dj_name?: unknown; start_time?: unknown } };
};

/**
 * Read a `show_already_open` 409 out of an RTK Query rejection, or null for
 * anything else.
 *
 * Discriminates on `code`, never on the 409 status alone: 409 is the generic
 * conflict status, and the join route is free to grow a second refusal that
 * uses it. Treating any 409 as a handoff would put this prompt in front of a
 * DJ over an unrelated conflict.
 *
 * The name it returns is the show's owner. That is the correct answer to "whose
 * show am I being asked about" and the wrong one to "who is on air" — see
 * `OpenShowHandoff.djNames`. It is used only when the client has no
 * djs-on-air answer of its own.
 */
export function readShowAlreadyOpen(err: unknown): OpenShowHandoff | null {
  const rejection = unwrapRejection(err);
  if (!rejection) return null;
  if (rejection.status !== 409) return null;
  const data = rejection.data as ShowAlreadyOpenBody | undefined;
  if (!data || data.code !== "show_already_open") return null;
  const show = data.details?.show;
  if (!show || typeof show.id !== "number") return null;
  const owner = typeof show.dj_name === "string" ? show.dj_name.trim() : "";
  return {
    showId: show.id,
    // The refusal names one show owner, never a membership list — and names
    // nobody at all if the show has no resolvable handle.
    djNames: owner.length > 0 ? [owner] : [],
    lastLoggedAt: null,
  };
}

/**
 * RTK Query hands the same failure out in two shapes, and both reach this
 * module: `.unwrap()` rejects with the bare `{status, data}`, while
 * `queryFulfilled` inside `onQueryStarted` rejects with it wrapped as
 * `{error, meta}`. Reading only the bare one would silently mis-classify every
 * refusal seen from the cache-patch side as a genuine failure.
 */
function unwrapRejection(
  err: unknown
): { status?: unknown; data?: unknown } | null {
  if (!err || typeof err !== "object") return null;
  const candidate = err as { status?: unknown; error?: unknown };
  if (candidate.status !== undefined) return candidate;
  if (candidate.error && typeof candidate.error === "object") {
    return candidate.error as { status?: unknown; data?: unknown };
  }
  return null;
}

/** "dj sue", "dj sue and eureka!", "dj sue, eureka! and DJ boy". */
export function formatDjNames(names: readonly string[]): string {
  const cleaned = names.map((n) => n.trim()).filter((n) => n.length > 0);
  if (cleaned.length === 0) return "Someone";
  if (cleaned.length === 1) return cleaned[0];
  return `${cleaned.slice(0, -1).join(", ")} and ${cleaned[cleaned.length - 1]}`;
}

/**
 * "5h 12m ago" vs "2 minutes ago" — the whole difference between "they walked
 * out" and "they are still talking", which is the decision this prompt exists
 * to inform.
 *
 * Deliberately coarse and deliberately not `Intl.RelativeTimeFormat`: the
 * reader needs to sort one gap into "recent" or "ages ago", and a unit-picking
 * formatter that says "yesterday" hides an hour count that is the actual
 * signal. Returns null when there is nothing to measure, so the caller can
 * say less rather than render a fake duration.
 */
export function formatElapsedSince(
  isoTimestamp: string | null,
  now: number = Date.now()
): string | null {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.floor((now - then) / 1000);
  // Clock skew between the browser and the server can put a just-written
  // entry marginally in the future. "in 3 seconds ago" is worse than "just
  // now", and the answer to the DJ's question is the same either way.
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainderMinutes}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

/**
 * The sentence at the top of the prompt.
 *
 * Drops the elapsed clause entirely when the timestamp is unknown rather than
 * substituting a claim like "hasn't logged anything" — the client derives the
 * timestamp itself in the ordinary case, and the one path that lacks it (the
 * server's own refusal, which carries no timestamp) has no basis for either
 * reading. Saying less is the only honest degrade.
 */
export function describeOpenShow(
  handoff: OpenShowHandoff,
  now: number = Date.now()
): string {
  const elapsed = formatElapsedSince(handoff.lastLoggedAt, now);
  // Subject and verb are derived from ONE filtered list, so they cannot
  // disagree. Counting the raw array instead would render "dj sue are on air"
  // for a show whose second DJ has a blank handle.
  const named = handoff.djNames.map((n) => n.trim()).filter((n) => n.length > 0);
  const verb = named.length > 1 ? "are" : "is";
  const subject = formatDjNames(named);
  return elapsed === null
    ? `${subject} ${verb} on air.`
    : `${subject} ${verb} on air. Last logged ${elapsed}.`;
}
