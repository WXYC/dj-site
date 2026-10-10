import { reviewsApi } from "@/lib/features/reviews/api";

const TURNS = 5;

const turns = async () => {
  for (let turn = 0; turn < TURNS; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Any store with `reviewsApi` mounted: the app store, or a spec's own `configureStore`. */
type ReviewsStore = { getState(): unknown };

const pendingCount = (store: ReviewsStore) => {
  const api = (store.getState() as Record<string, ReturnType<typeof reviewsApi.reducer>>)[reviewsApi.reducerPath];
  return [...Object.values(api.queries), ...Object.values(api.mutations)].filter(
    (entry) => entry?.status === "pending",
  ).length;
};

/**
 * Resolves once `reviewsApi` has no query or mutation pending in `store`, after
 * the turns a render's effects need to start their requests and the turns the
 * client needs to act on the last answer. An absence assertion that follows
 * runs after every request the render or the mutation started has been
 * answered, which a fixed sleep cannot promise on a loaded runner.
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
  // An answer can start a follow-up request (an invalidated tag refetches).
  if (pendingCount(store) > 0) await reviewsSettled(store);
}
