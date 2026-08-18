# Catalog MD visual integration — progress

Branch: `feat/catalog-md-visual` (worktree `dj-site-worktrees/catalog-md-visual`), based on `195ee80b`.

Goal: album detail opens as the intercepting-route modal everywhere (rightbar reserved for NowPlaying/Bin); port the recovered visual components from commit `02d54bdb` (code-preview badge, artwork+code overlay, form-section cards, rotation bin picker chips, result context menu) onto the current MD catalog-edit functionality; `color="success"` on all MD write affordances.

Slicing: PR A (popup everywhere + retire `album-detail` panel + relocate `Rightbar/panels/album` → `catalog/album`) → PR B (visual ports) → PR C (context menu) → PR D (success recolor).

## Log

### 2026-08-17 — Phase 0
- Main pulled `fb2778b7` → `195ee80b`; drifted anchors re-verified: 5 `openPanel({type:"album-detail"})` call sites confirmed (Result.tsx:63,202; MobileResult.tsx:42; SongEntryControls.tsx:110; useBinEntryActions.ts:76 — all using `album.id!` assertions, to be replaced with null guards); `RotationClassifyControl` guards via `albumIdValid = album.id !== null && album.id > 0`; ArtistAddForm submit now at :320 post-refactor.
- PR #1019 closed without merge (pin-rail abandoned; modal path already landed via the `@information` route).
- Worktree created, `npm install` running.
- Backend stack DOWN (nothing on 8080/8082/5432) — waiting on Jackson to run `start-wxyc-dev.sh` before dev-server baseline screenshots.

### 2026-08-17 — PR A implemented (verification pending)
- A1 `9a90d047`: five call sites → `router.push(/dashboard/album/[id])` with null-id guards; tests rewritten to assert navigation (incl. new null-id no-op cases).
- A2 `e87f09d9`: `album-detail` dropped from the RightbarPanel union; `AlbumDetailPanel` deleted; slice/Rightbar tests re-anchored on settings/account-edit.
- A3 `31dae687`: `Rightbar/panels/album` → `catalog/album` (components + 7 test files, `git mv`); `@information` modal imports fixed, docstring updated (issue refs dropped per repo rule); e2e `album-detail.page.ts` retargeted from `.SecondSidebar` to the `[aria-label="Album detail"]` modal.
- **BLOCKED on verification**: worktree `npm install` 403s on `@wxyc/shared@3.5.0` (GitHub Packages token lacks scopes — `~/.npmrc` token likely stale; fresh `NPM_TOKEN` lives in Jackson's `.wxyc-dev-overrides.env`). tsc/vitest/dev-server all pending that + backend stack. Commits above are unverified until then.
