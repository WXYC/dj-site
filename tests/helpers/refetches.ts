import { reviewsApi } from "@/lib/features/reviews/api";
import { reviewsSettled } from "./reviews-settled";

/** An RTK Query `initiate(...)` thunk, read or write. */
type Initiated = (...args: never[]) => unknown;

// `dispatch` is as loose as `store.dispatch(thunk)` needs to be: a spec's own `configureStore` and the app store
// both type it differently, and this file must stay free of the testing library so the node tier can reach it.
type ReviewsStore = {
  getState(): unknown;
  dispatch(action: never): unknown;
};

type Subscription = { queryCacheKey: string; unsubscribe(): void } & PromiseLike<unknown>;

const requestIdOf = (store: ReviewsStore, key: string) => {
  const api = (store.getState() as Record<string, ReturnType<typeof reviewsApi.reducer>>)[reviewsApi.reducerPath];
  return api.queries[key]?.requestId;
};

/**
 * Subscribes every read in `reads`, waits for them to settle, dispatches `write` (answered or refused) and waits
 * with `reviewsSettled`. Returns the names of the reads whose cache entry started a new request in between: the
 * reads the write refreshed. A spec pins both what refetched and what did not with one equality:
 *
 *   expect(await refetchesAfter(store, { list, item7 }, write)).toEqual(new Set(["list"]));
 *
 * The reads are answered by whatever handlers the spec already registers; nothing here counts requests.
 * A read counts as refetched when its entry's `requestId` changed. `startedTimeStamp` moves with it but has
 * millisecond resolution, so an immediate refetch can share the first request's stamp; the id cannot.
 *
 * The reads must be `reviewsApi` endpoints: the request ids are read from that one slice, so a read from another
 * `createApi` (catalogApi, rotationApi) would read as unchanged and be reported as not refetched, a silent false
 * negative. Supporting other APIs would mean resolving each read's owning slice from its thunk, which is more than
 * a few lines, so the helper throws instead: once the reads settle, a read with no entry in the `reviewsApi` slice
 * rejects with an error naming it, before the write is dispatched.
 *
 * The helper never resolves while a handler holds a read or the write and never answers (`reviewsSettled` waits
 * on it), so hold a response only in a spec that releases it before the helper is called.
 */
export async function refetchesAfter(
  store: ReviewsStore,
  reads: Record<string, Initiated>,
  write: Initiated,
): Promise<Set<string>> {
  const dispatch = store.dispatch as (action: unknown) => unknown;
  const subscriptions = Object.entries(reads).map(
    ([name, read]) => [name, dispatch(read) as Subscription] as const,
  );
  try {
    await Promise.all(subscriptions.map(([, subscription]) => subscription));
    await reviewsSettled(store);
    const before = new Map(subscriptions.map(([name, s]) => [name, requestIdOf(store, s.queryCacheKey)]));
    for (const [name, requestId] of before) {
      if (requestId === undefined) {
        throw new Error(
          `refetchesAfter: the read "${name}" has no entry in the reviewsApi cache. Reads must be reviewsApi endpoints; a read from another API cannot be observed here and would be reported as not refetched.`,
        );
      }
    }

    await dispatch(write);
    await reviewsSettled(store);

    return new Set(
      subscriptions
        .filter(([name, s]) => requestIdOf(store, s.queryCacheKey) !== before.get(name))
        .map(([name]) => name),
    );
  } finally {
    subscriptions.forEach(([, subscription]) => subscription.unsubscribe());
  }
}
