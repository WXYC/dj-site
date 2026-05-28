# scripts/devtools

Browser-side debugging aids. Run by hand from the console or installed as bookmarklets — not part of the build, not exercised by CI.

## fake-live

Visually test UI that's gated on `live === true` (rotation dropdown, entry form, GoLive button, NowPlaying badge) without actually going on-air. The script intercepts `GET /flowsheet/djs-on-air` client-side and injects your user into the response; it also patches the RTK Query cache directly so the UI flips on the next render tick. No backend writes, no interference with anyone actually live, no impact on iOS / listeners / archive segmentation.

**Do not submit flowsheet entries while faked.** The backend still thinks you're off-air, so writes will 403 (or worse, land as orphaned rows if a policy gap lets them through).

### Install

Open [`fake-live.html`](./fake-live.html) in a browser, drag the green button to your bookmarks bar. On `dj.wxyc.org/dashboard/flowsheet`, click the bookmark to flip live. Run `window._unfakeLive()` in the console to revert.

### Regenerate the bookmarklet

The HTML wraps `fake-live.js` as a URL-encoded `javascript:` link. After editing the `.js`, regenerate the `.html`:

```bash
node -e 'const fs=require("fs"); const src=fs.readFileSync("scripts/devtools/fake-live.js","utf8"); const bm="javascript:"+encodeURIComponent(src); const h=fs.readFileSync("scripts/devtools/fake-live.html","utf8"); fs.writeFileSync("scripts/devtools/fake-live.html", h.replace(/href="javascript:[^"]*"/, `href="${bm.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"`));'
```

### How it works

1. **Walk the React fiber tree** to find the Redux store on the `<Provider>` (Next.js 16 prod builds don't expose `__reactContainer$…`, only `__reactFiber$…`, so we grab any fiber, walk up to root, then BFS down looking for `memoizedProps.store`).
2. **Dispatch `flowsheetApi/queries/queryResultPatched`** with Immer patches to inject the user into the `whoIsLive` cache synchronously — UI flips this tick, no round-trip flash.
3. **Patch `window.fetch`** so the 60-second polling refetch arrives already-injected.
4. **Subscribe to the store** so any code path that wipes the user (`leaveShow` optimistic update, race with an unpatched in-flight fetch) gets re-corrected in the same dispatch chain.

The action types (`flowsheetApi/queries/queryResultPatched`, `flowsheetApi/invalidateTags`) and the fiber-walk heuristic depend on RTK Query and React internals. They've been stable across recent versions but are not public API — if a future upgrade breaks the script, the failure is loud (no UI flip) and the fix is local.
