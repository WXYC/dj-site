import { act } from "react";
import { reviewsApi } from "@/lib/features/reviews/api";

const TURNS = 5;

const turns = async () => {
  for (let turn = 0; turn < TURNS; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Any store with `reviewsApi` mounted: the app store, or a spec's own `configureStore`. */
type ReviewsStore = { getState(): unknown };

export const pendingCount = (store: ReviewsStore) => {
  const api = (store.getState() as Record<string, ReturnType<typeof reviewsApi.reducer>>)[reviewsApi.reducerPath];
  return [...Object.values(api.queries), ...Object.values(api.mutations)].filter(
    (entry) => entry?.status === "pending",
  ).length;
};

/**
 * Waits one animation frame inside `act`. RTK batches its store notifications
 * to the next animation frame, so a store that already holds a settled answer
 * can still be rendering the answer before it. Flushing that frame inside
 * `act` lets React render the settled answer before a DOM assertion runs.
 */
export const renderedFrame = async () => {
  // A DOM-free spec (the node tier) has no render to wait for, and this file must stay free of
  // the testing library so the node tier can reach it.
  if (typeof requestAnimationFrame !== "function") return;
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
};

/**
 * Resolves once `reviewsApi` has no query or mutation pending in `store`, after
 * the turns a render's effects need to start their requests and the turns the
 * client needs to act on the last answer. An absence assertion that follows
 * runs after every request the render or the mutation started has been
 * answered, which a fixed sleep cannot promise on a loaded runner. It ends by
 * flushing the animation frame RTK batches its notifications to, inside `act`,
 * so the DOM the caller asserts on already shows the settled answer: the store
 * settling alone does not mean React has rendered it, and an absence assertion
 * against the stale DOM passes whatever the settled answer says.
 *
 * It never resolves for a read whose handler never answers: a case that holds
 * a read pending asserts during the hold instead.
 */
export async function reviewsSettled(store: ReviewsStore): Promise<void> {
  await turns();
  while (pendingCount(store) > 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await turns();
  await renderedFrame();
  // An answer can start a follow-up request (an invalidated tag refetches).
  if (pendingCount(store) > 0) return reviewsSettled(store);
}
