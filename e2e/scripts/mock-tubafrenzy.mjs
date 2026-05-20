#!/usr/bin/env node
/**
 * Mock tubafrenzy endpoint for E2E.
 *
 * Backend-Service talks to tubafrenzy from two places (both read
 * TUBAFRENZY_URL, defaulting to https://www.wxyc.info, whose cert is
 * currently expired):
 *
 *   1. The legacy mirror (apps/backend/middleware/legacy/http.mirror.ts)
 *      POSTs every show/entry write. On per-attempt failure it loops 5x
 *      with exponential backoff (500ms + 1s + 2s + 4s + 8s = 15.5s of
 *      awaited delay) inside the request handler, starving the test's
 *      `expect(songInput).toHaveValue("", { timeout: 10000 })` window.
 *
 *   2. The playlist proxy (apps/backend/services/playlist-proxy.service.ts)
 *      opens an EventSource to /playlists/recentStream at backend startup.
 *      On error it reconnects with exponential backoff capped at 30s; if
 *      the server returns the wrong content-type the EventSource fires an
 *      error event immediately and the reconnect storm runs forever in the
 *      background — noisy in logs, an event-loop tax everywhere.
 *
 * This mock handles both shapes:
 *   - GET /playlists/recentStream → 200 + `text/event-stream` open stream
 *     (immediately sends an empty `init` event so processInitEvent gets a
 *     valid empty array; then heartbeat comments every 30s to keep the
 *     connection alive). EventSource stays connected, no reconnect storm.
 *   - Any other request → 200 + JSON `{id}` (the mirror's createShow and
 *     createEntry read `.id`; updateEntry and signoff don't read the body).
 *
 * See WXYC/dj-site#567. Bound to 127.0.0.1 only. Port via
 * $MOCK_TUBAFRENZY_PORT or 9091.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_TUBAFRENZY_PORT ?? 9091);
let nextId = 1;
const sseClients = new Set();

const server = createServer((req, res) => {
  // SSE endpoint — keep the connection open so playlist-proxy's EventSource
  // doesn't error-and-reconnect every loop iteration.
  if (req.method === 'GET' && req.url === '/playlists/recentStream') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Send an empty init so processInitEvent reaches `entries = []` and the
    // proxy reports `connected = true` instead of staying in error state.
    res.write('event: init\ndata: []\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Everything else (mirror writes) — JSON {id} works for createShow,
  // createEntry, updateEntry, signoff.
  req.on('data', () => {});
  req.on('end', () => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: nextId++ }));
  });
});

// Heartbeat keeps the SSE connection open across proxies/timeouts.
const heartbeat = setInterval(() => {
  for (const res of sseClients) res.write(': heartbeat\n\n');
}, 30_000);
heartbeat.unref();

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-tubafrenzy] listening on http://127.0.0.1:${PORT}`);
});

// Be a good background process: close SSE connections + exit cleanly on
// SIGTERM so CI cleanup is fast.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(heartbeat);
    for (const res of sseClients) res.end();
    server.close(() => process.exit(0));
  });
}
