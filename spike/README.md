# Service-worker audio spike (throwaway)

This is the test harness for [WXYC/dj-site#2148](https://github.com/WXYC/dj-site/issues/2148): does Safari, on macOS and on the iPhone, send an `<audio>` element's range requests through a service worker, and does the worker keep answering in the background and with the phone locked? It lives on the branch `spike/safari-sw-audio` and **never merges**. When the spike is done, close its PR unmerged, delete the branch, and tear down the test bucket (see [Cleaning up](#cleaning-up)).

## Files

| File | What it is |
|---|---|
| `public/spike/index.html` | The test page, served at `/spike/`. |
| `public/spike/spike.js` | The page script: registers the worker, waits for control, drives the player, shows the log, copies the results. |
| `public/spike/spike.css` | Styles; works at iPhone width with no horizontal scroll. |
| `public/spike/sw.js` | The service worker, scope `/spike/`. A plain script with no build step and no imports. |
| `public/spike/sources.json` | The four tracks (id, label, format, MIME type, bitrate, file name) with empty URLs. Never commit a URL here. |
| `spike/make-test-audio.sh` | Makes the four ten-minute test tracks with ffmpeg. |
| `spike/make-test-bucket.sh` | The aws CLI commands for a private test bucket, the upload, and the presigned URLs. You run it; nothing in CI does. |
| `spike/.gitignore` | Keeps the generated audio out of git. |
| `scripts/post-build.js` | Changed on this branch only: excludes `/spike` and `/spike/*` from the OpenNext worker so Cloudflare Pages serves the harness as static files (see [Serving on Cloudflare Pages](#serving-on-cloudflare-pages)). |

This README and the two scripts sit in `spike/`, outside `public/`, because everything in `public/` is served on every preview deployment, and nothing here needs to be.

## Quick start for a tester

You need a Mac with Safari, Chrome and Firefox, an iPhone, ffmpeg 4.4 or newer, and the aws CLI v2 with the `wxyc-api` SSO profile.

1. **Make the audio.** `spike/make-test-audio.sh` writes four tracks to `spike/test-audio/` (git-ignored): MP3 320 kbps CBR, M4A/AAC 256 kbps, FLAC and WAV, about 180 MB in all. It takes well under a minute.
2. **Make the bucket.** `aws sso login --profile wxyc-api`, then `spike/make-test-bucket.sh create`. It creates a private bucket (default name `wxyc-dj-site-spike-sw-audio`; pass another as the second argument), applies the review bucket's audio CORS rule, uploads the four files with their content types, and prints four lines, `<id> <presigned URL>`. **The URLs are credentials:** paste them only into the spike page, never into an issue, a PR or a chat.
3. **Open the page.** Use the preview URL in the PR comment, with `/spike/` on the end. Prefer the **branch alias** (likely `https://spike-safari-sw-audio.dj-site.pages.dev/spike/`; the PR comment confirms it) over a per-commit `https://<hash>.dj-site.pages.dev` URL: saved URLs live in Cache Storage, which is per origin, so every new hash would need them pasted again. Both match the bucket's `https://*.dj-site.pages.dev` origin.
4. **Paste the URLs.** In "Track URLs", paste all four lines from step 2 into the "Save all" box, on each browser and on the phone. To get them onto the phone, use a channel only you can read (for example a note to yourself), and delete it afterwards.
5. **Run the checks** in step 5 of the issue, for each browser and format: pick the track, press play, let it run about a minute, press the three seek buttons and "Back to start", letting each settle for at least 15 seconds. Then do the background and lock checks (below).
6. **Copy the results.** "Copy results as Markdown" copies one table row per track you played on that page load, plus each track's request log and event log in collapsed sections. Paste it into the issue comment, fix the version and OS cells if needed (macOS browsers report "10.15.7" in the user agent), and fill in the "Background / locked" cell from what you saw and heard.

## The test audio

Each track is ten minutes of generated sound that tells you where the playhead is:

- a steady tone whose pitch rises a whole tone each minute (minute 0 is 220 Hz, minute 9 is about 622 Hz);
- every 10 seconds, a burst of short high pips: one at m:00, two at m:10, up to six at m:50;
- quiet pink noise underneath, so FLAC compresses like music rather than like a pure tone.

So a seek to 10% (1:00) lands on the second pitch with one pip, 50% (5:00) on the sixth pitch with one pip, and 90% (9:00) on the tenth. `DURATION_S=120 spike/make-test-audio.sh` makes shorter tracks for a quick try; the file names stay the same.

## What the page does

1. It registers `/spike/sw.js` with `scope: '/spike/'` and `updateViaCache: 'none'`.
2. It waits for `navigator.serviceWorker.ready`, then for the page to be controlled: at once if `navigator.serviceWorker.controller` is set, otherwise on `controllerchange`. The worker calls `clients.claim()` on activate. After a hard reload (which leaves the page uncontrolled while the worker is active) the page asks the worker to claim again.
3. Only then does it set the element's `src` to `/spike/audio/<id>?kbps=<bitrate>&respond=<mode>&load=<page-load id>&session=<n>`. Each track or mode change starts a new session.
4. Beside the element it shows `currentTime`, `duration`, the `buffered` ranges, the read-ahead (the end of the buffered range that holds the playhead, minus `currentTime`), the largest read-ahead so far, the element's state, and the chunk size for the track. Below that: every request the worker reports, and every element and page event (including `visibilitychange`, `pagehide`, `freeze` and `resume`).
5. It sets Media Session metadata, so the Lock Screen names the track.

The "Response" picker chooses how the worker answers:

- **S3's own response** (the default): the worker returns the `fetch()` response from S3 unchanged. This is what WXYC/dj-site#2150 specifies, so test this first.
- **Rebuilt response:** the worker returns a new `206` with the same status, `Content-Range`, `Content-Length`, `Content-Type` and `Accept-Ranges`, with the body streamed through a byte counter. Use it if a browser refuses S3's own response, to learn whether a rebuilt one works instead. The log then also shows the bytes the element actually read and when it stopped reading.

## What the worker does

For each `GET` under `/spike/audio/`, and nothing else:

1. It reads the element's `Range` and bounds it, with the rule WXYC/dj-site#2150 specifies:

   | Element asked | Worker sends to S3 |
   |---|---|
   | no `Range` | `bytes=0-<chunk-1>` |
   | `bytes=N-` (open) | `bytes=N-<N+chunk-1>` |
   | `bytes=N-M`, at most 8 MiB | unchanged (Safari's `bytes=0-1` probe included) |
   | `bytes=N-M`, more than 8 MiB | `bytes=N-<N+8 MiB-1>` (never widened, only clamped) |

   The chunk is about 30 seconds at the track's bitrate (from `kbps` in the element's URL), at least 1 MiB and at most 8 MiB: 1.14 MiB for the MP3, 1 MiB for the M4A, 5.05 MiB for the WAV. The FLAC's bitrate is unknown, so it gets the 2 MiB default.
2. It makes one same-origin JSON fetch, `/spike/sources.json?track=<id>&n=<seq>` with `cache: 'no-store'` and `Accept: application/json`. That is the stand-in for the audio route's `200 {"url": …}` round trip; its time is the "lookup ms" column.
3. It fetches the track's URL with the bounded `Range`, `mode: 'cors'`, `credentials: 'omit'`, `cache: 'no-store'`, the element's abort signal, and no `Authorization`.
4. It answers the element with the `206`, and posts a record of the request to every window client. It also stores the record in Cache Storage (`spike-request-log`), so a page that was asleep catches up when it becomes visible again.

## How a track's URL reaches the worker

The committed `sources.json` has empty URLs, because a presigned URL is a credential and this repo is public. The page's form saves a URL per track as a Cache Storage entry, `/spike/url/<id>.json` in the cache `spike-url-overrides`, holding `{"url": "…"}`. Both the page and the worker can read Cache Storage for the origin, and it survives the browser stopping and restarting the worker, which in-memory state and `postMessage` do not.

On every request the worker still makes the network fetch of `sources.json` (step 2 above), so each request pays one real same-origin round trip, as it will against the route. It then takes the URL from the saved entry when there is one, and from `sources.json` otherwise. A cache-first lookup would skip the round trip whenever a URL was saved, which is always, so it would hide the cost the spike should see.

The URL itself never appears in the log, the event list or the copied results; the log shows only where it came from.

## Reading the log

| Column | Meaning |
|---|---|
| `t (s)` | Seconds from the session's start (when the page set `src`) to the request reaching the worker. |
| `asked` | The element's `Range` header, without `bytes=`. `(none)` means no header. |
| `sent` | The bounded range the worker asked S3 for. |
| `status` | S3's status. `...` means the worker has not heard back yet. |
| `returned` | S3's `Content-Range`. If a `206` shows nothing here, the bucket's CORS rule does not expose `Content-Range`. |
| `bytes` | S3's `Content-Length`; in the rebuilt mode, also the bytes the element read. |
| `lookup ms` | The same-origin JSON round trip. |
| `ms` | From the request reaching the worker to S3's headers; in the rebuilt mode, `/` the time to the end of the body. |
| `worker` | The worker instance. A new id means the browser stopped the worker and started it again. |
| `note` | The bounding rule when it changed the range, and any error (`fetch failed` usually means CORS; S3's error code, such as `ExpiredToken`, appears for a `403`). |

In the copied summary, "Short 206, then the rest" counts the answers that ended before what the element asked for (or before the end of the file, for an open range), and how many of them were followed by a request starting at the next byte. "Read-ahead steady" takes the samples taken while playing, at least 15 seconds after the start or the last seek; "after seek" is the read-ahead 10 seconds after each seek settles. These are aids: check them against the log.

## Background and lock-screen checks

- **iPhone:** tick "Loop" (a track is ten minutes; the check needs at least 15), start playback from 0:00, switch away from Safari, lock the phone, and leave it at least 15 minutes. Listen for the pips: playback past the first 30 to 60 seconds means the worker answered while the phone was locked. After the loop wraps to 0:00, the element may replay from its buffer without asking the worker, so the first ten minutes are the stronger evidence. Then try pause and play from the Lock Screen controls. Unlock, return to the page, and read the log: records with times inside the locked period, and the worker id, show whether the same worker kept answering.
- **Safari on macOS:** the same with the tab in the background and the window minimized.
- Whether `postMessage` reaches a sleeping page does not matter: the page reads the stored records when it becomes visible again. Records from earlier page loads stay stored until you press "Clear stored log" (which also restarts the current track).

## Serving on Cloudflare Pages

dj-site deploys with OpenNext to the `wxyc-dj` Cloudflare Pages project by Direct Upload; previews are `https://<hash>.dj-site.pages.dev` plus a branch alias. The build writes a `_worker.js` and a `_routes.json` (`scripts/post-build.js`) that send **every path** to the OpenNext worker except a short list of static patterns (`/_next/static/*`, images, `/fonts/*`). The OpenNext worker does not fall back to static assets, so a `public/` file outside that list is not served: in production, `https://dj.wxyc.org/.nojekyll` (a file in `public/`) returns the Next.js 404. On this branch only, `scripts/post-build.js` adds `/spike` and `/spike/*` to the exclusions, so Pages serves the harness as static files: `/spike/` serves `index.html`, and `/spike/sw.js` comes with a JavaScript content type at a path whose default scope is `/spike/`, so no `Service-Worker-Allowed` header is needed. Requests under `/spike/audio/` that the worker does not catch get the static server's 404, which stands in for "the DJ site serves nothing at that path".

A side effect: `next.config.mjs`'s `headers()` (the CSP, `X-Frame-Options`, HSTS and the rest) applies only to responses from the OpenNext worker, so the harness's pages and its worker script are served without them.

## CSP

The DJ site's CSP is `Content-Security-Policy-Report-Only` (`next.config.mjs`), so today it blocks nothing anywhere, and it is not sent on `/spike/*` at all (above). The harness needs no CSP override, and this branch adds none.

What the production path will need when the policy is enforced (for WXYC/dj-site#2151):

- A service worker follows the CSP delivered with its **own script**, not the page's. If the production worker script is served through Next.js (and so gets the site's headers), its `connect-src` must allow the review store's origin, in the exact host form the signer produces (virtual-hosted `https://<bucket>.s3.amazonaws.com` or `https://<bucket>.s3.us-east-1.amazonaws.com`), as well as the API origin, which `connect-src` already has. If it is served as a static file (as here), it gets no CSP unless one is added for it.
- The page itself needs nothing new for the service-worker path: the element loads a same-origin URL, which `default-src 'self'` covers for `media-src`, and `worker-src 'self' blob:` already allows the registration.
- If the spike chooses MSE instead, `media-src` needs `blob:`, and the page's own `connect-src` needs the review store's origin, because the page then fetches the bytes itself.

## Known differences from production

- The lookup is a static JSON on Pages, so it is faster than the real route, which checks the token and the listen rule on EC2. Allow for that when reading how soon the element asks for the next chunk.
- The URLs live for the SSO session (often hours), not 60 seconds. The worker never reuses a URL across requests anyway, as the real worker will not.
- Each request may also pay a CORS preflight for the `Range` header, depending on the browser. The worker's `ms` includes it, but only the browser's network inspector shows it. In production every URL is new, so a preflight cache keyed by URL never helps.
- Chrome and Firefox on the iPhone run WebKit, so they behave like Safari there; the table's iPhone row is Safari.
- The M4A is written with `+faststart` (the `moov` atom first). A file with `moov` at the end makes the element read the end of the file first; it is worth one extra check if time allows.

## Cleaning up

When the decision is recorded: close the harness PR without merging, delete the branch `spike/safari-sw-audio`, and run `spike/make-test-bucket.sh teardown [bucket]`. Teardown deletes only a bucket tagged `throwaway=true`, which `create` adds. A lifecycle rule also deletes the objects 30 days after upload, in case teardown is forgotten. On each test device, "Clear stored log" and the "Clear" buttons in the URL form remove what the page stored.
