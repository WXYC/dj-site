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

### 2026-08-18 — install unblocked; PRs A–D delivered
- npm token saga resolved: the env-exported `NPM_TOKEN` (gh CLI token, no read:packages) was shadowing everything via the repo `.npmrc`'s `${NPM_TOKEN}` expansion; the secrets-store key had expired. Jake pushed a fresh key to WXYC/secrets; installs now run with `NPM_TOKEN` piped from `gpg -d secrets.txt.gpg`.
- **Stacked PRs, all verified (tsc clean, lint 0 err/194 warn, suite green 339 files / 4824 tests):**
  - **#1243** (A, base main): album modal everywhere; `album-detail` panel retired; components → `catalog/album/`; e2e page object → modal.
  - **#1244** (B, base A): CatalogCodePreview (genreTone/formatTone rewire), AlbumArtworkWithCodeOverlay in AlbumCard, FormSectionCard (+ `--wxyc-` var fix) wrapping the three MD sections, CatalogRotationBinPicker (theme rotation tokens; role=group not radiogroup, input-level aria-labels).
  - **#1245** (C, base B): result context menu — local menu state in Results, RequireMD-composed MD section, shared `useAlbumRotationEntries`, kill-then-add re-binning, fail-closed unknown state, fetch-count-pinned.
  - **#1246** (D, base C): `color="success"` on all MD write affordances.
- **Real bug caught by CI** (PR A e2e): after dismissal `router.back()` restored the URL but the `@information` intercepted slot stayed mounted with stale content — modal survived its own close. Fixed in `ff43a7c6` with a pathname guard (URL is the authority); jsdom test added; B/C/D rebased forward.
- Late-run full-suite flake (ArtistAddForm/ArtistSearchTypeahead/FormatAdmin MD suites, timing) — passed in isolation and on full rerun; not related to this work.
- **Still owed**: dev-server walkthrough + screenshots (backend stack never came up this session — flagged in every PR body); merge order A→B→C→D with branch retargeting as each merges.
