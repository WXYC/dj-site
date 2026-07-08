# Flowsheet Search Bar — Baseline Screenshots

Captured from `main` @ `e710c7d` before the flowsheet entry redesign (Phase 0).

## States

| State | Description |
|-------|-------------|
| `idle` | Bar unfocused, no draft |
| `focused` | Artist segment focused, dropdown closed |
| `ghost` | Inline completion visible on artist or song |
| `results-open` | Dropdown open with search results |
| `result-highlighted` | Arrow-key highlight on a catalog result |
| `rotation-mode` | Rotation scope active with browse cascade |

## Viewports

1280px, 900px, 600px, 375px — light and dark themes.

## Capture

Run with Backend-Service and dj-site dev server:

```bash
npm run dev
npx playwright test e2e/tests/flowsheet/baseline-capture.spec.ts
```

## E2E baseline (pre-redesign)

All flowsheet e2e specs passed on `main` before implementation:

- `artist-search-crash-smoke.spec.ts`
- `flowsheet-track-picker.spec.ts`
- `library-search-proxy.spec.ts`
- `entry-caching.spec.ts`
- `audio-stream.spec.ts`
