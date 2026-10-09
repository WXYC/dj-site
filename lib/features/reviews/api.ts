import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";

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
  baseQuery: backendBaseQuery("", { surfaceNonJsonAsError: true }),
  tagTypes: [
    "FccNotes",
    "Intake",
    "Review",
  ],
  endpoints: () => ({}),
});
