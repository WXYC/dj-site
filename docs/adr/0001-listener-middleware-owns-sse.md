# Listener middleware owns the live-updates SSE connection

When wiring dj-site to Backend-Service's `liveFs` SSE topic, the EventSource is owned by a custom Redux listener middleware, not by an RTK Query endpoint's `onCacheEntryAdded` and not by a React hook. Two reasons: (1) `liveFs:update` events affect multiple RTK Query caches (`getInfiniteEntries`, `getNowPlaying`, and eventually `whoIsLive`), so coupling the connection to any one endpoint misrepresents the data flow; (2) the connection's lifecycle should track surface mounts (dashboard, `/live`) and feature flags, not query subscribers — surfaces use a ref-counted `useSSEConnection()` hook that dispatches request/release actions.

## Considered Options

- **`onCacheEntryAdded` on an anchor query.** Idiomatic for RTK Query and gets cache lifecycle for free, but the connection would only be open when that one query has subscribers, even though three queries consume the events. Rejected.
- **Singleton React hook mounted near the root.** Simpler than middleware but couples connection lifetime to the render tree, awkward across the parallel routes (modern/classic/live), and gives no clean home for future cross-tab coordination. Rejected.
- **Listener middleware.** Connection is owned by the store, not by a component or a query. Cross-cache effects are first-class via `dispatch(api.util.updateQueryData(...))`. The eventual `BroadcastChannel` leader-election story fits inside the middleware without touching consumers. **Selected.**

## Consequences

- New pattern for this codebase — no prior `createListenerMiddleware` or hand-rolled-middleware-with-state precedent. Mitigated by keeping the file small (~150 LOC) and well-bounded; future contributors don't need to grok it to ship unrelated features.
- The ref-counted `useSSEConnection()` hook becomes the only sanctioned way for a surface to opt into live updates. Adding a new live-updates surface = one hook call in the page component.
- Swapping the transport (e.g., to a `BroadcastChannel`-coordinated singleton, or to `fetch + ReadableStream` if EventSource limitations bite) is contained to the middleware file. The dispatch surface stays identical.
