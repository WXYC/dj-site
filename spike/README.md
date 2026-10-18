# Service-worker audio spike (throwaway)

This is the test harness for [WXYC/dj-site#2148](https://github.com/WXYC/dj-site/issues/2148): does Safari, on macOS and on the iPhone, send an `<audio>` element's range requests through a service worker, and does the worker keep answering in the background and with the phone locked? It lives on the branch `spike/safari-sw-audio` and **never merges**. When the spike is done, close its PR unmerged, delete the branch, and tear down the test bucket (see [Cleaning up](#cleaning-up)).

## Files

| File | What it is |
|---|---|
| `public/spike/index.html` | The test page, served at `/spike/`: the guided test steps, the results table, and a closed "Details for debugging" section. |
| `public/spike/spike.js` | The page script: registers the worker, waits for control, drives the two players (the format player and the lock test's), runs the automatic checks, keeps the results, copies them as Markdown, and runs the hands-free mode. |
| `public/spike/lock-math.js` | The lock test's arithmetic as pure functions over plain records (expected position, gap, scrub resume). A plain script that sets `window.SpikeLockMath`; `index.html` loads it before `spike.js`. |
| `public/spike/spike.css` | Styles; phone first, with no horizontal scroll and large tap targets. |
| `public/spike/sw.js` | The service worker, scope `/spike/`. A plain script with no build step and no imports. |
| `public/spike/sources.json` | The five tracks (id, label, format, MIME type, bitrate, file name) with empty URLs: the four formats and `lock`, the lock test's thirty-minute WAV. Never commit a URL here. |
| `spike/make-test-audio.sh` | Makes the four ten-minute test tracks and the thirty-minute lock track with ffmpeg. |
| `spike/make-test-bucket.sh` | The aws CLI commands for a private test bucket, the upload, and the presigned URLs. You run it; nothing in CI does. |
| `spike/check-lock-math.mjs` | A Node script that tests `lock-math.js` against a table of timelines (see [Testing the lock arithmetic](#testing-the-lock-arithmetic)). |
| `spike/.gitignore` | Keeps the generated audio out of git. |
| `scripts/post-build.js` | Changed on this branch only: excludes `/spike` and `/spike/*` from the OpenNext worker so Cloudflare Pages serves the harness as static files (see [Serving on Cloudflare Pages](#serving-on-cloudflare-pages)). |

This README and the scripts sit in `spike/`, outside `public/`, because everything in `public/` is served on every preview deployment, and nothing here needs to be.

## Quick start for a tester

You need a Mac with Safari, Chrome and Firefox, an iPhone, ffmpeg 4.4 or newer, and the aws CLI v2 with the `wxyc-api` SSO profile. The page itself tells you what to do at each step; you do not need the issue open.

1. **Make the audio.** `spike/make-test-audio.sh` writes five tracks to `spike/test-audio/` (git-ignored): the four ten-minute formats (MP3 320 kbps CBR, M4A/AAC 256 kbps, FLAC and WAV, about 180 MB) and the thirty-minute lock track (WAV, 318 MB). It takes about a minute. `ONLY=lock spike/make-test-audio.sh` makes just the lock track, `ONLY=formats` just the four formats.
2. **Make the bucket and upload.** `aws sso login --profile wxyc-api`, then `spike/make-test-bucket.sh create`. It creates a private bucket (default name `wxyc-dj-site-spike-sw-audio`; pass another as the second argument), applies the review bucket's audio CORS rule, uploads the tracks with their content types, and prints five lines, `<id> <presigned URL>`. If the bucket already exists, `spike/make-test-bucket.sh upload` uploads only the tracks that are not in it yet (for example the lock track) and changes nothing else. Both are safe to run again: an object already in the bucket is never replaced. `DRY_RUN=1` in front of either prints what it would change instead. **The URLs are credentials:** paste them only into the spike page, never into an issue, a PR or a chat. `spike/make-test-bucket.sh presign | pbcopy` copies fresh lines without printing them.
3. **Open the page** at the branch alias, `https://spike-safari-sw-audio.dj-site.pages.dev/spike/`, in each browser: Safari, Chrome and Firefox on the Mac, and Safari on the iPhone. Use the alias rather than a per-commit `https://<hash>.dj-site.pages.dev` URL: saved links and results live in per-origin browser storage, so every new hash would start empty. Both match the bucket's `https://*.dj-site.pages.dev` origin.
4. **Paste the links.** The page asks for them first: paste the five lines from step 2 and press "Save links". To get them onto the iPhone, send them to yourself in a private note, paste them, then delete the note. Once every link this browser needs is saved, the form folds to one line, "Links: 5 of 5 saved · Change". Chrome and Firefox do not run the lock test, so they need only the first four ("Links: 4 of 4 saved").
5. **Follow the test steps** on the page, for each format, and the lock test once in Safari on each device. The current step is highlighted; the page checks most things by itself and asks you only what it cannot hear.
6. **Copy the results** with "Copy results" under the results table, and paste them as a comment on [dj-site#2148](https://github.com/WXYC/dj-site/issues/2148). Safari and Firefox do not report the macOS version, so the page asks you to add it by hand.

You are done when every format is checked in all four browsers, the lock test is done in Safari on the iPhone and the Mac, and each browser's results are posted on the issue.

## The test audio

Each track is ten minutes of generated sound that tells you where the playhead is:

- a steady tone whose pitch rises a whole tone each minute (minute 0 is 220 Hz, minute 9 is about 622 Hz);
- every 10 seconds, a burst of short high pips: one at m:00, two at m:10, up to six at m:50;
- quiet pink noise underneath, so FLAC compresses like music rather than like a pure tone.

So a seek to 10% (1:00) lands on the second pitch with one pip, 50% (5:00) on the sixth pitch with one pip, and 90% (9:00) on the tenth. `DURATION_S=120 LOCK_DURATION_S=180 spike/make-test-audio.sh` makes shorter tracks for a quick try; the file names stay the same.

The lock track, `spike-marker-30min.wav`, is the same sound for thirty minutes (1800.0 s, 16-bit 44.1 kHz stereo, 317,520,078 bytes), except that its tone rises a semitone each minute (220 Hz at 0:00, 440 Hz at 12:00, about 1175 Hz at 29:00), so it stays below the 1760 Hz pips; whole tones would reach the pips' pitch at minute 18. It is a WAV on purpose: on iOS, Safari loads a WAV a piece at a time as it plays, so the worker must keep answering while the phone is locked. A compressed track would be loaded in full before the lock and prove nothing. It is thirty minutes so that a fifteen-minute lock with a five-minute scrub never reaches the end, and Loop stays off: with Loop on, the earlier ten-minute tracks wrapped to 0:00 in the background, after the start had been dropped from the buffer, and stalled for 78 seconds, which is not what the test measures.

## The test steps

The "Test steps" card is a numbered checklist for the format you picked, with the current step highlighted. Each automatic check shows a line with ✓ (passed), ✗ (failed), ? (can't tell) or … (checking).

1. **Pick a format.** Chips for MP3, M4A, FLAC and WAV; a ✓ on a chip means that format is finished in this browser.
2. **Press play.** You should hear a steady tone with a burst of pips every 10 seconds. The page checks by itself that the worker answered the player's first request, that the audio is playing, and that the player asked for the next piece by itself after a short answer.
3. **Jump around and listen.** One button per jump (10%, 50%, 90%, back to the start), each with what you should hear there, from the markers in `spike/make-test-audio.sh`. The page checks that each jump played again within 8 seconds and whether new audio came through the worker. It then asks: "Did you hear the right spot?"
4. **How far ahead the player loads.** Measured while the audio plays; no action. It reads "Loaded about N seconds ahead while playing (at most M), and about K seconds ahead after a jump."
5. **The lock test**, once in each browser that runs it (Safari on an iPhone or iPad, and Safari on a Mac as "the background test"), not once per format. It shows in every format's list and is done for all of them at once. It plays its own player and the thirty-minute lock track, with Loop off. On an iPhone the page numbers these steps:
   1. Press **Play from 0:00**, with the sound up.
   2. Lock the iPhone. The 15:00 starts now.
   3. About 5 minutes later, wake the screen without unlocking it, and drag the Lock Screen player's scrubber forward about 5 minutes (from about 5:00 to about 10:00).
   4. Listen: does the audio come back within a few seconds?
   5. Leave it locked until 15 minutes have passed since locking it. Just before unlocking, press pause and then play on the Lock Screen.
   6. Unlock and come back to the page.

   On a Mac the steps are the same with the tab in the background and the window minimized, and the scrub made in Now Playing in Control Center. The page then shows four automatic checks and asks "Did the audio play the whole time?", "Did the audio come back within a few seconds after you dragged the scrubber?" and, on an iPhone or iPad, "Did play and pause on the Lock Screen work?". The countdown starts when the page is hidden while the lock track plays. It keeps time from timestamps, not timers, because timers stop while the phone is locked. Coming back early shows the time still to go; leave again and the clock keeps running. "Restart this test" clears the lock test's results.

   The lock player has its own Media Session handlers, for `play`, `pause`, `seekto`, `seekforward` and `seekbackward`, set when you press Play from 0:00, so the Lock Screen shows a scrubber for it and the page hears each press. The step says which handlers the browser took. The format player keeps the browser's own controls, so the formats are tested as before.
6. **Next format.** Moves to the next unfinished format. "Redo this format" clears that format's results. When all four formats are done but the lock test is not, it goes to the lock test.

The results table below the steps fills in as you go: one column per format, one row per check, with the browser, version and OS detected from the browser. Where the lock test runs, a second table below it holds the lock test's checks and answers, with the seconds behind and the seconds a scrub took. "Copy results" gives the Markdown for the issue: one row per format with the columns of the issue's step 6, then the lock test as its own one-row table, and the technical notes for each check in a collapsed section. "Start over" clears the results but keeps the links. Results are kept in `localStorage` under `spike-sw-audio-results-v1`, so a reload, or iOS reloading the page after a lock, loses nothing.

Everything technical sits in the closed "Details for debugging" section: the worker's status, the "Response" picker, the player's raw numbers, the notes for each check, the request log, the element and page events, "Copy the request log", "Clear stored log", and the user agent.

When S3 answers 403 (an expired presigned link) or 400 `ExpiredToken` (an ended SSO session), a banner says: "The track links have expired. On the Mac, run the presign command again and paste the new lines here", with the commands below, and the link form opens. A check that meets an expired link is left undecided rather than marked failed.

```sh
aws sso login --profile wxyc-api
spike/make-test-bucket.sh presign
```

## How the page decides

| Check | Passes when | Fails when |
|---|---|---|
| The worker answered the player's first request | The first request the worker saw started at byte 0 (or had no `Range`) and S3 answered 200 or 206, or the player cancelled it itself. | That request started later in the file (so an earlier one skipped the worker), the answer failed, or no request reached the worker within 10 s of pressing play. |
| The audio is playing | The position advanced 3 s in normal play (jumps do not count). | The player reported an error, or the position did not move within 12 s of pressing play. |
| The player asked for the next piece by itself | After a `206` that ended before what the player asked for, a later request started at the next byte. | Playback stuck for 10 s, or the player errored, after a short answer with no such request. "Can't tell" after 60 s of play without either. |
| Each jump | The position moved past the target within 8 s, playing. The line says whether new audio came through the worker or was already loaded. | It did not. A jump the player was paused for, or one superseded by the next jump, is "not checked" and can be pressed again. |
| Loaded ahead, playing | The median of the read-ahead (the end of the buffered range holding the playhead, minus the playhead), sampled twice a second while playing, from 15 s after play or the last jump; recorded after 20 samples. | No pass or fail: a measurement. |
| Loaded ahead, after a jump | The read-ahead 10 s after each jump's `seeked`. | A measurement. |
| Lock test: worker answered while away | The worker answered at least one request for the lock track while the page was away. | It answered none. "Can't tell" if everything was loaded before you left: by the element's buffered ranges, or because the worker's answers before the hide (their `Content-Range`, and in the rebuilt mode the bytes the player read) already covered every byte of the track. Safari can fetch a whole file early while `buffered` still shows only part of it. |
| Lock test: went on past what was loaded | The worker answered a request at least as long after the page was hidden as the audio that was loaded ahead when it was hidden. | It did not, and the page was away more than that plus 30 s. "Can't tell" as for the row above. |
| Lock test: played the whole time | The gap, not counting the scrubs' own resume time, is under 5 s. Expected position = the position when the page was hidden + the wall-clock time away − the time you paused it + each seek's jump (its target minus the position just before it, estimated from the last `timeupdate`'s position plus the wall time since, frozen while the player waits for data or is paused). Gap = expected − the position when you came back (or at the track's end). | The gap is 5 s or more; or the page reloaded and its last stored position is more than 10 s older than the reload (the browser closed the page, and the audio stopped then). A pause by anything but you counts in the gap. "Can't tell" if no position is known at the end. |
| Lock test: scrub while away | Each seek made while the page was hidden played again within 5 s of its `seeking` event (playback moving again, back-dated from the first `timeupdate` past the landing point). For each, the page records whether the target was in the buffered ranges at `seeking` (and the ranges), the time to the worker's first request after it, and the time until playback moved; several seeks in one drag of the scrubber (under 2 s apart, with no playback between) count as one. | A scrub took 5 s or more, or never played again before you came back. "Can't tell" if you made no seek while the page was hidden. |

The lock checks read the page's stored events (from `localStorage`) and the worker's records (from Cache Storage) when the page comes back, whatever happened to the page meanwhile. Every lock player event (`seeking`, `seeked`, `waiting`, `playing`, `play`, `pause`, `stalled`, `ended`, `timeupdate` about once a second), each Lock Screen action and each visibility change is stored in `localStorage` with its wall-clock time as it fires, so nothing depends on a timer running while the phone is locked. A seek or a pause is "yours" when the page was visible, when it followed a Lock Screen action within 2 s, or when the page could not set Lock Screen handlers; any other is the player's own (as Loop's jump to 0:00 was), and its stall counts in the gap. If the browser reloaded the page while it was away (iOS may), the page judges the test on load, using the time it was reloaded as the time you came back, and says so.

## Hands-free mode

The same page runs every automatic check with no person and no taps, for a headless browser, a WebDriver, or an iOS Simulator. Nothing about the guided checklist changes; this is a second entry point.

```
https://spike-safari-sw-audio.dj-site.pages.dev/spike/?auto=1&formats=mp3,flac&dwell=20#links=<base64url>
```

| Part | Meaning |
|---|---|
| `#links=<base64url>` | The base64url (RFC 4648 §5, padding optional) of the "Save links" text, that is, the presign command's output. The page imports it as "Save links" would, then removes the fragment from the address bar with `history.replaceState`. A fragment never reaches a server. It works without `auto=1` too. |
| `auto=1` | After the worker controls the page, run the automatic checks for each format in turn, muted (`muted = true`, so playback may start without a tap and the run makes no sound). |
| `formats=mp3,flac` | Limit the run to these formats, in this order. Default: all four. |
| `respond=rebuilt` | Start with the worker's response mode set to `rebuilt` (or, with `respond=direct`, to `direct`), as if picked in "How the worker answers the player", once at start-up and before any track loads. Any other value is ignored and the select keeps its default, `direct`. It works without `auto=1` too. The run records the mode used in `settings.response` and in each format's `response`. |
| `dwell=20` | Seconds of play for each step (after pressing play, and after each jump), from 5 to 300. Default 20. In this mode the steady read-ahead window starts at half the dwell (at most 15 s), and the after-jump sample is taken at three quarters of it (at most 10 s). |

For each format the run sets the track, plays it for the dwell, then jumps to 10%, 50%, 90% and back to the start, each followed by the dwell. It never plays the lock track and never runs the lock test, which needs a person to lock the phone and drag the scrubber. Questions only a person can answer are recorded as `not asked (auto)`, and the lock test's checks as `not run (auto)`, in the JSON, in the results tables ("auto") and in "Copy results"; a person can still do them afterwards.

Make the fragment on the Mac without printing the links:

```sh
LINKS=$(spike/make-test-bucket.sh presign 2>/dev/null | base64 | tr '+/' '-_' | tr -d '=\n')
# then open (in a headless browser, a WebDriver session, or `xcrun simctl openurl booted ...`):
#   "https://spike-safari-sw-audio.dj-site.pages.dev/spike/?auto=1#links=$LINKS"
```

The fragment holds the links, which are credentials: keep it out of shell history, logs, screenshots and anything posted.

**Results.** When the run ends, the same JSON is in three places:

- `localStorage["spike-sw-audio-auto-results"]`;
- `window.spikeResults`;
- `<pre id="auto-results" data-testid="auto-results" hidden>`, whose `data-state` is `waiting` before the worker controls the page, `running` during the run, then `done` or `failed`. On `failed`, `data-error` and the JSON's `error` say why (the worker could not take control, an unknown format, a format with no link, links that expired mid-run, or muted playback refused).

`state: "done"` means the run finished; whether the browser passed is in `passed`. The JSON holds no link. Its shape (values illustrative):

```json
{
  "kind": "spike-sw-audio-auto", "version": 1, "state": "done", "error": null, "lockTest": "not run (auto)",
  "startedAt": "…", "finishedAt": "…", "userAgent": "…",
  "browser": "Chrome", "browserVersion": "…", "os": "macOS 15.5", "osVersionKnown": true, "device": "other",
  "settings": { "formats": ["mp3"], "dwellSeconds": 20, "response": "direct", "steadyAfterSeconds": 10, "afterSeekSeconds": 10, "resumeLimitSeconds": 8 },
  "passed": true,
  "formats": [{
    "format": "mp3", "label": "MP3, 320 kbps CBR", "response": "direct", "durationSeconds": 600,
    "passed": true, "linkExpired": false, "playerError": null,
    "checks": {
      "firstRequest": { "result": "pass", "askedRange": "0-", "status": 206, "ms": 180, "note": "…" },
      "playbackAdvances": { "result": "pass", "playedSeconds": 18.9, "note": "…" },
      "nextPiece": { "result": "pass", "shortAnswers": 3, "followed": 3, "note": "…" },
      "seeks": [{ "to": "10%", "targetSeconds": 60, "result": "pass", "resumeMs": 620, "requestsThroughWorker": 1, "targetAlreadyLoaded": false, "readAheadAfterSeconds": 28.4, "note": "…" }],
      "readAhead": { "playing": { "result": "measured", "medianSeconds": 31.2, "maxSeconds": 44.0, "samples": 20 },
                     "afterSeek": { "result": "measured", "medianSeconds": 27.9, "valuesSeconds": [28.4, 27.9, 26.1, 30.2] } },
      "rightSpot": "not asked (auto)"
    },
    "requests": { "total": 9, "answered": 9, "errors": 0, "aborted": 0, "statuses": { "206": 9 }, "workerInstances": ["k3x9q1"] }
  }]
}
```

`passed` for a format is: first request, playback and all four seeks passed, and the next-piece check did not fail. Results words are `pass`, `fail`, `can't tell`, `yes`, `no`, `not yet`, `not asked (auto)`, `not run (auto)` and `n/a`. `lockTest` is `not run (auto)` on an iPhone, an iPad and Safari on a Mac, and `n/a` in other browsers.

**Driving the guided path from a script.** These `data-testid` attributes are stable:

| What | `data-testid` |
|---|---|
| Format chips | `format-mp3`, `format-m4a`, `format-flac`, `format-wav` (`aria-pressed` marks the current one, `data-done` a finished one) |
| Play / pause | `play`; the lock test's "Play from 0:00", `play-away` |
| The lock test's player | `lock-audio` (the element), `lock-position`, `lock-session` (which Lock Screen handlers the page set), `away-countdown` |
| Jumps | `jump-10`, `jump-50`, `jump-90`, `jump-0` |
| Automatic check lines (`data-result` is `pending`, `checking`, `pass`, `fail`, `cant`, `auto` or `skip`) | `check-first`, `check-plays`, `check-next`, `check-jump-10`, `check-jump-50`, `check-jump-90`, `check-jump-0`, `check-readahead`, `check-away-worker`, `check-away-past`, `check-away-whole`, `check-away-scrub` |
| Yes / no answers (`aria-pressed`) | `answer-spot-yes`, `answer-spot-no`, `answer-away-heard-yes`, `answer-away-heard-no`, `answer-scrub-heard-yes`, `answer-scrub-heard-no`, `answer-lockscreen-yes`, `answer-lockscreen-no` |
| Next format, redo, restart the background test | `next-format`, `redo-format`, `away-restart` |
| Links | `links-input`, `links-save`, `links-change`, `links-close`, `links-clear`, `links-count`, `expired-paste` |
| Results | `results-table` and `lock-results-table` (cells carry `data-result` and `data-format`), `copy-results`, `start-over` |
| Debugging | `copy-log`, `clear-log`, `position`, `auto-results` |

## Testing the lock arithmetic

The lock test's arithmetic (expected position, gap, scrub resume, and whose seek or pause it was) lives in `public/spike/lock-math.js` as pure functions over plain records, so it can be tested without a browser:

```sh
node spike/check-lock-math.mjs
```

It runs the file in a fresh `vm` context, as the browser runs it, against a table of timelines: no seek, one forward scrub past the buffer, the same scrub with stored timeupdates one a second apart, a stall mid-play, a background loop-style jump to 0:00 that waits 78 s, a scrub that never plays again, a drag that sends three seeks, pause and play on the Lock Screen, and a pause by something else, plus the cases for whose action it was. It needs only Node 18 or newer (`node:test`).

## What the page does underneath

1. It registers `/spike/sw.js` with `scope: '/spike/'` and `updateViaCache: 'none'`.
2. It waits for `navigator.serviceWorker.ready`, then for the page to be controlled: at once if `navigator.serviceWorker.controller` is set, otherwise on `controllerchange`. The worker calls `clients.claim()` on activate. After a hard reload (which leaves the page uncontrolled while the worker is active) the page asks the worker to claim again.
3. Only then does it set the element's `src` to `/spike/audio/<id>?kbps=<bitrate>&respond=<mode>&load=<page-load id>&session=<n>`. Picking a format, saving links, or changing the response mode starts a new session.
4. It samples the element twice a second (`currentTime`, `duration`, the `buffered` ranges, the read-ahead), runs the checks above against the worker's records, and listens to every element and page event (including `visibilitychange`, `pagehide`, `freeze` and `resume`).
5. It sets Media Session metadata, so the Lock Screen names the track. For the lock test's player it also sets handlers for `play`, `pause`, `seekto`, `seekforward` and `seekbackward`, and the position state, so the Lock Screen shows a scrubber and the page records each action; the format player keeps the browser's own controls.

The "Response" picker (under "Details for debugging") chooses how the worker answers:

- **S3's own response** (the default): the worker returns the `fetch()` response from S3 unchanged. This is what WXYC/dj-site#2150 specifies, so test this first.
- **Rebuilt response:** the worker returns a new `206` with the same status, `Content-Range`, `Content-Length`, `Content-Type` and `Accept-Ranges`, with the body streamed through a byte counter. Use it if a browser refuses S3's own response, to learn whether a rebuilt one works instead. The log then also shows the bytes the element actually read and when it stopped reading. A format tested this way says so in the copied results.

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

The committed `sources.json` has empty URLs, because a presigned URL is a credential and this repo is public. "Save links" (or a `#links=` fragment) saves a URL per track as a Cache Storage entry, `/spike/url/<id>.json` in the cache `spike-url-overrides`, holding `{"url": "…"}`. Both the page and the worker can read Cache Storage for the origin, and it survives the browser stopping and restarting the worker, which in-memory state and `postMessage` do not. Each line is `<id> <url>`; a bare URL is matched to its format by the file name in its path.

On every request the worker still makes the network fetch of `sources.json` (step 2 of the worker's steps), so each request pays one real same-origin round trip, as it will against the route. It then takes the URL from the saved entry when there is one, and from `sources.json` otherwise. A cache-first lookup would skip the round trip whenever a URL was saved, which is always, so it would hide the cost the spike should see.

The URL itself never appears in the log, the event list, the copied results or the hands-free JSON; the log shows only where it came from.

## Reading the log

The request log is under "Details for debugging".

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

"Copy the request log" copies every session of the page load, with its request log and its events, for a closer look than the results table gives.

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

When the decision is recorded: close the harness PR without merging, delete the branch `spike/safari-sw-audio`, and run `spike/make-test-bucket.sh teardown [bucket]`. Teardown deletes only a bucket tagged `throwaway=true`, which `create` adds. A lifecycle rule also deletes the objects 30 days after upload, in case teardown is forgotten. On each test device, "Remove saved links" (in the link form; press "Change" to open it) deletes the saved links, "Start over" deletes the saved results and the stored request log, and "Clear stored log" (under "Details for debugging") deletes the stored request log.
