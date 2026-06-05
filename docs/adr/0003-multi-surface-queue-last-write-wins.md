# Multi-surface Queue editing is last-write-wins, no presence/locking in v1

Starting in v1, the iOS DJ tool joins us as a first-class authorized writer of flowsheet entries — reading the live Queue, posting new track entries from Mail Bin and search results, reordering via `PATCH /flowsheet/play-order`, and deleting entries. Both surfaces operate on the same Queue resource and **last write wins**: no multi-surface presence indicator, no per-row lock, no soft-lock countdown. We accept the race because Queue edits are short, infrequent, single-DJ-per-show in practice, and the cost of building presence outweighs the realistic collision rate.

There are two near-term implications we should track. **First**, iOS will exercise `PATCH /flowsheet/play-order` before we do — our [`handleReorder`](../../app/dashboard/%40modern/flowsheet/%40queue/page.tsx) is currently a no-op. iOS doesn't block on us re-enabling reorder, but if a DJ uses iOS to reorder and then loads dj-site, the reorder will be visible here even though dj-site can't (yet) initiate one. Re-enabling reorder on our side is our call. **Second**, the Mail Bin → Queue handoff uses the same `convertBinToQueue` semantics we already use ([`lib/features/bin/conversions.ts`](../../lib/features/bin/conversions.ts)) — queue with empty `track_title`, DJ fills on-air. iOS mirrors this; the deferred catalog-track-search Track 3 ([wiki/plans/catalog-track-search.md §5.3](https://github.com/WXYC/wiki/blob/main/plans/catalog-track-search.md)) is the future replacement (proper inline track selection) and is canonically ours to implement first.

Canonical source: [`wxyc-dj-tool-ios/docs/cross-repo-adrs.md` ADR 0003](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/cross-repo-adrs.md#adr-0003--ios-is-an-in-show-companion-to-dj-site-queue-read--targeted-writes).

## Consequences

- No new client work for v1. Our SSE-driven live updates ([`docs/live-updates-sse.md`](../live-updates-sse.md)) propagate iOS's writes to our UI for free — the SSE topic doesn't care who wrote the row.
- If multi-surface collisions become an actual operational issue (rather than the theoretical one we're betting they won't), the future work is presence + soft-lock on a per-Queue-row basis, owned here because we're the surface where collisions are most likely to manifest visually.
