/*
 * Throwaway service worker for the Safari service-worker spike. This branch
 * never merges. Plain script, no build step and no imports, so every browser
 * runs it as is. See spike/README.md.
 *
 * It answers GET requests under /spike/audio/<track-id> the way the real
 * review-audio worker will:
 *   1. one same-origin JSON lookup for the track's URL (standing in for the
 *      audio route's `200 {"url": ...}` answer);
 *   2. one fetch of that URL with a bounded Range and no Authorization;
 *   3. the 206 handed back to the element.
 * Every other request passes through untouched.
 */
"use strict";

var AUDIO_PREFIX = "/spike/audio/";
var SOURCES_URL = "/spike/sources.json";
var OVERRIDE_CACHE = "spike-url-overrides";
var LOG_CACHE = "spike-request-log";
var MIB = 1024 * 1024;
var MIN_CHUNK = 1 * MIB;
var MAX_CHUNK = 8 * MIB;
var DEFAULT_CHUNK = 2 * MIB;
var CHUNK_SECONDS = 30;

// A new id each time the browser starts this worker. If the id in the log
// changes mid-listen, the browser stopped the worker and started it again.
var INSTANCE = Math.random().toString(36).slice(2, 8);
var INSTANCE_STARTED = new Date().toISOString();
var seq = 0;

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "claim") {
    // A hard reload leaves the page uncontrolled although this worker is
    // active; the page asks for a fresh claim.
    event.waitUntil(self.clients.claim());
  } else if (data.type === "ping" && event.source) {
    event.source.postMessage({ type: "pong", instance: INSTANCE, startedAt: INSTANCE_STARTED });
  }
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(AUDIO_PREFIX)) {
    return; // not ours: the browser handles it as if no worker existed
  }
  if (event.request.method !== "GET") {
    return;
  }
  var finish;
  var done = new Promise(function (resolve) {
    finish = resolve;
  });
  // Keep the worker alive until the record is final (a rebuilt body streams
  // after respondWith has settled).
  event.waitUntil(done);
  event.respondWith(answer(event, url, finish));
});

/** Bytes in one chunk of about 30 seconds at `kbps`, clamped to [1, 8] MiB. */
function chunkBytes(kbps) {
  if (!(kbps > 0)) {
    return DEFAULT_CHUNK;
  }
  var bytes = Math.round(((kbps * 1000) / 8) * CHUNK_SECONDS);
  return Math.min(MAX_CHUNK, Math.max(MIN_CHUNK, bytes));
}

/** `bytes=N-` or `bytes=N-M` -> {start, end|null}; anything else -> null. */
function parseRange(header) {
  var m = /^bytes=(\d+)-(\d*)$/.exec((header || "").trim());
  if (!m) {
    return null;
  }
  return { start: Number(m[1]), end: m[2] === "" ? null : Number(m[2]) };
}

/**
 * The rule D7a specifies: no Range means `bytes=0-`; an open range becomes
 * one chunk; a closed range is never widened, only clamped to the ceiling.
 */
function boundRange(header, chunk) {
  if (!header) {
    return { range: "bytes=0-" + (chunk - 1), rule: "none->chunk" };
  }
  var asked = parseRange(header);
  if (!asked) {
    return { range: header, rule: "passed (unparsed)" };
  }
  if (asked.end === null) {
    return { range: "bytes=" + asked.start + "-" + (asked.start + chunk - 1), rule: "open->chunk" };
  }
  if (asked.end - asked.start + 1 > MAX_CHUNK) {
    return { range: "bytes=" + asked.start + "-" + (asked.start + MAX_CHUNK - 1), rule: "closed->ceiling" };
  }
  return { range: header, rule: "as asked" };
}

function ms(since) {
  return Math.round(performance.now() - since);
}

