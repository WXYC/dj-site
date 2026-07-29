/**
 * Flag-gated server-phase timing for the SSR critical path.
 *
 * The literal `Server-Timing` HTTP header isn't reachable for RSC-rendered
 * routes in this OpenNext/Cloudflare setup: middleware doesn't run on
 * `/dashboard/catalog` (its matcher is `/dashboard/admin/*`), and Server
 * Components can't set response headers. So instead of a header, each
 * instrumented call self-reports its own duration inline — wherever in the
 * render tree it executes — which sidesteps any need for `after()` and captures
 * work that renders later (e.g. behind a Suspense boundary). The lines are
 * picked up by Cloudflare Workers Logs.
 *
 * Off by default (zero steady-state cost on the hot authenticated path). Enable
 * for a measurement window with `SERVER_TIMING=1`. The flag is read at call
 * time so it can be toggled without a rebuild.
 */
export async function measure<T>(
  phase: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  if (process.env.SERVER_TIMING !== "1") return fn();

  const start = performance.now();
  try {
    return await fn();
  } finally {
    const dur = Math.round((performance.now() - start) * 10) / 10;
    // Bracketed tag matches the repo's greppable `[flowsheet]`/`[roster]`
    // console convention; the structured second arg is the Workers-Logs query
    // payload. `finally` so a failed phase is timed too.
    console.warn("[server_timing]", { phase, dur, ...meta });
  }
}
