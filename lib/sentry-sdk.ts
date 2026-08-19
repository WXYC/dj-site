// The deferred-chunk entry point for @sentry/browser.
//
// This re-export exists for bundle size, not organization: `import("@sentry/
// browser")` binds the whole namespace, so the bundler must keep every export
// alive — including `replayIntegration` and the recorder it drags in (~144 kB
// gzipped of code this app never calls, since replay is deliberately off).
// Naming the three functions the adapter actually uses lets the chunk
// tree-shake down to the error path. Import this module, never the package,
// from lib/sentry.ts — and add a name here only when the adapter needs it.
export { init, captureException, getClient } from "@sentry/browser";
