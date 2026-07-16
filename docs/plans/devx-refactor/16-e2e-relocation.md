# S16 — e2e-relocation (OPTIONAL, LAST)

Status: pending, requires go/no-go with Jackson · Risk: simple but config-churny (Sonnet) · PR: —

## Task

Move `e2e/` → `tests/e2e/` for strict CLAUDE.md layout compliance.

## Go/no-go

The census recommends AGAINST by default: `e2e/` is already semantically organized
with its own config/tsconfig, and moving it churns `e2e/playwright.config.ts` paths,
`package.json` scripts, docker scripts, and CI. Alternative: document `e2e/` as the
sanctioned Playwright location and treat `tests/` as the vitest hierarchy. Decide with
Jackson at gate M4/M5.

## Desired outcome (if go)

`e2e/` relocated to `tests/e2e/` with `package.json` scripts, playwright config
relative paths, docker/CI scripts, and docs updated; `npm run test:e2e` green in CI.

## Preserved behavior

All 26 specs, auth setup project, helpers, and fixtures unchanged beyond paths.

## Verification

Baseline commands + full CI e2e run on the PR; `npm run test:scripts` (deploy scripts
reference paths).
