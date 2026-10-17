import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";

const baseQuery = backendBaseQuery("", { surfaceNonJsonAsError: true });

// Keyed by the store's dispatch (the thunk dispatch a base query and a page's thunk both receive), so one store's writes never date another store's reads.
const lastWriteAnsweredAt = new WeakMap<object, number>();

/**
 * When a write of this API last got a fulfilled answer in the store that `dispatch` belongs to (ms since the epoch). The API's
 * mutation entries cannot say: a hook's entry goes with its component, and the button that made a write often leaves the page
 * with it. A read that started before this began without the write and answers the record as it stood. A refused write changed
 * nothing, so it does not count.
 */
export const lastReviewsWriteAnsweredAt = (dispatch: object) => lastWriteAnsweredAt.get(dispatch) ?? 0;

/**
 * The one reviews API, a skeleton: base query and tag types, no endpoints.
 * Endpoints live in one module per route family, each calling
 * `reviewsApi.injectEndpoints`, and a screen imports from the module it needs
 * (`intakeApi.ts`, `reviewApi.ts`, `albumReviewApi.ts`). There is deliberately
 * no barrel re-exporting them: it would become the next shared edit point.
 * Endpoints are typed only on the object `injectEndpoints` returns, so a
 * module exports that object for `endpoints.*.initiate` and `util` callers.
 *
 * Where a new endpoint goes:
 *
 * - An endpoint goes in the module of its route family: the first path
 *   segment of its `url`. `intake/...` goes in the intake module (so
 *   `fileIntakeItem`, `POST intake/{id}/file`, and `acceptReview`,
 *   `POST intake/{id}/accept-review`, go there even though they concern
 *   reviews). `reviews/...` goes in the review module (so `getItemReviews`,
 *   `GET reviews?intake_item_id=`, goes there). `album-reviews` goes in the
 *   album-review module. Any other first segment (`fcc-notes`, `library/...`)
 *   gets a new module for that family, named `<family>Api.ts`, which is the
 *   only file such a change creates. Never choose by which screen uses the
 *   endpoint.
 * - Tags are shared across modules. A module invalidates or provides any tag
 *   in `tagTypes`; a new tag type is one new line in `tagTypes`.
 * - A refusal predicate and its write-error wrapper live with the module whose
 *   endpoints reject with them.
 * - A unit test for an endpoint goes in the test file of its module, and its
 *   fake in the same-family builder in `tests/fakes/reviews/`.
 *
 * Rooted at the Backend-Service root, not at one domain: every endpoint's `url`
 * carries its own (`intake/...`, `reviews/...`, `fcc-notes...`). Review
 * mutations invalidate tags across those domains, and RTK Query tags do not
 * cross `createApi` instances, so they all live in this one API. Every read
 * fails loudly on a non-JSON body: each has an empty state that states a fact,
 * which an outage must never be mistaken for.
 */
export const reviewsApi = createApi({
  reducerPath: "reviewsApi",
  baseQuery: async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions);
    if (api.type === "mutation" && !result.error) lastWriteAnsweredAt.set(api.dispatch, Date.now());
    return result;
  },
  tagTypes: [
    "FccNotes",
    "Intake",
    "Review",
  ],
  endpoints: () => ({}),
});

/** Hook options for a list that re-reads when the window regains focus and once a minute while it is visible, so a board left open does not show a state that has changed. */
export const LIVE_LIST = { refetchOnFocus: true, pollingInterval: 60_000, skipPollingIfUnfocused: true } as const;