async function answer(event, url, finish) {
  var request = event.request;
  var started = performance.now();
  var params = url.searchParams;
  var trackId = decodeURIComponent(url.pathname.slice(AUDIO_PREFIX.length));
  var kbps = Number(params.get("kbps")) || null;
  var mode = params.get("respond") === "rebuilt" ? "rebuilt" : "direct";
  var chunk = chunkBytes(kbps);
  var asked = request.headers.get("Range");
  var bound = boundRange(asked, chunk);
  seq += 1;
  var rec = {
    id: INSTANCE + "-" + seq,
    instance: INSTANCE,
    load: params.get("load") || "",
    session: params.get("session") || "",
    track: trackId,
    mode: mode,
    at: new Date().toISOString(),
    asked: asked || "(none)",
    sent: bound.range,
    rule: bound.rule,
    chunk: chunk,
  };

  try {
    var found = await lookup(trackId, seq);
    rec.lookupMs = found.lookupMs;
    rec.urlFrom = found.from;
    if (!found.url) {
      rec.error = "no URL for this track: paste one into the page's form";
      return settle(rec, finish, new Response(null, { status: 404, statusText: "No URL" }));
    }

    // The URL itself is never recorded: a presigned URL is a credential.
    var s3 = await fetch(found.url, {
      headers: { Range: bound.range },
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: request.signal,
    });
    rec.status = s3.status;
    rec.ttfbMs = ms(started);
    rec.contentRange = s3.headers.get("Content-Range") || "";
    rec.bytes = Number(s3.headers.get("Content-Length")) || null;
    rec.type = s3.headers.get("Content-Type") || "";
    rec.acceptRanges = s3.headers.get("Accept-Ranges") || "";
    if (s3.redirected) {
      rec.note = "S3 fetch followed a redirect";
    }
    if (s3.status === 206 && !rec.contentRange) {
      rec.error = "Content-Range not readable: is it in the bucket's CORS ExposeHeaders?";
    }
    if (!s3.ok) {
      rec.error = "S3 answered " + s3.status + (await s3Code(s3));
    }

    if (mode === "direct" || !s3.ok || !s3.body) {
      // D7a as written: S3's own response goes back to the element.
      return settle(rec, finish, s3);
    }
    return rebuilt(rec, finish, s3, found.mime, started);
  } catch (err) {
    rec.ttfbMs = ms(started);
    if (err && err.name === "AbortError") {
      rec.aborted = true;
      rec.error = "the element aborted the request";
    } else {
      rec.error = "fetch failed: " + (err && err.message ? err.message : String(err)) + " (CORS or network)";
    }
    return settle(rec, finish, new Response(null, { status: 502, statusText: "Spike fetch failed" }));
  }
}

/**
 * The stand-in for the route's round trip: one same-origin JSON fetch per
 * request, never from a cache. An override the page saved in Cache Storage
 * then wins over the committed (empty) URL.
 */
async function lookup(trackId, n) {
  var t0 = performance.now();
  var res = await fetch(SOURCES_URL + "?track=" + encodeURIComponent(trackId) + "&n=" + n, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  var lookupMs = ms(t0);
  if (!res.ok) {
    throw new Error("lookup answered " + res.status);
  }
  var json = await res.json();
  var entry = (json.tracks || []).filter(function (t) {
    return t.id === trackId;
  })[0];
  var found = { url: entry ? entry.url : "", from: "sources.json", lookupMs: lookupMs, mime: entry ? entry.mime : "" };
  var cache = await caches.open(OVERRIDE_CACHE);
  var saved = await cache.match("/spike/url/" + encodeURIComponent(trackId) + ".json");
  if (saved) {
    var body = await saved.json();
    if (body && body.url) {
      found.url = body.url;
      found.from = "override";
    }
  }
  return found;
}

/** S3's error code (for example AccessDenied), never its whole body. */
async function s3Code(res) {
  try {
    var text = await res.clone().text();
    var m = /<Code>([^<]+)<\/Code>/.exec(text);
    return m ? " " + m[1] : "";
  } catch (e) {
    return "";
  }
}

/** A new 206 with the same bytes, streamed through a counter. */
function rebuilt(rec, finish, s3, mime, started) {
  var reader = s3.body.getReader();
  var delivered = 0;
  var closed = false;
  function close(aborted, error) {
    if (closed) {
      return;
    }
    closed = true;
    rec.delivered = delivered;
    rec.totalMs = ms(started);
    if (aborted) {
      rec.aborted = true;
    }
    if (error) {
      rec.error = error;
    }
    report(rec).then(finish, finish);
  }
  var body = new ReadableStream({
    pull: function (controller) {
      return reader.read().then(
        function (step) {
          if (step.done) {
            controller.close();
            close(false);
            return;
          }
          delivered += step.value.byteLength;
          controller.enqueue(step.value);
        },
        function (err) {
          controller.error(err);
          close(true, "body failed: " + (err && err.message ? err.message : String(err)));
        }
      );
    },
    cancel: function (reason) {
      reader.cancel(reason).catch(function () {});
      close(true);
    },
  });
  var headers = new Headers();
  headers.set("Content-Type", mime || s3.headers.get("Content-Type") || "application/octet-stream");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");
  if (rec.contentRange) {
    headers.set("Content-Range", rec.contentRange);
  }
  if (rec.bytes) {
    headers.set("Content-Length", String(rec.bytes));
  }
  report(rec); // the headers-time record; the final one follows the body
  return new Response(body, { status: s3.status, statusText: "Partial Content", headers: headers });
}

function settle(rec, finish, response) {
  report(rec).then(finish, finish);
  return response;
}

/** Store the record (so a page that was asleep can catch up) and post it. */
async function report(rec) {
  var copy = JSON.parse(JSON.stringify(rec));
  try {
    var cache = await caches.open(LOG_CACHE);
    await cache.put(
      "/spike/__log/" + copy.id,
      new Response(JSON.stringify(copy), { headers: { "Content-Type": "application/json" } })
    );
  } catch (e) {
    copy.note = (copy.note ? copy.note + "; " : "") + "log not stored: " + e.message;
  }
  var all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  all.forEach(function (client) {
    client.postMessage({ type: "record", record: copy });
  });
}
