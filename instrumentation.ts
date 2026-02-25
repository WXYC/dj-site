export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./config/sentry/sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./config/sentry/sentry.edge.config");
  }
}

// Note: Sentry.captureRequestError is intentionally omitted here.
// It causes AsyncLocalStorage crashes on Cloudflare Workers.
// See: https://github.com/getsentry/sentry-javascript/issues/18842
