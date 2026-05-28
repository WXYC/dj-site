# dj-site

The DJ flowsheet and card catalog frontend for WXYC 89.3 FM. DJs use this app during their shows to log what they play; listeners hit `/live` to see what's playing now.

## Language

### "Live" — disambiguation

This codebase uses "live" for several distinct concepts. Pick one when writing or speaking.

**Live show**: A show currently airing on the station, regardless of whether a human DJ or AutoDJ is hosting.
_Avoid_: active show, current show, on-air show.

**Live DJ**: A human DJ on air (as distinct from AutoDJ).
_Avoid_: real DJ, human DJ once "live DJ" is the local term.

**Live view**: The public page at `app/live/` that listeners (not DJs) hit. Renders the `NowPlaying` widget.
_Avoid_: now-playing page (the widget is reused elsewhere), listener view.

**Live updates**: Real-time UI updates driven by SSE events from Backend-Service. The flowsheet refreshes immediately on event receipt, not on a polling cycle.
_Avoid_: real-time updates, push updates, streaming updates.

**liveFs**: The Backend-Service SSE topic (`Topics.liveFs = 'live-fs-topic'`) that dj-site subscribes to for live updates. See `Backend-Service/apps/backend/utils/serverEvents.ts`.
_Avoid_: flowsheet topic, fs topic, the SSE channel.

### SSE event types on `liveFs`

**liveFs:update**: A per-row event emitted when a flowsheet row's LML metadata enrichment reaches a terminal state. The payload includes the full row inline so consumers patch their cache directly without a refetch. See the `LIVE_FS_UPDATE_INCLUDES_FULL_ROW` contract in `wxyc-shared/src/contracts.ts`.

**liveFs:refetch**: A coarse "the world changed" event emitted from ETL or webhook batch imports. The payload only names the source. Consumers invalidate the flowsheet cache and refetch.

### Flowsheet vocabulary

**Flowsheet**: The append-only log of every entry during a show. `play_order` is strictly increasing within a single `show_id` (see `wxyc-shared/src/contracts.ts` → `PLAY_ORDER_PER_SHOW_MONOTONIC`).

**Flowsheet entry**: A single row in the flowsheet. May be a song play, a breakpoint (station ID, talk segment), or a show boundary (start/end of show).
_Avoid_: flowsheet record, fs entry.

## Example dialogue

> A: "Why is the live view stale right now?"
>
> B: "Live updates are off behind the feature flag, so the live view is still on the 60-second polling cycle. Once we flip `NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED` on, it'll subscribe to liveFs and the now-playing row will refresh whenever a liveFs:update arrives — which fires every time a row's LML enrichment lands. If the enrichment never completes, the live update never fires, but the 5-minute safety poll catches the gap."
>
> A: "What if the live DJ adds a song and enrichment hasn't run yet?"
>
> B: "DJ A sees the row immediately because the optimistic update from the mutation hits their own cache. DJ B and the live view see it once enrichment fires liveFs:update — typically a few seconds later. For coarse changes like ETL batch imports, it's liveFs:refetch instead, and we invalidate the whole flowsheet cache."
