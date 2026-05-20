#!/usr/bin/env node
/**
 * Mock tubafrenzy mirror endpoint for E2E.
 *
 * The Backend-Service legacy mirror (apps/backend/middleware/legacy/http.mirror.ts)
 * POSTs every show/entry write to TUBAFRENZY_URL, defaulting to
 * https://www.wxyc.info — whose cert is currently expired. In E2E the
 * resulting per-attempt failure cascades through a 5-attempt exponential
 * backoff loop (500ms + 1s + 2s + 4s + 8s = 15.5s of awaited delay) inside
 * the request handler, which routinely starves the test's
 * `expect(songInput).toHaveValue("", { timeout: 10000 })` window and trips
 * the entry-caching.spec.ts flake (see WXYC/dj-site#567).
 *
 * This mock returns 200 + a synthetic id to all mirror writes so the loop
 * never retries. ~10 lines, no dependencies, starts in <100ms.
 *
 * Bound to localhost only. Port from $MOCK_TUBAFRENZY_PORT or 9091.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_TUBAFRENZY_PORT ?? 9091);
let nextId = 1;

const server = createServer((req, res) => {
  // Consume the body to satisfy Node's parser; we don't inspect it.
  req.on('data', () => {});
  req.on('end', () => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // mirrorCreateShow and mirrorCreateEntry both read `.id` from the JSON
    // response. mirrorUpdateEntry and the signoff endpoint don't read the
    // body. Returning `{id}` for everything keeps all paths happy.
    res.end(JSON.stringify({ id: nextId++ }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-tubafrenzy] listening on http://127.0.0.1:${PORT}`);
});

// Be a good background process: exit cleanly on SIGTERM so CI cleanup is fast.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
