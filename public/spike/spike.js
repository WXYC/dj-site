/*
 * Page script for the service-worker spike. Throwaway; this branch never
 * merges. See spike/README.md.
 *
 * The <audio> element gets its src only after the worker is ready AND
 * controls this page: a load made earlier would go to the DJ site's host,
 * which serves no audio.
 *
 * Two entry points share every check:
 *   - the guided checklist, which a person follows on each device;
 *   - ?auto=1, which runs the automatic checks for each format with muted
 *     playback and no taps, and publishes machine-readable results.
 *
 * The lock test (an iPhone or iPad, and Safari on a Mac) runs once per
 * browser, not per format, on its own player and its own 30-minute WAV. Its
 * arithmetic is in lock-math.js, which loads first.
 *
 * Plain script with no build step, so every browser runs it as is.
 */
"use strict";

(() => {
  const OVERRIDE_CACHE = "spike-url-overrides";
  const LOG_CACHE = "spike-request-log";
  const RESULTS_KEY = "spike-sw-audio-results-v1";
  const AUTO_RESULTS_KEY = "spike-sw-audio-auto-results";
  const MIB = 1024 * 1024;
  const TICK_MS = 500;
  const STEADY_AFTER_MS = 15000;
  const AFTER_JUMP_MS = 10000;
  const RESUME_LIMIT_MS = 8000;
  const FIRST_REQUEST_LIMIT_MS = 10000;
  const PLAY_LIMIT_MS = 12000;
  const STALL_LIMIT_MS = 10000;
  const ERROR_GRACE_MS = 2000;
  const NEXT_PIECE_GIVE_UP_S = 60;
  const PLAYED_FOR_PASS_S = 3;
  const STEADY_SAMPLES_NEEDED = 20;
  const AWAY_MS = 15 * 60 * 1000;
  const DEFAULT_DURATION_S = 600;
  const JUMPS = [
    { key: "j10", fraction: 0.1, label: "Jump to 10%", short: "10%", testid: "jump-10" },
    { key: "j50", fraction: 0.5, label: "Jump to 50%", short: "50%", testid: "jump-50" },
    { key: "j90", fraction: 0.9, label: "Jump to 90%", short: "90%", testid: "jump-90" },
    { key: "j0", fraction: 0, label: "Back to the start", short: "start", testid: "jump-0" },
  ];
  const DECIDED = ["pass", "fail", "cant"];
  const ANSWERED = ["yes", "no"];
  const LOAD_ID = Math.random().toString(36).slice(2, 8);
  const PAGE_STARTED = Date.now();
  const MEDIA_EVENTS = [
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "play", "playing", "pause",
    "waiting", "stalled", "suspend", "seeking", "seeked", "ended", "error", "emptied", "abort",
  ];
  const LOCK_ID = "lock";
  const LOCK_LIMIT_S = 5;
  const LOCK_CHECKS = ["awayWorker", "awayPast", "awayWhole", "awayScrub"];
  const LOCK_EVENTS = [...MEDIA_EVENTS, "timeupdate", "ratechange"];
  const LOCK_ACTIONS = ["play", "pause", "seekto", "seekforward", "seekbackward"];
  const SEEK_ACTIONS = ["seekto", "seekforward", "seekbackward"];
  // Stored timeupdates are thinned to about one a second, and saved at most
  // every two seconds: the arithmetic back-dates from each position, so it
  // loses nothing by the thinning.
  const LOCK_TU_EVERY_MS = 1000;
  const LOCK_SAVE_EVERY_MS = 2000;
  // After a reload while away, the page judges the playback up to the last
  // position it stored; one stored this long before the reload means the
  // browser closed the page then, and the audio stopped with it.
  const RELOAD_GRACE_MS = 10000;
  const LM = window.SpikeLockMath;

  const query = new URLSearchParams(location.search);
  const AUTO = query.get("auto") === "1";
  const AUTO_DWELL_S = boundedNumber(query.get("dwell"), 5, 300, 20);
  const AUTO_FORMATS = (query.get("formats") || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  // ?respond=direct or ?respond=rebuilt picks the worker's response mode at
  // start-up, as the "mode" select would; any other value is ignored.
  const RESPOND = ["direct", "rebuilt"].includes(query.get("respond")) ? query.get("respond") : null;

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const lockAudio = $("lock-audio");
  const device = detectDevice(navigator.userAgent);
  const state = {
    tracks: [], // every track in sources.json, the lock track included
    sources: [], // the four formats
    lockEntry: null,
    controlled: false,
    setupError: "",
    sessions: [],
    nextSession: 1,
    current: null,
    records: new Map(), // this page load's records, by id
    allRecords: new Map(), // every record seen or stored, from any page load
    earlierStored: 0,
    linkIds: new Set(),
    linksLoaded: false,
    editingLinks: false,
    linkExpired: false,
    fragmentError: "",
    lockNotice: "",
    lockEvaluating: false,
    lockSession: null, // the lock player's session, for the log
    nextLockSession: 1,
    shown: null, // the session whose log and events "Details for debugging" shows
    lockHandlers: [], // the Lock Screen actions the browser took for the lock player
    lockAction: null, // the last Lock Screen action: { action, at }
    lockSavedAt: 0,
    mediaFor: "", // which player the Media Session is set up for: "format" or "lock"
    auto: null,
    tableSigs: {},
  };
  const store = { data: emptyStore(), note: "" };

  // ---- small helpers -------------------------------------------------------

  function boundedNumber(text, min, max, fallback) {
    const n = Number(text);
    if (text === null || text === "" || !Number.isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, n));
  }

  const steadyAfterMs = () => (AUTO ? Math.min(STEADY_AFTER_MS, (AUTO_DWELL_S * 1000) / 2) : STEADY_AFTER_MS);
  const afterJumpMs = () => (AUTO ? Math.min(AFTER_JUMP_MS, AUTO_DWELL_S * 750) : AFTER_JUMP_MS);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  const round3 = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const errText = (err) => (err && err.message ? err.message : String(err));

  async function waitUntil(predicate, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (predicate()) {
        return true;
      }
      await sleep(250);
    }
    return predicate();
  }

  const zoned = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "short",
  });
  const clock = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const strip = (range) => String(range || "").replace(/^bytes[= ]/, "");
  const secs = (n) => (Number.isFinite(n) ? n.toFixed(1) : "-");
  const md = (v) =>
    String(v === undefined || v === null ? "" : v)
      .replace(/\\/g, "\\\\")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ");

  function mmss(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  /** A track position as m:ss.s. */
  function clockPos(seconds) {
    if (!Number.isFinite(seconds)) {
      return "-";
    }
    const t = Math.round(Math.max(0, seconds) * 10) / 10;
    const m = Math.floor(t / 60);
    return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`;
  }

  const rangesText = (ranges) => (ranges && ranges.length ? ranges.map(([a, b]) => `${a}-${b}`).join(", ") + " s" : "(none)");

  function median(values) {
    if (!values.length) {
      return NaN;
    }
    const v = [...values].sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  function fmtBytes(n) {
    if (!n && n !== 0) {
      return "-";
    }
    if (n >= MIB) {
      return (n / MIB).toFixed(2) + " MiB";
    }
    if (n >= 1024) {
      return (n / 1024).toFixed(1) + " KiB";
    }
    return n + " B";
  }

  function chunkFor(entry) {
    if (!(entry.kbps > 0)) {
      return { bytes: 2 * MIB, why: "default, bitrate unknown" };
    }
    const bytes = Math.min(8 * MIB, Math.max(MIB, Math.round(((entry.kbps * 1000) / 8) * 30)));
    return { bytes, why: `30 s at ${entry.kbps} kbps, clamped to 1-8 MiB` };
  }

  function parseRange(text) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(String(text || "").trim());
    return m ? { start: Number(m[1]), end: m[2] === "" ? null : Number(m[2]) } : null;
  }

  function parseContentRange(text) {
    const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(String(text || "").trim());
    return m ? { start: Number(m[1]), end: Number(m[2]), total: m[3] === "*" ? null : Number(m[3]) } : null;
  }

  // ---- the device ----------------------------------------------------------

  function parseUA(ua) {
    const rules = [
      [/CriOS\/([\d.]+)/, "Chrome on iOS"],
      [/FxiOS\/([\d.]+)/, "Firefox on iOS"],
      [/EdgiOS\/([\d.]+)/, "Edge on iOS"],
      [/Edg\/([\d.]+)/, "Edge"],
      [/Firefox\/([\d.]+)/, "Firefox"],
      [/Chrome\/([\d.]+)/, "Chrome"],
      [/Version\/([\d.]+).*Safari\//, "Safari"],
    ];
    for (const [re, name] of rules) {
      const m = re.exec(ua);
      if (m) {
        return { browser: name, version: m[1] };
      }
    }
    return { browser: "Unknown browser", version: "" };
  }

  function detectDevice(ua) {
    const p = parseUA(ua);
    const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const ipad = /iPad/.test(ua) || touchMac;
    const ios = /iPhone|iPod/.test(ua) || ipad;
    const mac = !ios && /Macintosh/.test(ua);
    let os = "";
    let osKnown = false;
    if (ios) {
      const kind = ipad ? "iPadOS" : "iOS";
      const uaOs = /OS ([\d_]+) like Mac OS X/.exec(ua);
      if (p.browser === "Safari" && p.version) {
        // Safari on iOS ships with the OS and carries its version; recent
        // releases freeze the OS number in the user agent.
        os = `${kind} ${p.version}`;
        osKnown = true;
      } else if (uaOs) {
        os = `${kind} ${uaOs[1].replace(/_/g, ".")}`;
        osKnown = true;
      } else {
        os = kind;
      }
    } else if (mac) {
      // Every Mac browser reports 10.15 in the user agent, whatever the OS.
      os = "macOS";
    } else if (/Android ([\d.]+)/.test(ua)) {
      os = "Android " + /Android ([\d.]+)/.exec(ua)[1];
      osKnown = true;
    } else if (/Windows NT/.test(ua)) {
      os = "Windows";
    } else if (/Linux/.test(ua)) {
      os = "Linux";
    } else {
      os = "unknown OS";
    }
    let family = "other";
    if (ios) {
      family = "ios";
    } else if (mac && p.browser === "Safari") {
      family = "mac-safari";
    }
    return {
      browser: p.browser,
      version: p.version,
      os,
      osKnown,
      family,
      deviceName: ios ? (ipad ? "iPad" : "iPhone") : mac ? "Mac" : "computer",
    };
  }

  // Chromium freezes its user agent at major.0.0.0 and macOS 10.15, and
  // reports the real browser and macOS versions through client hints.
  function refineOsVersion() {
    const uad = navigator.userAgentData;
    if (!uad || typeof uad.getHighEntropyValues !== "function" || device.family === "ios") {
      return;
    }
    uad
      .getHighEntropyValues(["platformVersion", "fullVersionList"])
      .then((v) => {
        const names = { Chrome: ["Google Chrome", "Chromium"], Edge: ["Microsoft Edge"] };
        const brand = (v.fullVersionList || []).find((b) => (names[device.browser] || []).includes(b.brand));
        if (brand && brand.version) {
          device.version = brand.version;
          render();
        }
        if (uad.platform === "macOS" && v.platformVersion) {
          const parts = v.platformVersion.split(".");
          device.os = "macOS " + (parts[1] && parts[1] !== "0" ? parts.slice(0, 2) : parts.slice(0, 1)).join(".");
          device.osKnown = true;
          render();
        }
      })
      .catch(() => {});
  }

  const awayApplies = () => device.family === "ios" || device.family === "mac-safari";

  // ---- saved results -------------------------------------------------------

  function emptyStore() {
    return { formats: {}, current: null, lock: null };
  }

  function loadStore() {
    try {
      const raw = window.localStorage.getItem(RESULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.formats && typeof parsed.formats === "object") {
          store.data = Object.assign(emptyStore(), parsed);
          dropPerFormatAway();
        }
      }
    } catch (e) {
      store.note = "This browser will not keep the results if the page reloads (its storage is blocked).";
    }
  }

  /**
   * Away results stored under a format, and a lock record for a format's
   * track, come from a page that ran the lock test on each format's own
   * ten-minute track with Loop on; they do not answer this test's questions.
   */
  function dropPerFormatAway() {
    const lock = store.data.lock;
    if (lock && lock.format !== LOCK_ID) {
      store.data.lock = null;
    }
    for (const [id, f] of Object.entries(store.data.formats)) {
      if (id !== LOCK_ID && f && typeof f === "object") {
        ["awayPast", "awayWorker", "awayHeard", "lockScreen"].forEach((k) => {
          delete f[k];
        });
      }
    }
  }

  function saveStore() {
    try {
      window.localStorage.setItem(RESULTS_KEY, JSON.stringify(store.data));
    } catch (e) {
      store.note = "This browser will not keep the results if the page reloads (its storage is blocked).";
    }
  }

  function readFormat(id) {
    return (id && store.data.formats[id]) || {};
  }

  function setResult(id, key, value) {
    if (!store.data.formats[id]) {
      store.data.formats[id] = {};
    }
    const f = store.data.formats[id];
    if (JSON.stringify(f[key]) === JSON.stringify(value)) {
      return;
    }
    f[key] = value;
    if (state.current && state.current.entry.id === id) {
      f.mode = state.current.mode;
    }
    saveStore();
  }

  function clearResults(id, keys) {
    const f = store.data.formats[id];
    if (!f) {
      return;
    }
    keys.forEach((k) => {
      delete f[k];
    });
    saveStore();
  }

  const isDecided = (v) => !!v && DECIDED.includes(v.r);
  const isAnswered = (v) => !!v && ANSWERED.includes(v.r);
  const isPass = (v) => !!v && v.r === "pass";

  function stepState(id) {
    const f = readFormat(id);
    const play = isDecided(f.first) && isDecided(f.plays) && isDecided(f.next);
    const jump = JUMPS.every((j) => isDecided(f[j.key])) && isAnswered(f.spot);
    const ahead = !!(f.aheadSteady && f.aheadJump);
    return { play, jump, ahead, done: play && jump && ahead };
  }

  const lockApplies = () => awayApplies() && !!state.lockEntry;
  const lockResults = () => readFormat(LOCK_ID);
  const lockDecided = (f = lockResults()) => LOCK_CHECKS.every((k) => isDecided(f[k]));
  const testName = () => (device.family === "ios" ? "lock test" : "background test");

  /** The lock test is done once in each browser, whatever the format. */
  function lockDone() {
    const f = lockResults();
    return lockDecided(f) && isAnswered(f.awayHeard) && isAnswered(f.scrubHeard) && (device.family !== "ios" || isAnswered(f.lockScreen));
  }

  /** The tracks this browser needs a link for: the lock track only where the lock test runs. */
  const neededTracks = () => (lockApplies() ? state.tracks : state.sources);

  // ---- the element ---------------------------------------------------------

  function readAhead(el = audio) {
    const t = el.currentTime;
    const b = el.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + 0.05 && t <= b.end(i)) {
        return b.end(i) - t;
      }
    }
    return 0;
  }

  function isBuffered(t, el = audio) {
    const b = el.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t && t < b.end(i)) {
        return true;
      }
    }
    return false;
  }

  function allLoaded(el = audio) {
    const d = el.duration;
    if (!Number.isFinite(d) || d <= 0) {
      return false;
    }
    const b = el.buffered;
    let total = 0;
    for (let i = 0; i < b.length; i++) {
      total += b.end(i) - b.start(i);
    }
    return total >= d - 1;
  }

  function bufferedText(el = audio) {
    const b = el.buffered;
    const parts = [];
    for (let i = 0; i < b.length; i++) {
      parts.push(`${b.start(i).toFixed(2)}-${b.end(i).toFixed(2)}`);
    }
    return parts.length ? parts.join(", ") + " s" : "(none)";
  }

  /** The buffered ranges as [start, end] pairs in seconds, to a tenth. */
  function bufferedRanges(el) {
    const b = el.buffered;
    const out = [];
    for (let i = 0; i < b.length; i++) {
      out.push([round1(b.start(i)), round1(b.end(i))]);
    }
    return out;
  }

  function trackDuration() {
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : DEFAULT_DURATION_S;
  }

  /** What the marker audio sounds like at `fraction` of the track (see spike/make-test-audio.sh). */
  function expectText(fraction) {
    const dur = trackDuration();
    const t = dur * fraction;
    // Encoders pad a track a few milliseconds past ten minutes, so 10% lands
    // just after 1:00; a burst under half a second back still counts as here.
    const burst = Math.ceil((t - 0.5) / 10) * 10;
    const heard = burst < dur ? burst : t;
    const minute = Math.floor(heard / 60);
    const lastMinute = Math.floor((dur - 0.5) / 60);
    const pips = 1 + Math.floor((heard % 60) / 10);
    let tone;
    if (minute === 0) {
      tone = "the lowest tone, as at the start";
    } else if (minute === 1) {
      tone = "the tone one step higher than at the start";
    } else {
      tone = `the tone ${minute} steps higher than at the start`;
    }
    if (minute > 0 && minute === lastMinute) {
      tone += " (the highest)";
    }
    const pipText = pips === 1 ? "1 pip" : `${pips} pips`;
    const wait = burst - t > 0.5 && burst < dur ? ` after about ${Math.round(burst - t)} seconds` : " right away";
    return `At ${mmss(t)} you should hear ${tone}, and ${pipText}${wait}.`;
  }

  function positionText(el = audio) {
    const d = Number.isFinite(el.duration) ? mmss(el.duration) : "…";
    return `Position ${mmss(el.currentTime)} of ${d}`;
  }

  function setMetadata(entry) {
    if (!entry || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Spike: " + entry.label,
      artist: "WXYC service-worker spike",
      album: "Generated marker tones",
    });
  }

  /**
   * A page has one Media Session, so the Lock Screen's controls belong to
   * whichever player played last. The lock player gets a handler for each
   * Lock Screen action, so the Lock Screen shows a scrubber for it and the
   * page hears every press; the format player keeps the browser's own.
   */
  function mediaSessionFor(which) {
    state.mediaFor = which;
    const took = [];
    if ("mediaSession" in navigator) {
      for (const action of LOCK_ACTIONS) {
        try {
          navigator.mediaSession.setActionHandler(action, which === "lock" ? (details) => onLockAction(action, details || {}) : null);
          if (which === "lock") {
            took.push(action);
          }
        } catch (e) {
          // An action this browser does not support.
        }
      }
    }
    state.lockHandlers = took;
    setMetadata(which === "lock" ? state.lockEntry : currentEntry());
    if (which === "lock") {
      updatePositionState();
    } else if ("mediaSession" in navigator && typeof navigator.mediaSession.setPositionState === "function") {
      try {
        // No argument clears the lock player's position, so the Lock Screen follows the format player.
        navigator.mediaSession.setPositionState();
      } catch (e) {
        // Nothing to clear.
      }
    }
  }

  /** Tells the Lock Screen where the lock player is, so its scrubber starts from the right place. */
  function updatePositionState() {
    const ms = navigator.mediaSession;
    const d = lockAudio.duration;
    if (state.mediaFor !== "lock" || !ms || typeof ms.setPositionState !== "function" || !Number.isFinite(d) || d <= 0) {
      return;
    }
    try {
      ms.setPositionState({ duration: d, playbackRate: lockAudio.playbackRate || 1, position: Math.min(d, Math.max(0, lockAudio.currentTime)) });
    } catch (e) {
      // A state the browser rejects; the Lock Screen keeps its own.
    }
  }

  async function playAudio(el = audio) {
    try {
      await el.play();
      return { ok: true };
    } catch (err) {
      const s = el === lockAudio ? state.lockSession : state.current;
      addEvent("play refused", `${err && err.name ? err.name : ""} ${errText(err)}`.trim(), s, el);
      return { ok: false, name: err && err.name ? err.name : "Error", message: errText(err) };
    }
  }

  async function togglePlay() {
    if (audio.paused) {
      await playAudio();
    } else {
      audio.pause();
    }
    render();
  }

  // ---- sessions ------------------------------------------------------------

  function currentEntry() {
    return state.sources.find((t) => t.id === store.data.current) || state.sources[0] || null;
  }

  function chooseInitialFormat() {
    if (state.sources.some((t) => t.id === store.data.current)) {
      return;
    }
    const open = state.sources.find((t) => !stepState(t.id).done);
    store.data.current = (open || state.sources[0] || {}).id || null;
    saveStore();
  }

  function pickFormat(id) {
    if (!state.sources.some((t) => t.id === id)) {
      return;
    }
    const lock = store.data.lock;
    if (lock && lock.format !== id && lock.phase !== "done") {
      store.data.lock = null;
    }
    store.data.current = id;
    saveStore();
    startTrack();
  }

  function startTrack() {
    const entry = currentEntry();
    if (!entry || !state.controlled) {
      return;
    }
    const previous = state.current;
    if (previous && previous.samples.length >= STEADY_SAMPLES_NEEDED) {
      storeSteady(previous);
    }
    // Session numbers are never reused, so a late record from an earlier
    // session cannot land in a new one.
    const session = {
      n: state.nextSession++,
      entry,
      mode: $("mode").value,
      startedAt: Date.now(),
      events: [],
      jumps: [],
      samples: [],
      afterValues: [],
      maxAhead: 0,
      steadySince: null,
      playPressedAt: null,
      firstPlayAt: null,
      playedS: 0,
      lastCt: null,
      stuckSince: null,
      error: null,
      errorAt: null,
      linkExpired: false,
      decided: { first: false, plays: false, next: false },
      metrics: { first: null, next: { shorts: 0, followed: 0 } },
    };
    state.sessions.push(session);
    state.current = session;
    state.shown = session;
    $("events").textContent = "";
    const q = new URLSearchParams({ load: LOAD_ID, session: String(session.n), respond: session.mode });
    if (entry.kbps) {
      q.set("kbps", String(entry.kbps));
    }
    if (AUTO) {
      // Muted playback may start without a tap, and the run must make no sound.
      audio.muted = true;
    }
    audio.src = `/spike/audio/${encodeURIComponent(entry.id)}?${q}`;
    audio.load();
    if (lockAudio.paused) {
      mediaSessionFor("format");
    }
    const chunk = chunkFor(entry);
    $("st-chunk").textContent = `${fmtBytes(chunk.bytes)} (${chunk.why})`;
    addEvent("src set", `${entry.label}, ${session.mode}`);
    renderLog();
    render();
  }

  function jump(key) {
    const s = state.current;
    const spec = JUMPS.find((x) => x.key === key);
    if (!s || !spec || !Number.isFinite(audio.duration)) {
      return;
    }
    const now = Date.now();
    const prev = s.jumps[s.jumps.length - 1];
    if (prev && !prev.done) {
      prev.done = true;
      prev.abandoned = "jumped again";
    }
    const target = audio.duration * spec.fraction;
    s.jumps.push({
      key,
      target,
      at: now,
      inBuffer: isBuffered(target),
      seekedAt: null,
      resumedAt: null,
      aheadAfter: null,
      requests: 0,
      done: false,
      abandoned: "",
    });
    s.steadySince = now;
    audio.currentTime = target;
    addEvent("jump " + spec.short, `to ${target.toFixed(1)} s${isBuffered(target) ? " (already loaded)" : ""}`);
    if (audio.paused) {
      playAudio();
    }
    render();
  }

  /** Adds an event to a session's list: the format player's by default, or the lock player's. */
  function addEvent(type, detail, s = state.current, el = audio) {
    if (!s) {
      return;
    }
    const ev = { at: Date.now(), type, ct: el.currentTime, ahead: readAhead(el), detail: detail || "" };
    s.events.push(ev);
    if (s === state.shown) {
      const li = document.createElement("li");
      li.textContent = eventLine(s, ev);
      $("events").appendChild(li);
    }
  }

  /** A page event belongs in both players' lists. */
  function addPageEvent(type) {
    addEvent(type);
    if (state.lockSession) {
      addEvent(type, "", state.lockSession, lockAudio);
    }
  }

  function eventLine(s, ev) {
    const rel = ((ev.at - s.startedAt) / 1000).toFixed(1);
    return `t+${rel}s ${clock.format(ev.at)} ${ev.type} ct=${ev.ct.toFixed(2)} ahead=${ev.ahead.toFixed(1)}${ev.detail ? " " + ev.detail : ""}`;
  }

  function onMediaEvent(e) {
    const s = state.current;
    const now = Date.now();
    let detail = "";
    if (e.type === "error" && audio.error) {
      detail = `code ${audio.error.code} ${audio.error.message || ""}`.trim();
      if (s) {
        s.error = detail;
        s.errorAt = now;
      }
    }
    if (e.type === "play") {
      if (!lockAudio.paused) {
        lockAudio.pause();
      }
      mediaSessionFor("format");
    }
    if (s && e.type === "play") {
      s.playPressedAt = now;
      if (!s.firstPlayAt) {
        s.firstPlayAt = now;
      }
      s.steadySince = now;
    }
    if (s && e.type === "seeked" && s.jumps.length) {
      const last = s.jumps[s.jumps.length - 1];
      if (!last.seekedAt) {
        last.seekedAt = now;
      }
    }
    addEvent(e.type, detail);
    renderStats();
  }

  // ---- the worker's records ------------------------------------------------

  const recAt = (r) => Date.parse(r.at);
  const byAt = (a, b) => recAt(a) - recAt(b);
  const isOk = (r) => (r.status === 206 || r.status === 200) && !r.error;

  /** S3 answers 403 once a presigned link expires, and 400 ExpiredToken once its SSO session ends. */
  function isExpired(r) {
    return r.status === 403 || (r.status === 400 && /expired/i.test(r.error || ""));
  }

  function upsert(rec) {
    if (!rec || !rec.id) {
      return;
    }
    const prev = state.allRecords.get(rec.id);
    const merged = prev ? Object.assign(prev, rec) : rec;
    state.allRecords.set(merged.id, merged);
    if (merged.load !== LOAD_ID) {
      return;
    }
    state.records.set(merged.id, merged);
    const s = state.current;
    if (s && merged.session === String(s.n) && isExpired(merged)) {
      s.linkExpired = true;
      state.linkExpired = true;
    }
    if (state.lockSession && merged.session === state.lockSession.n && isExpired(merged)) {
      state.linkExpired = true;
    }
  }

  function onWorkerMessage(e) {
    const data = e.data || {};
    if (data.type === "record") {
      upsert(data.record);
      renderLog();
    } else if (data.type === "pong") {
      setStatus(`Controlled. Worker instance ${data.instance}, started ${zoned.format(new Date(data.startedAt))}.`, "ok");
    }
  }

  // The worker stores every record in Cache Storage as well as posting it, so
  // a page that was asleep (backgrounded, phone locked) can catch up on wake.
  async function loadStoredLog() {
    if (!window.caches) {
      return;
    }
    try {
      const cache = await caches.open(LOG_CACHE);
      const keys = await cache.keys();
      let earlier = 0;
      for (const key of keys) {
        const res = await cache.match(key);
        const rec = res ? await res.json() : null;
        if (rec) {
          upsert(rec);
          if (rec.load !== LOAD_ID) {
            earlier += 1;
          }
        }
      }
      state.earlierStored = earlier;
    } catch (err) {
      addEvent("stored log unreadable", errText(err));
    }
    renderLog();
  }

  function sessionRecords(session) {
    return [...state.records.values()].filter((r) => r.session === String(session.n)).sort(byAt);
  }

  function shortAnswers(recs) {
    let shorts = 0;
    let followed = 0;
    recs.forEach((r, i) => {
      const cr = parseContentRange(r.contentRange);
      if (r.status !== 206 || !cr || cr.total === null) {
        return;
      }
      const asked = parseRange(r.asked);
      const wanted = asked && asked.end !== null ? Math.min(asked.end, cr.total - 1) : cr.total - 1;
      if (cr.end < wanted) {
        shorts += 1;
        if (recs.slice(i + 1).some((later) => (parseRange(later.asked) || {}).start === cr.end + 1)) {
          followed += 1;
        }
      }
    });
    return { shorts, followed };
  }

  // ---- automatic checks ----------------------------------------------------

  function sample(s, now) {
    const ct = audio.currentTime;
    if (!audio.paused) {
      if (s.lastCt !== null) {
        const d = ct - s.lastCt;
        if (d > 0 && d < 1.5) {
          s.playedS += d;
        }
        if (Math.abs(d) < 0.05) {
          if (s.stuckSince === null) {
            s.stuckSince = now;
          }
        } else {
          s.stuckSince = null;
        }
      }
    } else {
      s.stuckSince = null;
    }
    s.lastCt = ct;

    const ahead = readAhead();
    if (!audio.paused && audio.readyState >= 3) {
      s.maxAhead = Math.max(s.maxAhead, ahead);
      if (s.steadySince !== null && now - s.steadySince >= steadyAfterMs()) {
        s.samples.push(ahead);
        if (s.samples.length >= STEADY_SAMPLES_NEEDED && s.samples.length % 10 === 0) {
          storeSteady(s);
        }
      }
    }
    const j = s.jumps[s.jumps.length - 1];
    if (j && j.seekedAt && j.aheadAfter === null && !audio.paused && now - j.seekedAt >= afterJumpMs()) {
      j.aheadAfter = ahead;
      s.afterValues.push(ahead);
      storeAfterJump(s);
    }
  }

  function storeSteady(s) {
    if (!s.samples.length) {
      return;
    }
    setResult(s.entry.id, "aheadSteady", {
      s: round1(median(s.samples)),
      max: round1(Math.max(...s.samples)),
      n: s.samples.length,
    });
  }

  function storeAfterJump(s) {
    if (!s.afterValues.length) {
      return;
    }
    setResult(s.entry.id, "aheadJump", {
      s: round1(median(s.afterValues)),
      values: s.afterValues.map(round1),
      n: s.afterValues.length,
    });
  }

  function evaluate(s, now) {
    if (s.linkExpired) {
      return;
    }
    const recs = sessionRecords(s);
    evalFirst(s, recs, now);
    evalPlays(s, now);
    evalNext(s, recs, now);
    evalJump(s, recs, now);
  }

  // An element error can reach the page before the worker's record of the
  // request that caused it; wait a moment before judging by the error alone.
  const errorSettled = (s, now) => s.error !== null && now - s.errorAt >= ERROR_GRACE_MS;

  function decide(s, key, out) {
    s.decided[key] = true;
    setResult(s.entry.id, key, out);
  }

  function evalFirst(s, recs, now) {
    if (s.decided.first) {
      return;
    }
    const first = recs[0];
    if (first) {
      if (isExpired(first) || (first.status === undefined && !first.error)) {
        return;
      }
      const asked = parseRange(first.asked);
      const fromStart = first.asked === "(none)" || (asked !== null && asked.start === 0);
      const answered = isOk(first) || !!first.aborted;
      s.metrics.first = {
        asked: strip(first.asked),
        status: first.status === undefined ? null : first.status,
        ms: first.ttfbMs === undefined ? null : first.ttfbMs,
      };
      if (fromStart && answered) {
        decide(s, "first", {
          r: "pass",
          note: `first request asked ${strip(first.asked)}; ${first.aborted ? "the player cancelled it itself" : `answered ${first.status} in ${first.ttfbMs} ms`}`,
        });
      } else if (!fromStart) {
        decide(s, "first", {
          r: "fail",
          why: "The first request skipped the worker.",
          note: `the first request the worker saw asked ${strip(first.asked)}, not the start of the file`,
        });
      } else {
        decide(s, "first", {
          r: "fail",
          why: "The worker's answer to the first request failed.",
          note: first.error || `answered ${first.status}`,
        });
      }
    } else if (errorSettled(s, now)) {
      decide(s, "first", {
        r: "fail",
        why: "No request reached the worker.",
        note: `no request reached the worker; the player reported ${s.error}`,
      });
    } else if (s.firstPlayAt && now - s.firstPlayAt > FIRST_REQUEST_LIMIT_MS) {
      decide(s, "first", {
        r: "fail",
        why: "No request reached the worker.",
        note: `no request reached the worker within ${FIRST_REQUEST_LIMIT_MS / 1000} s of pressing play`,
      });
    }
  }

  function evalPlays(s, now) {
    if (s.decided.plays) {
      return;
    }
    if (s.playedS >= PLAYED_FOR_PASS_S) {
      decide(s, "plays", { r: "pass", note: `position advanced ${s.playedS.toFixed(1)} s` });
    } else if (errorSettled(s, now)) {
      decide(s, "plays", { r: "fail", why: "The player reported an error.", note: `the player reported ${s.error}` });
    } else if (!audio.paused && s.playPressedAt && now - s.playPressedAt > PLAY_LIMIT_MS && s.playedS < 1) {
      decide(s, "plays", {
        r: "fail",
        why: "The audio did not start.",
        note: `the position did not move in ${PLAY_LIMIT_MS / 1000} s after play`,
      });
    }
  }

  function evalNext(s, recs, now) {
    const counts = shortAnswers(recs);
    s.metrics.next = counts;
    if (s.decided.next) {
      return;
    }
    if (counts.followed > 0) {
      decide(s, "next", {
        r: "pass",
        shortAnswers: counts.shorts,
        followed: counts.followed,
        note: `${counts.followed} of ${counts.shorts} short answers were followed by a request for the next byte`,
      });
    } else if (counts.shorts > 0 && (errorSettled(s, now) || (s.stuckSince !== null && now - s.stuckSince > STALL_LIMIT_MS))) {
      decide(s, "next", {
        r: "fail",
        why: "The player stopped at the end of the first piece.",
        shortAnswers: counts.shorts,
        followed: 0,
        note: `${plural(counts.shorts, "short answer")}, none followed by a request for the next byte; ${s.error ? "player error " + s.error : "playback stuck"}`,
      });
    } else if (s.playedS >= NEXT_PIECE_GIVE_UP_S) {
      decide(s, "next", {
        r: "cant",
        why: "The page could not see the player ask for the next piece.",
        shortAnswers: counts.shorts,
        followed: 0,
        note: `${plural(counts.shorts, "short answer")}, none followed by a request for the next byte, after ${Math.round(s.playedS)} s of play`,
      });
    }
  }

  function evalJump(s, recs, now) {
    const j = s.jumps[s.jumps.length - 1];
    if (!j || j.done) {
      return;
    }
    if (!j.resumedAt && !audio.paused && audio.currentTime >= j.target + 0.5 && audio.currentTime < j.target + 60) {
      j.resumedAt = now;
    }
    const after = recs.filter((r) => recAt(r) >= j.at);
    const ok = after.filter(isOk);
    const bad = after.filter((r) => r.error && !r.aborted && !isExpired(r));
    j.requests = ok.length;
    let out = null;
    if (j.resumedAt) {
      const ms = j.resumedAt - j.at;
      let how = "no new request was needed";
      if (ok.length) {
        how = `new audio came through the worker (${plural(ok.length, "request")}, first asked ${strip(ok[0].asked)})`;
      } else if (j.inBuffer) {
        how = "it played audio that was already loaded";
      }
      out = { r: "pass", ms, requests: ok.length, fromLoaded: !ok.length, note: `played again after ${(ms / 1000).toFixed(1)} s; ${how}` };
    } else if (now - j.at >= RESUME_LIMIT_MS) {
      if (audio.paused && !AUTO) {
        j.done = true;
        j.abandoned = "paused";
        return;
      }
      let why = "the audio did not start again";
      if (bad.length) {
        why = `the worker's request failed (${bad[0].error})`;
      } else if (!ok.length && !j.inBuffer) {
        why = "no new request reached the worker";
      } else if (s.error) {
        why = `the player reported ${s.error}`;
      }
      out = {
        r: "fail",
        ms: null,
        requests: ok.length,
        why: `It did not play again within ${RESUME_LIMIT_MS / 1000} seconds.`,
        note: `did not play again within ${RESUME_LIMIT_MS / 1000} s: ${why}`,
      };
    }
    if (out) {
      j.done = true;
      setResult(s.entry.id, j.key, out);
    }
  }

  function tick() {
    renderStats();
    const s = state.current;
    const now = Date.now();
    if (s) {
      sample(s, now);
      evaluate(s, now);
    }
    if (document.visibilityState === "visible") {
      maybeFinishLock();
    }
    render();
  }

  // ---- the lock test -------------------------------------------------------
  //
  // Once in each browser, on its own player and the 30-minute WAV, Loop off:
  // play from 0:00, lock the phone, drag the Lock Screen scrubber forward at
  // about five minutes, come back after fifteen. It is decided from events
  // stored with their wall-clock times, because timers stop while the phone
  // is locked and iOS may reload the page meanwhile.

  /** When an event fired, by the wall clock, even if its handler ran late. */
  function eventWallTime(e) {
    const now = Date.now();
    const ts = e && e.timeStamp;
    if (typeof performance === "undefined" || !(ts > 0)) {
      return now;
    }
    const lag = performance.now() - ts;
    return lag >= 0 && lag < 10 * 60 * 1000 ? Math.round(now - lag) : now;
  }

  /** The lock test under way (away, or back early), if any. */
  function activeLock() {
    const lock = store.data.lock;
    return lock && lock.format === LOCK_ID && (lock.phase === "away" || lock.phase === "back") ? lock : null;
  }

  function loadLockTrack() {
    const entry = state.lockEntry;
    // A string, so it can never equal a format session's number.
    const session = { n: "L" + state.nextLockSession++, entry, mode: $("mode").value, startedAt: Date.now(), events: [] };
    state.sessions.push(session);
    state.lockSession = session;
    state.shown = session;
    $("events").textContent = "";
    const q = new URLSearchParams({ load: LOAD_ID, session: session.n, respond: session.mode });
    if (entry.kbps) {
      q.set("kbps", String(entry.kbps));
    }
    lockAudio.src = `/spike/audio/${encodeURIComponent(entry.id)}?${q}`;
    lockAudio.load();
    addEvent("src set", `${entry.label}, ${session.mode}`, session, lockAudio);
    renderLog();
  }

  /** "Play from 0:00" before the test starts; play and pause once it is under way. */
  async function onLockPlay() {
    if (!lockAudio.paused) {
      lockAudio.pause();
      render();
      return;
    }
    if (!activeLock()) {
      const s = state.lockSession;
      if (!s || s.mode !== $("mode").value || lockAudio.error) {
        loadLockTrack();
      } else if (lockAudio.currentTime > 0) {
        lockAudio.currentTime = 0;
      }
    }
    audio.pause();
    mediaSessionFor("lock");
    // play() runs before the first await, inside the tap, as iOS requires.
    await playAudio(lockAudio);
    render();
  }

  /** A Lock Screen (or Now Playing) action for the lock player. */
  function onLockAction(action, details) {
    const at = Date.now();
    const ct = lockAudio.currentTime;
    state.lockAction = { action, at };
    let target = null;
    if (action === "seekto" && Number.isFinite(details.seekTime)) {
      target = details.seekTime;
    } else if (action === "seekforward" || action === "seekbackward") {
      const offset = Number.isFinite(details.seekOffset) ? details.seekOffset : 10;
      target = action === "seekforward" ? ct + offset : ct - offset;
    }
    if (target !== null) {
      target = Math.max(0, Math.min(Number.isFinite(lockAudio.duration) ? lockAudio.duration : target, target));
    }
    recordLock({ type: "action", action, at, ct: round3(ct), target: round3(target), fastSeek: !!details.fastSeek });
    const detail = target === null ? "" : `to ${target.toFixed(1)} s${details.fastSeek ? " (fast seek)" : ""}`;
    addEvent("lock screen " + action, detail, state.lockSession, lockAudio);
    if (action === "play") {
      playAudio(lockAudio);
    } else if (action === "pause") {
      lockAudio.pause();
    } else if (target !== null) {
      if (details.fastSeek && typeof lockAudio.fastSeek === "function") {
        lockAudio.fastSeek(target);
      } else {
        lockAudio.currentTime = target;
      }
    }
  }

  /** Keeps one lock player event in the test under way: each event at once, timeupdates about once a second. */
  function recordLock(rec) {
    const lock = activeLock();
    if (!lock) {
      return;
    }
    if (!Array.isArray(lock.events)) {
      lock.events = [];
    }
    const last = lock.events[lock.events.length - 1];
    if (rec.type === "timeupdate" && last && last.type === "timeupdate" && rec.at - last.at < LOCK_TU_EVERY_MS) {
      return;
    }
    lock.events.push(rec);
    const now = Date.now();
    if (rec.type !== "timeupdate" || now - state.lockSavedAt >= LOCK_SAVE_EVERY_MS) {
      state.lockSavedAt = now;
      saveStore();
    }
  }

  function onLockEvent(e) {
    const type = e.type;
    const at = eventWallTime(e);
    const hidden = document.visibilityState === "hidden";
    const handlersSet = state.mediaFor === "lock" && state.lockHandlers.length > 0;
    const lastAction = (actions) => (state.lockAction && actions.includes(state.lockAction.action) ? state.lockAction.at : null);
    const rec = { type, at, ct: round3(lockAudio.currentTime) };
    if (type === "seeking") {
      Object.assign(rec, {
        target: rec.ct,
        hidden,
        inBuffer: isBuffered(lockAudio.currentTime, lockAudio),
        buffered: bufferedRanges(lockAudio),
        own: LM.ownAction({ hidden, handlersSet, lastActionAt: lastAction(SEEK_ACTIONS), at }),
      });
    } else if (type === "pause") {
      Object.assign(rec, { hidden, own: LM.ownAction({ hidden, handlersSet, lastActionAt: lastAction(["pause"]), at }) });
    } else if (type === "error" && lockAudio.error) {
      rec.detail = `code ${lockAudio.error.code} ${lockAudio.error.message || ""}`.trim();
    }
    if (type === "play") {
      if (!audio.paused) {
        audio.pause();
      }
      if (state.mediaFor !== "lock") {
        mediaSessionFor("lock");
      }
    }
    if (["loadedmetadata", "play", "pause", "seeked", "ratechange"].includes(type)) {
      updatePositionState();
    }
    recordLock(rec);
    if (type !== "timeupdate") {
      addEvent(type, lockEventDetail(rec), state.lockSession, lockAudio);
    }
  }

  function lockEventDetail(rec) {
    if (rec.type === "seeking") {
      return `to ${secs(rec.target)} s, ${rec.inBuffer ? "loaded" : "not loaded"} (buffered ${rangesText(rec.buffered)}), ${rec.own ? "yours" : "not yours"}${rec.hidden ? ", hidden" : ""}`;
    }
    if (rec.type === "pause") {
      return rec.own ? "yours" : "not yours";
    }
    return rec.detail || "";
  }

  function onHidden() {
    const now = Date.now();
    addPageEvent("page hidden");
    if (AUTO || !lockApplies() || !state.controlled) {
      return;
    }
    const live = activeLock();
    if (live) {
      if (live.phase === "back") {
        live.spans.push({ from: now, to: null });
        live.phase = "away";
        live.events.push({ type: "hidden", at: now, ct: round3(lockAudio.currentTime) });
        saveStore();
      }
      return;
    }
    if (lockAudio.paused || lockDecided()) {
      return;
    }
    state.lockNotice = "";
    // Written synchronously: the browser may freeze or discard the page at
    // any moment from here on, and timers stop while the phone is locked.
    store.data.lock = {
      format: LOCK_ID,
      phase: "away",
      firstHiddenAt: now,
      endAt: null,
      endCt: null,
      spans: [{ from: now, to: null }],
      aheadAtHide: readAhead(lockAudio),
      ctAtHide: lockAudio.currentTime,
      allLoaded: allLoaded(lockAudio),
      duration: Number.isFinite(lockAudio.duration) ? lockAudio.duration : null,
      mode: state.lockSession ? state.lockSession.mode : $("mode").value,
      load: LOAD_ID,
      session: state.lockSession ? state.lockSession.n : null,
      handlers: [...state.lockHandlers],
      events: [{ type: "hidden", at: now, ct: round3(lockAudio.currentTime) }],
      returnState: null,
      reloaded: false,
      expired: false,
    };
    state.lockSavedAt = now;
    saveStore();
  }

  function onVisible() {
    addPageEvent("page visible");
    const lock = activeLock();
    if (lock && lock.phase === "away") {
      const now = Date.now();
      lock.spans[lock.spans.length - 1].to = now;
      lock.events.push({ type: "visible", at: now, ct: round3(lockAudio.currentTime) });
      lock.returnState = { paused: lockAudio.paused, ct: lockAudio.currentTime, readyState: lockAudio.readyState };
      if (now - lock.firstHiddenAt >= AWAY_MS) {
        finishLock(lock, now);
      } else {
        lock.phase = "back";
      }
      saveStore();
    }
    loadStoredLog().then(() => {
      maybeFinishLock();
      render();
    });
  }

  function finishLock(lock, now) {
    lock.endAt = now;
    lock.endCt = lockAudio.currentTime;
    lock.phase = "evaluating";
  }

  /** A lock test that was under way when the page loaded: the browser reloaded the page. */
  function recoverLock() {
    const lock = store.data.lock;
    if (!lock) {
      return;
    }
    if (lock.phase === "away") {
      lock.reloaded = true;
      lock.spans[lock.spans.length - 1].to = PAGE_STARTED;
      lock.endAt = PAGE_STARTED;
      lock.endCt = null;
      lock.phase = "evaluating";
      saveStore();
    } else if (lock.phase === "back") {
      store.data.lock = null;
      state.lockNotice = "The page reloaded, so the test stopped. Press Play from 0:00 and start again.";
      saveStore();
    }
  }

  function maybeFinishLock() {
    const lock = store.data.lock;
    if (!lock || lock.format !== LOCK_ID || state.lockEvaluating || !state.controlled) {
      return;
    }
    if (lock.phase === "back" && Date.now() - lock.firstHiddenAt >= AWAY_MS) {
      finishLock(lock, Date.now());
      saveStore();
    }
    if (lock.phase !== "evaluating") {
      return;
    }
    state.lockEvaluating = true;
    loadStoredLog()
      .then(() => {
        evaluateLock(lock);
        lock.phase = "done";
        saveStore();
      })
      .finally(() => {
        state.lockEvaluating = false;
        render();
      });
  }

  /**
   * Whether the worker had handed the player every byte of the track before
   * `before`, by the Content-Range of each answer (and, for a rebuilt
   * response, the bytes the player actually read). Safari can fetch a whole
   * file early while its buffered ranges still show only part of it.
   */
  function fetchedWhole(records, before) {
    let total = null;
    const spans = [];
    for (const r of records) {
      const cr = parseContentRange(r.contentRange);
      if (recAt(r) >= before || !isOk(r) || !cr || cr.total === null) {
        continue;
      }
      total = cr.total;
      const end = Number.isFinite(r.delivered) ? Math.min(cr.end, cr.start + r.delivered - 1) : cr.end;
      if (end >= cr.start) {
        spans.push([cr.start, end]);
      }
    }
    if (!total) {
      return false;
    }
    spans.sort((a, b) => a[0] - b[0]);
    let reach = -1;
    for (const [a, b] of spans) {
      if (a > reach + 1) {
        return false;
      }
      reach = Math.max(reach, b);
    }
    return reach >= total - 1;
  }

  /**
   * Decides the four automatic lock checks from the stored events and the
   * worker's stored records. The audio went on past what was loaded if the
   * worker was still answering after that loaded audio would have run out;
   * it played the whole time if its position at the end kept up with the
   * wall clock; a scrub passes if playback moved again within 5 seconds.
   */
  function evaluateLock(lock) {
    const from = lock.firstHiddenAt;
    const to = lock.endAt || Date.now();
    const recs = [...state.allRecords.values()]
      .filter((r) => r.track === LOCK_ID && recAt(r) >= from && recAt(r) <= to)
      .sort(byAt);
    if (recs.some(isExpired)) {
      lock.expired = true;
      state.linkExpired = true;
      return;
    }
    const ok = recs.filter(isOk);
    const bad = recs.filter((r) => r.error && !r.aborted);
    const awayS = (to - from) / 1000;
    const lastOkS = ok.length ? (recAt(ok[ok.length - 1]) - from) / 1000 : null;
    const loaded = lock.aheadAtHide;
    const instances = [...new Set(recs.map((r) => r.instance))];
    let back = "it was paused when you came back";
    if (lock.reloaded) {
      back = "the page had reloaded when you came back";
    } else if (lock.returnState && !lock.returnState.paused) {
      back = "it was playing when you came back";
    }
    const facts =
      `away ${mmss(awayS)}; ${secs(loaded)} s loaded when you left; ${plural(ok.length, "answer")} while away` +
      `${lastOkS !== null ? `, the last ${mmss(lastOkS)} after you left` : ""}` +
      `${bad.length ? `; ${bad.length} failed` : ""}; worker ids ${instances.join(", ") || "-"}; ${back}`;
    const earlier = [...state.allRecords.values()].filter((r) => r.track === LOCK_ID && r.load === lock.load && r.session === lock.session);
    const whole = !lock.allLoaded && fetchedWhole(earlier, from);
    const measures = { awayS: round1(awayS), loadedS: round1(loaded), answers: ok.length, failed: bad.length, lastAnswerS: round1(lastOkS), workerIds: instances, reloaded: !!lock.reloaded, fetchedWholeBefore: whole };
    let already = null;
    if (lock.allLoaded) {
      already = { why: "Everything was already loaded before you left, so this run can't tell.", note: "everything was loaded before you left; " };
    } else if (whole) {
      already = {
        why: "The player had already fetched the whole track through the worker before you left, so this run can't tell.",
        note: "the worker had handed the player every byte of the track before you left, though its buffered ranges showed less; ",
      };
    }

    let worker;
    if (ok.length) {
      worker = Object.assign({ r: "pass", note: facts }, measures);
    } else if (already) {
      worker = Object.assign({ r: "cant", why: already.why, note: already.note + facts }, measures);
    } else {
      worker = Object.assign({ r: "fail", why: "The worker answered nothing while you were away.", note: facts }, measures);
    }

    let past;
    if (already) {
      past = Object.assign({ r: "cant", why: already.why, note: already.note + facts }, measures);
    } else if (lastOkS !== null && lastOkS >= loaded) {
      past = Object.assign({ r: "pass", note: facts }, measures);
    } else if (awayS > loaded + 30) {
      past = Object.assign({ r: "fail", why: "Playback did not get past what was loaded when you left.", note: facts }, measures);
    } else {
      past = Object.assign({ r: "cant", why: "You were not away long enough to use up what was loaded.", note: facts }, measures);
    }
    setResult(LOCK_ID, "awayWorker", worker);
    setResult(LOCK_ID, "awayPast", past);
    setResult(LOCK_ID, "awayWhole", judgeWhole(lock, to));
    setResult(LOCK_ID, "awayScrub", judgeScrubs(lock, recs, to, whole));
    setResult(LOCK_ID, "mode", lock.mode);
  }

  /** Where the measurement ends: back on the page, the end of the track, or after a reload the last position stored. */
  function lockEnd(lock, to) {
    const events = lock.events || [];
    let end = null;
    if (lock.reloaded) {
      const lastTu = [...events].reverse().find((ev) => ev.type === "timeupdate");
      end = lastTu ? { at: lastTu.at, ct: lastTu.ct } : null;
    } else if (Number.isFinite(lock.endCt)) {
      end = { at: to, ct: lock.endCt };
    }
    const ended = events.find((ev) => ev.type === "ended" && ev.at >= lock.firstHiddenAt);
    if (ended && (!end || ended.at < end.at)) {
      end = { at: ended.at, ct: Number.isFinite(lock.duration) ? lock.duration : ended.ct };
    }
    return end;
  }

  function judgeWhole(lock, to) {
    const end = lockEnd(lock, to);
    if (!end || !Number.isFinite(end.ct) || !Number.isFinite(lock.ctAtHide)) {
      return { r: "cant", why: "The page could not tell where the audio was when you came back.", note: lock.reloaded ? "the page reloaded and had stored no position" : "no position at the end" };
    }
    const g = LM.playbackGap({ start: { at: lock.firstHiddenAt, ct: lock.ctAtHide }, end, events: lock.events || [], duration: lock.duration });
    const gap = g.gapExcludingScrubsS;
    let sum = `expected ${clockPos(g.expectedS)}: ${clockPos(lock.ctAtHide)} when you left + ${secs(g.awayS)} s away`;
    if (g.youPausedS > 0) {
      sum += ` - ${secs(g.youPausedS)} s you paused it`;
    }
    if (g.seeks) {
      sum += ` ${g.jumpsS < 0 ? "-" : "+"} ${secs(Math.abs(g.jumpsS))} s of seeking`;
    }
    const parts = [
      sum,
      `actual ${clockPos(g.actualS)}${end.at < to ? `, ${mmss((end.at - lock.firstHiddenAt) / 1000)} after you left` : ""}`,
      `${secs(g.gapS)} s behind, ${secs(gap)} s without the scrub's own ${secs(g.ownResumeS)} s`,
    ];
    if (g.otherPausedS > 0) {
      parts.push(`paused by something other than you for ${secs(g.otherPausedS)} s`);
    }
    if (lock.reloaded) {
      parts.push("the page reloaded while you were away, so this is measured to the last position it stored");
    }
    const out = {
      note: parts.join("; "),
      gapS: round1(gap),
      gapWithScrubS: round1(g.gapS),
      scrubResumeS: round1(g.ownResumeS),
      expectedS: round1(g.expectedS),
      actualS: round1(g.actualS),
      youPausedS: round1(g.youPausedS),
      otherPausedS: round1(g.otherPausedS),
      seeks: g.seeks,
    };
    if (lock.reloaded && to - end.at > RELOAD_GRACE_MS) {
      return Object.assign({ r: "fail", why: `The browser closed the page about ${mmss((to - end.at) / 1000)} before you came back, so the audio stopped.` }, out);
    }
    if (gap < LOCK_LIMIT_S) {
      return Object.assign({ r: "pass" }, out);
    }
    return Object.assign({ r: "fail", why: `It fell ${gap.toFixed(1)} seconds behind the clock, not counting the scrub.` }, out);
  }

  function judgeScrubs(lock, recs, to, whole) {
    const end = lockEnd(lock, to) || { at: to, ct: NaN };
    const where = device.family === "ios" ? `while the ${device.deviceName} was locked` : "while you were away";
    const list = LM.scrubs({
      start: { at: lock.firstHiddenAt, ct: lock.ctAtHide },
      end,
      events: lock.events || [],
      records: recs.map((r) => ({ at: recAt(r), asked: strip(r.asked) })),
      duration: lock.duration,
      limitS: LOCK_LIMIT_S,
    });
    if (!list.length) {
      return { r: "cant", why: `You did not drag the scrubber ${where}, so this run can't tell.`, note: `no seek ${where}`, scrubs: [] };
    }
    const failed = list.find((s) => !s.pass);
    const worst = failed || list.reduce((a, b) => (b.resumeS > a.resumeS ? b : a));
    const out = {
      note: list.map((s) => scrubNote(s, lock.firstHiddenAt, whole)).join(" | "),
      resumeS: round1(worst.resumeS),
      requestS: round1(worst.requestS),
      scrubs: list.map((s) => ({
        afterS: round1((s.firstAt - lock.firstHiddenAt) / 1000),
        fromS: round1(s.from),
        toS: round1(s.target),
        seeks: s.count,
        yours: s.own,
        targetLoaded: s.inBuffer,
        buffered: s.buffered,
        requestS: round1(s.requestS),
        resumeS: round1(s.resumeS),
        watchedS: round1(s.untilS),
        pass: s.pass,
      })),
    };
    if (!failed) {
      return Object.assign({ r: "pass" }, out);
    }
    const why =
      failed.resumeS === null
        ? `After the scrub the audio did not play again before you came back (${mmss(failed.untilS)}).`
        : `After the scrub the audio took ${failed.resumeS.toFixed(1)} seconds to play again.`;
    return Object.assign({ r: "fail", why }, out);
  }

  function scrubNote(s, hiddenAt, whole) {
    let request = "no request reached the worker";
    if (s.requestS !== null) {
      request = `the worker saw the first request ${secs(s.requestS)} s after seeking (asked ${s.asked})`;
    } else if (s.inBuffer) {
      request = "no request needed";
    } else if (whole) {
      request = "no request needed: the player had fetched the whole track before you left";
    }
    const moved = s.resumeS !== null ? `played again after ${secs(s.resumeS)} s` : `did not play again in the ${mmss(s.untilS)} after it`;
    return (
      `scrub ${mmss((s.firstAt - hiddenAt) / 1000)} after you left, ${clockPos(s.from)} to ${clockPos(s.target)}` +
      `${s.count > 1 ? ` (${s.count} seeks in one drag)` : ""}${s.own ? "" : ", not made by you"}; ` +
      `the target was ${s.inBuffer ? "" : "not "}loaded (buffered ${rangesText(s.buffered)}); ${request}; ${moved}`
    );
  }

  function restartAway() {
    store.data.lock = null;
    state.lockNotice = "";
    if (!lockAudio.paused) {
      lockAudio.pause();
    }
    clearResults(LOCK_ID, [...LOCK_CHECKS, "awayHeard", "scrubHeard", "lockScreen", "mode"]);
    render();
  }

  // ---- track links ---------------------------------------------------------

  const overrideKey = (id) => `/spike/url/${encodeURIComponent(id)}.json`;

  async function readOverride(id) {
    if (!window.caches) {
      return "";
    }
    const res = await (await caches.open(OVERRIDE_CACHE)).match(overrideKey(id));
    return res ? (await res.json()).url || "" : "";
  }

  async function writeOverride(id, url) {
    const cache = await caches.open(OVERRIDE_CACHE);
    if (!url) {
      await cache.delete(overrideKey(id));
      return;
    }
    await cache.put(overrideKey(id), new Response(JSON.stringify({ url }), { headers: { "Content-Type": "application/json" } }));
  }

  function checkUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "https:" || u.hostname === "localhost" ? "" : "not https";
    } catch (e) {
      return "not a URL";
    }
  }

  function idFromUrl(url) {
    try {
      const path = new URL(url).pathname;
      const hit = state.tracks.find((t) => t.file && path.endsWith("/" + t.file));
      return hit ? hit.id : "";
    } catch (e) {
      return "";
    }
  }

  /** The presign command's output: one "<id> <url>" per line; a bare URL is matched by its file name. */
  function parseLinkLines(text) {
    const found = [];
    let ignored = 0;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        continue;
      }
      const m = /^(?:(\S+)\s+)?(https?:\/\/\S+)$/.exec(line);
      if (!m) {
        ignored += 1;
        continue;
      }
      const id = m[1] ? m[1].toLowerCase() : idFromUrl(m[2]);
      if (!id || !state.tracks.some((t) => t.id === id) || checkUrl(m[2])) {
        ignored += 1;
        continue;
      }
      found.push({ id, url: m[2] });
    }
    return { found, ignored };
  }

  async function saveLinkText(text) {
    const { found, ignored } = parseLinkLines(text);
    for (const { id, url } of found) {
      await writeOverride(id, url);
    }
    await refreshLinks();
    return { saved: found.length, ignored };
  }

  async function refreshLinks() {
    const ids = new Set();
    for (const entry of state.tracks) {
      if (entry.url || (await readOverride(entry.id))) {
        ids.add(entry.id);
      }
    }
    state.linkIds = ids;
    state.linksLoaded = true;
    render();
  }

  const hasLink = (id) => state.linkIds.has(id);

  async function onSaveLinks() {
    const area = $("links-input");
    const { saved, ignored } = await saveLinkText(area.value);
    area.value = "";
    if (saved) {
      $("links-status").textContent = `Saved ${plural(saved, "link")}.${ignored ? ` ${plural(ignored, "line")} skipped: not a link for a known format.` : ""}`;
      state.linkExpired = false;
      if (neededTracks().every((t) => hasLink(t.id))) {
        state.editingLinks = false;
      }
      startTrack();
    } else {
      $("links-status").textContent = "No links found. Paste the lines that start with mp3, m4a, flac, wav or lock.";
    }
    render();
  }

  async function onClearLinks() {
    if (!window.confirm("Remove the saved track links from this browser?")) {
      return;
    }
    for (const entry of state.tracks) {
      await writeOverride(entry.id, "");
    }
    $("links-status").textContent = "Removed.";
    await refreshLinks();
  }

  /**
   * #links=<base64url of the presign output> imports the links as "Save
   * links" would. The fragment never reaches a server, and it leaves the
   * address bar before anything else runs.
   */
  function takeFragmentLinks() {
    const hash = location.hash || "";
    if (!/^#links=/.test(hash)) {
      return null;
    }
    try {
      history.replaceState(history.state, "", location.pathname + location.search);
    } catch (e) {
      // An address bar that keeps the fragment is no worse than before.
    }
    try {
      let raw = hash.slice("#links=".length);
      try {
        raw = decodeURIComponent(raw);
      } catch (e) {
        // Not percent-encoded: use it as it is.
      }
      let b64 = raw.trim().replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) {
        b64 += "=";
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) {
      state.fragmentError = "the links in the address could not be read (expected base64url of the presign output)";
      return null;
    }
  }

  // ---- results -------------------------------------------------------------

  function cellMark(v) {
    if (!v || !v.r) {
      return { t: "–", r: "pending" };
    }
    if (v.r === "pass" || v.r === "yes") {
      return { t: "✓", r: "pass" };
    }
    if (v.r === "fail" || v.r === "no") {
      return { t: "✗", r: "fail" };
    }
    if (v.r === "cant") {
      return { t: "?", r: "cant" };
    }
    return { t: "auto", r: "auto" };
  }

  function jumpsCell(f) {
    const vals = JUMPS.map((j) => f[j.key]);
    const done = vals.filter(isDecided).length;
    if (vals.some((v) => v && v.r === "fail")) {
      return { t: "✗", r: "fail" };
    }
    if (done === JUMPS.length) {
      return { t: "✓", r: "pass" };
    }
    return done ? { t: `${done}/${JUMPS.length}`, r: "pending" } : { t: "–", r: "pending" };
  }

  function resultRows() {
    return [
      { label: "First request through the worker", cell: (f) => cellMark(f.first) },
      { label: "Plays", cell: (f) => cellMark(f.plays) },
      { label: "Asks for the next piece", cell: (f) => cellMark(f.next) },
      { label: "Jumps (10%, 50%, 90%, start)", cell: jumpsCell },
      { label: "Right spot (you)", cell: (f) => cellMark(f.spot) },
      { label: "Loaded ahead, playing", cell: (f) => (f.aheadSteady ? { t: `${Math.round(f.aheadSteady.s)} s`, r: "value" } : { t: "–", r: "pending" }) },
      { label: "Loaded ahead, after a jump", cell: (f) => (f.aheadJump ? { t: `${Math.round(f.aheadJump.s)} s`, r: "value" } : { t: "–", r: "pending" }) },
    ];
  }

  /** A check's mark with its seconds, as "✓ 0.8 s". */
  function withSeconds(v, key) {
    const c = cellMark(v);
    return v && Number.isFinite(v[key]) ? { t: `${c.t} ${v[key].toFixed(1)} s`, r: c.r } : c;
  }

  const lockWhere = () => (device.family === "ios" ? "locked" : "away");

  function lockRows() {
    const rows = [
      { label: `Worker answered while ${lockWhere()}`, cell: (f) => cellMark(f.awayWorker) },
      { label: "Went on past what was loaded", cell: (f) => cellMark(f.awayPast) },
      { label: "Played the whole time (seconds behind, not counting the scrub)", cell: (f) => withSeconds(f.awayWhole, "gapS") },
      { label: `Scrub while ${lockWhere()} (seconds until it played again)`, cell: (f) => withSeconds(f.awayScrub, "resumeS") },
      { label: "Played the whole time (you)", cell: (f) => cellMark(f.awayHeard) },
      { label: "Came back after the scrub (you)", cell: (f) => cellMark(f.scrubHeard) },
    ];
    if (device.family === "ios") {
      rows.push({ label: "Lock Screen controls (you)", cell: (f) => cellMark(f.lockScreen) });
    }
    return rows;
  }

  function word(v) {
    if (!v || !v.r) {
      return "not yet";
    }
    const words = { pass: "pass", fail: "fail", cant: "can't tell", yes: "yes", no: "no", auto: "not asked (auto)", skip: "not run (auto)" };
    return words[v.r] || v.r;
  }

  const wordSeconds = (v, key) => (v && Number.isFinite(v[key]) ? `${word(v)} (${v[key].toFixed(1)})` : word(v));

  function buildMarkdown() {
    const lines = [];
    lines.push(`### Spike results: ${device.browser} ${device.version}, ${device.os}`);
    lines.push("");
    lines.push(`- Copied ${zoned.format(Date.now())}.`);
    if (!device.osKnown) {
      lines.push(`- ${device.browser} does not report the OS version: add it here by hand.`);
    }
    lines.push(`- User agent: \`${navigator.userAgent}\``);
    lines.push("");
    lines.push(
      "| Browser | Version | OS | Format | First request through the worker | Plays | Asks for the next piece | Jumps 10% / 50% / 90% / start | Right spot (heard) | Read-ahead playing (s) | Read-ahead after a jump (s) |"
    );
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
    for (const entry of state.sources) {
      const f = readFormat(entry.id);
      const format = entry.format + (f.mode === "rebuilt" ? " (rebuilt response)" : "");
      const steady = f.aheadSteady ? `${Math.round(f.aheadSteady.s)} (max ${Math.round(f.aheadSteady.max)})` : "not yet";
      const after = f.aheadJump ? String(Math.round(f.aheadJump.s)) : "not yet";
      const cells = [
        device.browser, device.version, device.os, format, word(f.first), word(f.plays), word(f.next),
        JUMPS.map((j) => word(f[j.key])).join(" / "), word(f.spot), steady, after,
      ];
      lines.push(`| ${cells.map(md).join(" | ")} |`);
    }
    lines.push("");
    if (lockApplies()) {
      const L = lockResults();
      const where = lockWhere();
      const track = state.lockEntry.format + (L.mode === "rebuilt" ? " (rebuilt response)" : "");
      lines.push(`The ${testName()}, once in this browser, on its own 30-minute WAV with Loop off:`);
      lines.push("");
      lines.push(
        `| Browser | Version | OS | Track | Worker answered while ${where} | Went on past what was loaded | Played the whole time (s behind) | Scrub while ${where} (s to play again) | Played the whole time (heard) | Came back after the scrub (heard) | Lock Screen controls (heard) |`
      );
      lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
      const cells = [
        device.browser, device.version, device.os, track, word(L.awayWorker), word(L.awayPast),
        wordSeconds(L.awayWhole, "gapS"), wordSeconds(L.awayScrub, "resumeS"), word(L.awayHeard), word(L.scrubHeard),
        device.family === "ios" ? word(L.lockScreen) : "n/a",
      ];
      lines.push(`| ${cells.map(md).join(" | ")} |`);
    } else {
      lines.push("Lock test: n/a in this browser (only Safari on an iPhone, an iPad or a Mac runs it).");
    }
    const notes = noteLines();
    if (notes.length) {
      lines.push("");
      lines.push("<details><summary>Notes for each check</summary>");
      lines.push("");
      notes.forEach((n) => lines.push(`- ${n}`));
      lines.push("");
      lines.push("</details>");
    }
    return lines.join("\n");
  }

  function noteLines() {
    const out = [];
    const names = { first: "first request", plays: "plays", next: "next piece" };
    JUMPS.forEach((j) => {
      names[j.key] = "jump " + j.short;
    });
    for (const entry of state.sources) {
      const f = readFormat(entry.id);
      const parts = [];
      for (const key of Object.keys(names)) {
        if (f[key] && f[key].note) {
          parts.push(`${names[key]}: ${word(f[key])}, ${f[key].note}`);
        }
      }
      if (f.aheadSteady) {
        parts.push(`read-ahead playing: median ${f.aheadSteady.s} s, max ${f.aheadSteady.max} s, ${f.aheadSteady.n} samples`);
      }
      if (f.aheadJump) {
        parts.push(`read-ahead 10 s after a jump: ${f.aheadJump.values.join(", ")} s`);
      }
      if (parts.length) {
        out.push(`**${entry.format}**: ${parts.join("; ")}`);
      }
    }
    if (lockApplies()) {
      const L = lockResults();
      const lockNames = { awayWorker: "worker", awayPast: "past what was loaded", awayWhole: "played the whole time", awayScrub: "scrub" };
      const parts = Object.keys(lockNames)
        .filter((k) => L[k] && L[k].note)
        .map((k) => `${lockNames[k]}: ${word(L[k])}, ${L[k].note}`);
      if (parts.length) {
        out.push(`**${state.lockEntry.format}**: ${parts.join("; ")}`);
      }
    }
    return out;
  }

  async function copyText(text, outId, statusId) {
    const out = $(outId);
    out.value = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      $(statusId).textContent = "Copied. The text is also below.";
    } catch (err) {
      out.focus();
      out.select();
      $(statusId).textContent = "The browser would not copy. Select the text below and copy it.";
    }
  }

  async function startOver() {
    if (!window.confirm("Start over? This clears the results saved in this browser. The track links stay saved.")) {
      return;
    }
    store.data = emptyStore();
    chooseInitialFormat();
    state.lockNotice = "";
    if (!lockAudio.paused) {
      lockAudio.pause();
    }
    // The next "Play from 0:00" loads the lock track again, in a new session.
    state.lockSession = null;
    if (window.caches) {
      await caches.delete(LOG_CACHE);
    }
    state.records.clear();
    state.allRecords.clear();
    state.sessions = [];
    state.current = null;
    state.earlierStored = 0;
    $("copy-out").hidden = true;
    $("copy-status").textContent = "";
    startTrack();
  }

  function redoFormat() {
    const entry = currentEntry();
    if (!entry || !window.confirm(`Clear the ${entry.id.toUpperCase()} results and do this format again?`)) {
      return;
    }
    delete store.data.formats[entry.id];
    saveStore();
    startTrack();
  }

  function nextFormatId() {
    const ids = state.sources.map((t) => t.id);
    const entry = currentEntry();
    const start = entry ? ids.indexOf(entry.id) : -1;
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(start + k) % ids.length];
      if (!stepState(id).done) {
        return id;
      }
    }
    return null;
  }

  function goNext() {
    const id = nextFormatId();
    const entry = currentEntry();
    if (!id || (entry && id === entry.id)) {
      const where = lockApplies() && !lockDone() ? "step-away" : "results-card";
      $(where).scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    pickFormat(id);
    $("steps-card").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // ---- the automatic run ---------------------------------------------------

  function publishAuto(out) {
    const json = JSON.stringify(out, null, 2);
    try {
      window.spikeResults = JSON.parse(json);
    } catch (e) {
      // window is always writable; nothing to do.
    }
    try {
      window.localStorage.setItem(AUTO_RESULTS_KEY, json);
    } catch (e) {
      out.storageNote = "localStorage refused the results";
    }
    const pre = $("auto-results");
    pre.textContent = json;
    pre.dataset.state = out.state;
    if (out.error) {
      pre.dataset.error = out.error;
    } else {
      delete pre.dataset.error;
    }
  }

  function autoShell() {
    return {
      kind: "spike-sw-audio-auto",
      version: 1,
      state: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      userAgent: navigator.userAgent,
      browser: device.browser,
      browserVersion: device.version,
      os: device.os,
      osVersionKnown: device.osKnown,
      device: device.family,
      settings: {
        formats: AUTO_FORMATS,
        dwellSeconds: AUTO_DWELL_S,
        response: $("mode").value,
        steadyAfterSeconds: steadyAfterMs() / 1000,
        afterSeekSeconds: afterJumpMs() / 1000,
        resumeLimitSeconds: RESUME_LIMIT_MS / 1000,
      },
      passed: null,
      lockTest: lockApplies() ? "not run (auto)" : "n/a",
      formats: [],
      error: null,
    };
  }

  function autoFail(message) {
    const out = autoShell();
    out.state = "failed";
    out.error = message;
    out.finishedAt = new Date().toISOString();
    state.auto = { done: true, state: "failed", error: message };
    publishAuto(out);
    render();
  }

  function autoStep(text) {
    if (state.auto) {
      state.auto.step = text;
    }
    render();
  }

  async function autoRun() {
    const out = autoShell();
    publishAuto(out);
    try {
      const known = state.sources.map((t) => t.id);
      const ids = AUTO_FORMATS.length ? AUTO_FORMATS : known;
      const unknown = ids.filter((id) => !known.includes(id));
      if (unknown.length) {
        throw new Error(`unknown format ${unknown.join(", ")}; the formats are ${known.join(", ")}`);
      }
      const missing = ids.filter((id) => !hasLink(id));
      if (missing.length) {
        throw new Error(
          `no link saved for ${missing.join(", ")}${state.fragmentError ? ` (${state.fragmentError})` : ""}: pass the links in #links=, or limit the run with &formats=`
        );
      }
      out.settings.formats = ids;
      for (let i = 0; i < ids.length; i++) {
        state.auto = { index: i, total: ids.length, format: ids[i], step: "starting" };
        const result = await autoFormat(ids[i]);
        out.formats.push(result);
        publishAuto(out);
        if (result.linkExpired) {
          throw new Error("the track links have expired (S3 answered 403): presign again and pass the new links in #links=");
        }
        if (result.playRefused) {
          throw new Error(`the browser refused to start muted playback without a tap (${result.playRefused})`);
        }
      }
      out.passed = out.formats.every((f) => f.passed);
      out.state = "done";
    } catch (err) {
      out.state = "failed";
      out.error = errText(err);
    }
    out.finishedAt = new Date().toISOString();
    audio.pause();
    state.auto = {
      done: true,
      state: out.state,
      error: out.error,
      passedCount: out.formats.filter((f) => f.passed).length,
      total: out.formats.length,
    };
    publishAuto(out);
    render();
  }

  async function autoFormat(id) {
    pickFormat(id);
    const s = state.current;
    const dwellMs = AUTO_DWELL_S * 1000;
    autoStep("starting playback");
    const played = await playAudio();
    if (!played.ok && played.name === "NotAllowedError") {
      finalizeAuto(s);
      return Object.assign(autoFormatResult(s), { playRefused: played.name });
    }
    autoStep("playing");
    await waitUntil(() => s.linkExpired || errorSettled(s, Date.now()) || Date.now() - s.startedAt >= dwellMs, dwellMs + 1000);
    if (!s.linkExpired && !s.error) {
      await waitUntil(() => s.linkExpired || Number.isFinite(audio.duration), 15000);
      for (const spec of JUMPS) {
        if (s.linkExpired || !Number.isFinite(audio.duration)) {
          break;
        }
        autoStep(spec.label.toLowerCase());
        jump(spec.key);
        const j = s.jumps[s.jumps.length - 1];
        await waitUntil(() => s.linkExpired || (j.done && Date.now() - j.at >= dwellMs), dwellMs + RESUME_LIMIT_MS + 2000);
      }
    }
    finalizeAuto(s);
    return autoFormatResult(s);
  }

  /** Settles every check the run could not settle, and marks what only a person can answer. */
  function finalizeAuto(s) {
    const id = s.entry.id;
    evaluate(s, Date.now());
    if (!s.linkExpired) {
      if (!s.decided.first) {
        decide(s, "first", { r: "fail", why: "No request reached the worker.", note: "no request reached the worker during the run" });
      }
      if (!s.decided.plays) {
        decide(s, "plays", { r: "fail", why: "The audio did not start.", note: `the position advanced only ${s.playedS.toFixed(1)} s` });
      }
      if (!s.decided.next) {
        const c = s.metrics.next;
        decide(s, "next", {
          r: "cant",
          why: "The page could not see the player ask for the next piece.",
          shortAnswers: c.shorts,
          followed: c.followed,
          note: `${plural(c.shorts, "short answer")}, none followed by a request for the next byte during the run`,
        });
      }
      for (const spec of JUMPS) {
        const tried = s.jumps.filter((j) => j.key === spec.key).pop();
        if (!tried || !tried.done || tried.abandoned) {
          setResult(id, spec.key, { r: "fail", ms: null, requests: 0, why: "Not tried.", note: "not tried: the run stopped before this jump" });
        }
      }
      storeSteady(s);
      storeAfterJump(s);
    }
    const f = readFormat(id);
    if (!isAnswered(f.spot)) {
      setResult(id, "spot", { r: "auto" });
    }
    if (lockApplies()) {
      // The lock test is not part of the run; its table says so.
      const L = lockResults();
      LOCK_CHECKS.forEach((k) => {
        if (!isDecided(L[k])) {
          setResult(LOCK_ID, k, { r: "skip" });
        }
      });
      ["awayHeard", "scrubHeard"].concat(device.family === "ios" ? ["lockScreen"] : []).forEach((k) => {
        if (!isAnswered(L[k])) {
          setResult(LOCK_ID, k, { r: "auto" });
        }
      });
    }
  }

  function autoFormatResult(s) {
    const id = s.entry.id;
    const f = readFormat(id);
    const recs = sessionRecords(s);
    const seeks = JUMPS.map((spec) => {
      const v = f[spec.key] || null;
      const tried = s.jumps.filter((j) => j.key === spec.key).pop() || null;
      return {
        to: spec.short,
        targetSeconds: tried ? round1(tried.target) : null,
        result: word(v),
        resumeMs: v && Number.isFinite(v.ms) ? v.ms : null,
        requestsThroughWorker: v && Number.isFinite(v.requests) ? v.requests : null,
        targetAlreadyLoaded: tried ? tried.inBuffer : null,
        readAheadAfterSeconds: tried && tried.aheadAfter !== null ? round1(tried.aheadAfter) : null,
        note: (v && v.note) || "",
      };
    });
    const statuses = {};
    recs.forEach((r) => {
      const key = r.status === undefined ? (r.aborted ? "aborted" : "failed") : String(r.status);
      statuses[key] = (statuses[key] || 0) + 1;
    });
    const steady = f.aheadSteady;
    const after = f.aheadJump;
    const first = s.metrics.first || {};
    const passed =
      !s.linkExpired &&
      isPass(f.first) &&
      isPass(f.plays) &&
      JUMPS.every((j) => isPass(f[j.key])) &&
      !(f.next && f.next.r === "fail");
    return {
      format: id,
      label: s.entry.label,
      response: s.mode,
      durationSeconds: Number.isFinite(audio.duration) ? round1(audio.duration) : null,
      passed,
      linkExpired: s.linkExpired,
      playerError: s.error,
      checks: {
        firstRequest: { result: word(f.first), askedRange: first.asked || null, status: first.status === undefined ? null : first.status, ms: first.ms === undefined ? null : first.ms, note: (f.first && f.first.note) || "" },
        playbackAdvances: { result: word(f.plays), playedSeconds: round1(s.playedS), note: (f.plays && f.plays.note) || "" },
        nextPiece: { result: word(f.next), shortAnswers: s.metrics.next.shorts, followed: s.metrics.next.followed, note: (f.next && f.next.note) || "" },
        seeks,
        readAhead: {
          playing: steady
            ? { result: "measured", medianSeconds: steady.s, maxSeconds: steady.max, samples: steady.n }
            : { result: "not measured", medianSeconds: null, maxSeconds: null, samples: 0 },
          afterSeek: after
            ? { result: "measured", medianSeconds: after.s, valuesSeconds: after.values }
            : { result: "not measured", medianSeconds: null, valuesSeconds: [] },
        },
        rightSpot: word(f.spot),
      },
      requests: {
        total: recs.length,
        answered: recs.filter(isOk).length,
        errors: recs.filter((r) => r.error && !r.aborted).length,
        aborted: recs.filter((r) => r.aborted).length,
        statuses,
        workerInstances: [...new Set(recs.map((r) => r.instance))],
      },
    };
  }

  // ---- rendering -----------------------------------------------------------

  function setStatus(text, kind) {
    const el = $("sw-status");
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
  }

  function setCheck(id, value, live) {
    const el = $(id);
    const r = value && value.r ? value.r : live || "pending";
    el.dataset.result = r;
    const why = el.querySelector(".why");
    if (!why) {
      return;
    }
    if (value && (r === "fail" || r === "cant")) {
      why.textContent = value.why || "";
    } else if (r === "auto" || r === "skip") {
      why.textContent = "Not run: this was an automatic run.";
    } else {
      why.textContent = "";
    }
  }

  function renderAnswers(name, f, enabled) {
    document.querySelectorAll(`[data-answer="${name}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(!!f[name] && f[name].r === b.dataset.value));
      b.disabled = !enabled;
    });
  }

  function whoLine() {
    let line = `You are in ${device.browser}${device.version ? " " + device.version : ""} on ${device.os}.`;
    if (device.family === "ios" && device.browser !== "Safari") {
      line += " Every iPhone browser uses Safari's engine; the issue's table needs Safari itself.";
    } else if (device.family === "ios") {
      line += ` This ${device.deviceName} also does the lock test.`;
    } else if (device.family === "mac-safari") {
      line += " Safari on the Mac also does the background test.";
    }
    return line;
  }

  function autoBannerText() {
    const a = state.auto;
    if (!a) {
      return "Automatic run: waiting for the test player.";
    }
    if (a.done) {
      if (a.state === "failed") {
        return `Automatic run failed: ${a.error}`;
      }
      return `Automatic run done: ${a.passedCount} of ${plural(a.total, "format")} passed. Machine-readable results are in localStorage "${AUTO_RESULTS_KEY}".`;
    }
    return `Automatic run (muted, no taps needed): ${String(a.format).toUpperCase()}, ${a.index + 1} of ${a.total}, ${a.step || ""}.`;
  }

  function render() {
    renderBanners();
    renderLinks();
    renderSteps();
    renderResults();
    if ($("debug").open) {
      renderNotes();
    }
  }

  function renderBanners() {
    $("banner-expired").hidden = !state.linkExpired;
    const setup = $("banner-setup");
    setup.hidden = !state.setupError;
    setup.textContent = state.setupError;
    const auto = $("banner-auto");
    auto.hidden = !AUTO;
    auto.textContent = AUTO ? autoBannerText() : "";
  }

  function renderLinks() {
    const needed = neededTracks();
    const total = needed.length;
    const count = needed.filter((t) => hasLink(t.id)).length;
    const complete = state.linksLoaded && total > 0 && count === total;
    const showForm = state.linksLoaded && (!complete || state.editingLinks || state.linkExpired);
    $("links-card").hidden = !state.linksLoaded;
    $("links-line").hidden = !complete || showForm;
    $("links-form").hidden = !showForm;
    $("links-close").hidden = !complete;
    $("links-count").textContent = `Links: ${count} of ${total} saved`;
    $("links-each").textContent = needed.map((t) => `${t.id.toUpperCase()} ${hasLink(t.id) ? "saved" : "missing"}`).join(" · ");
  }

  function renderChips() {
    const entry = currentEntry();
    document.querySelectorAll("#chips .chip").forEach((chip) => {
      const id = chip.dataset.format;
      chip.setAttribute("aria-pressed", String(!!entry && entry.id === id));
      chip.dataset.done = String(stepState(id).done);
      chip.disabled = !state.controlled;
    });
  }

  function renderSteps() {
    const entry = currentEntry();
    const s = state.current;
    const haveLink = !!entry && hasLink(entry.id);
    const usable = state.controlled && state.linksLoaded && haveLink && !state.setupError;
    let wait = "";
    if (state.setupError) {
      wait = "The test cannot run in this browser: see the message at the top.";
    } else if (!state.controlled || !state.linksLoaded) {
      wait = "Getting the test player ready…";
    } else if (!haveLink) {
      wait = "Save the track links above to begin.";
    }
    $("steps-wait").textContent = wait;
    $("steps-wait").hidden = !wait;
    $("who").textContent = whoLine();
    renderChips();

    const f = entry ? readFormat(entry.id) : {};
    const st = entry ? stepState(entry.id) : { play: false, jump: false, ahead: false, done: false };
    const lockOn = lockApplies();
    // The lock step shows in every format's list, but it is one test for the browser.
    const flags = Object.assign({}, st, { away: !lockOn || lockDone() });
    const order = ["play", "jump", "ahead"];
    if (lockOn) {
      order.push("away");
    }
    const current = order.find((k) => !flags[k]) || "next";
    $("step-away").hidden = !lockOn;
    let n = 0;
    for (const key of ["pick", "play", "jump", "ahead", "away", "next"]) {
      const el = $("step-" + key);
      if (el.hidden) {
        continue;
      }
      n += 1;
      const done = key === "pick" ? !!entry : key === "next" ? false : !!flags[key];
      const isCurrent = usable && key === current;
      el.classList.toggle("current", isCurrent);
      el.classList.toggle("done", done && !isCurrent);
      el.querySelector(".num").textContent = done && !isCurrent ? "✓" : String(n);
      if (isCurrent) {
        el.setAttribute("aria-current", "step");
      } else {
        el.removeAttribute("aria-current");
      }
    }

    // Press play
    const playing = !audio.paused;
    $("play").disabled = !usable;
    $("play").textContent = playing ? "Pause" : "Play";
    $("pos").textContent = positionText();
    const live = (key) => (s && !s.decided[key] && (s.firstPlayAt || playing) ? "checking" : null);
    setCheck("check-first", f.first, live("first"));
    setCheck("check-plays", f.plays, live("plays"));
    setCheck("check-next", f.next, live("next"));

    // Jumps
    const knowDuration = Number.isFinite(audio.duration);
    for (const spec of JUMPS) {
      const button = document.querySelector(`[data-jump="${spec.key}"]`);
      button.disabled = !usable || !knowDuration;
      $("expect-" + spec.key).textContent = expectText(spec.fraction);
      const value = f[spec.key];
      const tried = s ? s.jumps.filter((j) => j.key === spec.key).pop() : null;
      const line = $("check-" + spec.key);
      let r = value && value.r ? value.r : "pending";
      let text = "Not done yet.";
      if (tried && !tried.done) {
        r = "checking";
        text = "Checking…";
      } else if (value && value.r === "pass") {
        text = `Played again after ${(value.ms / 1000).toFixed(1)} seconds.`;
      } else if (value && value.r === "fail") {
        text = value.why || "Failed.";
      } else if (value && (value.r === "auto" || value.r === "skip")) {
        text = "Not run: this was an automatic run.";
      } else if (tried && tried.abandoned) {
        text =
          tried.abandoned === "paused"
            ? "Not checked: the player was paused. Press it again."
            : "Not checked: you jumped again too soon. Press it again.";
      }
      line.dataset.result = r;
      line.querySelector(".what").textContent = text;
    }
    renderAnswers("spot", f, usable && JUMPS.every((j) => isDecided(f[j.key])));

    // Read-ahead
    const steady = f.aheadSteady;
    const after = f.aheadJump;
    let aheadText = "Measuring… keep it playing.";
    if (steady && after) {
      aheadText = `Loaded about ${Math.round(steady.s)} seconds ahead while playing (at most ${Math.round(steady.max)}), and about ${Math.round(after.s)} seconds ahead after a jump.`;
    } else if (steady) {
      aheadText = `Loaded about ${Math.round(steady.s)} seconds ahead while playing. Still to measure: let it play 10 seconds after any jump.`;
    } else if (after) {
      aheadText = `Loaded about ${Math.round(after.s)} seconds ahead after a jump. Still to measure: let it play for half a minute without jumping.`;
    }
    $("check-ahead").dataset.result = steady && after ? "pass" : playing ? "checking" : "pending";
    $("check-ahead").querySelector(".what").textContent = aheadText;

    renderAway();

    // Next format
    const nextId = nextFormatId();
    const nextEntry = state.sources.find((t) => t.id === nextId);
    let nextText = "Finish the steps above first, or move on and come back to this format later.";
    if (!nextId || (entry && nextId === entry.id && st.done)) {
      if (lockOn && !lockDone()) {
        nextText = `All four formats are done in this browser. Do the ${testName()} above to finish.`;
        $("next").textContent = `Go to the ${testName()}`;
      } else {
        nextText = `All four formats are done in this browser${lockOn ? `, and the ${testName()} too` : ""}. Copy the results below and post them on dj-site#2148.`;
        $("next").textContent = "Go to the results";
      }
    } else {
      if (st.done) {
        nextText = "This format is done.";
      }
      $("next").textContent = nextEntry && (!entry || nextEntry.id !== entry.id) ? `Next format: ${nextEntry.id.toUpperCase()}` : "Go to the results";
    }
    $("next-text").textContent = nextText;
    $("next").disabled = !usable;
    $("redo").disabled = !usable;
  }

  function lockStepTexts(ios) {
    const name = device.deviceName;
    const listen = "Listen: does the audio come back within a few seconds? Remember the answer; the page asks you below.";
    if (ios) {
      return {
        leave: `Lock the ${name} with the side button. The 15:00 starts now.`,
        scrub: `About 5 minutes later, wake the screen without unlocking it (tap it, or raise the ${name}). In the Lock Screen player, drag the scrubber forward by about 5 minutes, from about 5:00 to about 10:00.`,
        listen,
        wait: `Leave the ${name} locked until 15 minutes have passed since you locked it. Just before you unlock it, press pause and then play on the Lock Screen.`,
        back: `Unlock the ${name} and come back to this page. The page then checks the test by itself.`,
      };
    }
    return {
      leave: "Switch to another tab, then minimize this window (the yellow button at the top left). The 15:00 starts now.",
      scrub: "About 5 minutes later, open Control Center in the menu bar and, in Now Playing, drag the scrubber forward by about 5 minutes, from about 5:00 to about 10:00. Leave the window minimized. If Now Playing shows no scrubber, skip this step.",
      listen,
      wait: "Leave it until 15 minutes have passed since you minimized the window.",
      back: "Bring the window back and come back to this tab. The page then checks the test by itself.",
    };
  }

  function lockSessionText(ios) {
    const where = ios ? "Lock Screen" : "Now Playing";
    if (!("mediaSession" in navigator)) {
      return `This browser has no Media Session API, so the ${where} shows the browser's own controls for this player.`;
    }
    if (state.mediaFor === "lock" && state.lockHandlers.length) {
      return `The page gave this player its own ${where} controls (Media Session handlers for ${state.lockHandlers.join(", ")}), so the ${where} shows a scrubber for it and the page hears each press.`;
    }
    return `When you press Play from 0:00, the page gives this player its own ${where} controls (Media Session handlers for play, pause, seekto, seekforward and seekbackward), so the ${where} shows a scrubber for it.`;
  }

  function wholeText(v) {
    const base = "The audio played the whole time";
    if (v && Number.isFinite(v.gapS)) {
      return `${base}: ${v.gapS.toFixed(1)} seconds behind the clock, not counting the scrub`;
    }
    return `${base} (under ${LOCK_LIMIT_S} seconds behind the clock, not counting the scrub)`;
  }

  function scrubText(v) {
    const base = `After you dragged the scrubber, the audio played again within ${LOCK_LIMIT_S} seconds`;
    if (v && Number.isFinite(v.resumeS)) {
      return `${base}: it took ${v.resumeS.toFixed(1)} seconds`;
    }
    return base;
  }

  function renderAway() {
    if (!lockApplies()) {
      return;
    }
    const ios = device.family === "ios";
    const L = lockResults();
    const haveLink = hasLink(LOCK_ID);
    const usable = state.controlled && state.linksLoaded && haveLink && !state.setupError;
    const lock = store.data.lock && store.data.lock.format === LOCK_ID ? store.data.lock : null;
    const live = activeLock();
    $("away-title").textContent = ios
      ? `Lock the ${device.deviceName} for 15 minutes (once in this browser)`
      : "Leave Safari in the background for 15 minutes (once in this browser)";
    $("away-intro").textContent =
      `This test plays its own 30-minute WAV, once in this browser rather than for each format, with Loop off. ` +
      `Safari loads a WAV a piece at a time as it plays, so the worker has to keep answering while ${ios ? `the ${device.deviceName} is locked` : "Safari is in the background"}. ` +
      "It sounds like the other tracks: the tone steps up a little each minute, and the pips count the 10-second marks.";
    $("lock-nolink").hidden = haveLink || !state.linksLoaded;
    const texts = lockStepTexts(ios);
    ["leave", "scrub", "listen", "wait", "back"].forEach((k) => {
      $("lock-step-" + k).textContent = texts[k];
    });
    const play = $("play-away");
    play.disabled = !usable;
    play.textContent = !lockAudio.paused ? "Pause" : live ? "Play" : "Play from 0:00";
    $("lock-pos").textContent = positionText(lockAudio);
    $("lock-session").textContent = lockSessionText(ios);

    const decided = lockDecided(L);
    $("away-countdown").textContent = countdownText(lock, decided, ios);
    const checking = lock && lock.phase !== "done" ? "checking" : null;
    setCheck("check-away-worker", L.awayWorker, checking);
    setCheck("check-away-past", L.awayPast, checking);
    setCheck("check-away-whole", L.awayWhole, checking);
    setCheck("check-away-scrub", L.awayScrub, checking);
    $("check-away-whole").querySelector(".what").textContent = wholeText(L.awayWhole);
    $("check-away-scrub").querySelector(".what").textContent = scrubText(L.awayScrub);
    const canAnswer = usable && (decided || (!!lock && lock.phase === "done"));
    renderAnswers("awayHeard", L, canAnswer);
    renderAnswers("scrubHeard", L, canAnswer);
    renderAnswers("lockScreen", L, canAnswer);
    $("q-lockscreen").hidden = !ios;
    $("away-restart").hidden = !lock && !decided && !isAnswered(L.awayHeard);
  }

  function countdownText(lock, decided, ios) {
    const now = Date.now();
    if (state.lockNotice) {
      return state.lockNotice;
    }
    const leave = ios ? `you lock the ${device.deviceName}` : "you leave this page";
    if (!lock) {
      if (decided) {
        return "";
      }
      if (!lockAudio.paused) {
        return `Ready. The 15:00 starts when ${leave}.`;
      }
      return `Press Play from 0:00 first. The 15:00 starts when ${leave} while the 30-minute track plays.`;
    }
    if (lock.phase === "away") {
      return "Away…";
    }
    if (lock.phase === "back") {
      const left = AWAY_MS - (now - lock.firstHiddenAt);
      return `${mmss(left / 1000)} to go. ${ios ? `Lock the ${device.deviceName} again` : "Leave this page again"}; the clock keeps running.`;
    }
    if (lock.phase === "evaluating") {
      return "Checking…";
    }
    const total = ((lock.endAt || now) - lock.firstHiddenAt) / 1000;
    let text = `Done: you were away ${mmss(total)}.`;
    if (lock.reloaded) {
      text += " The page had reloaded when you came back, so the browser had closed it.";
    }
    if (lock.expired) {
      text += " The links expired during the test: save new links, then press Restart this test.";
    }
    return text;
  }

  function renderResults() {
    $("results-who").textContent = `${device.browser} ${device.version} · ${device.os}`;
    const hint = $("os-hint");
    hint.hidden = device.osKnown;
    hint.textContent = device.osKnown ? "" : `${device.browser} does not report the ${device.os} version, so add it to the comment by hand${device.family === "mac-safari" || device.deviceName === "Mac" ? " (Apple menu, About This Mac)" : ""}.`;
    const note = $("store-note");
    note.hidden = !store.note;
    note.textContent = store.note;
    fillTable(
      $("results"),
      "formats",
      state.sources.map((t) => t.id.toUpperCase()),
      resultRows().map((row) => ({ label: row.label, cells: state.sources.map((entry) => Object.assign({ format: entry.id }, row.cell(readFormat(entry.id)))) }))
    );
    const lockOn = lockApplies();
    $("lock-results").hidden = !lockOn;
    $("lock-results-title").hidden = !lockOn;
    if (lockOn) {
      $("lock-results-title").textContent = `${device.family === "ios" ? "Lock test" : "Background test"}, once in this browser (30-minute WAV)`;
      const L = lockResults();
      fillTable($("lock-results"), "lock", ["Result"], lockRows().map((row) => ({ label: row.label, cells: [Object.assign({ format: LOCK_ID }, row.cell(L))] })));
    }
  }

  /** Rebuilds a results table only when what it shows has changed. */
  function fillTable(table, key, heads, rows) {
    const sig = JSON.stringify([heads, rows]);
    if (state.tableSigs[key] === sig) {
      return;
    }
    state.tableSigs[key] = sig;
    const head = document.createElement("tr");
    ["Check", ...heads].forEach((text) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      head.appendChild(th);
    });
    table.tHead.textContent = "";
    table.tHead.appendChild(head);
    const body = table.tBodies[0];
    body.textContent = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = row.label;
      tr.appendChild(th);
      row.cells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c.t;
        td.dataset.result = c.r;
        td.dataset.format = c.format;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function renderNotes() {
    const box = $("notes");
    const lines = noteLines();
    const sig = JSON.stringify(lines);
    if (box.dataset.sig === sig) {
      return;
    }
    box.dataset.sig = sig;
    box.textContent = "";
    if (!lines.length) {
      box.textContent = "No checks have run yet.";
      return;
    }
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line.replace(/\*\*/g, "");
      box.appendChild(p);
    });
  }

  function renderStats() {
    const s = state.current;
    $("st-time").textContent = audio.currentTime.toFixed(2) + " s";
    $("st-duration").textContent = Number.isFinite(audio.duration) ? audio.duration.toFixed(2) + " s" : String(audio.duration);
    $("st-buffered").textContent = bufferedText();
    $("st-ahead").textContent = readAhead().toFixed(1) + " s";
    $("st-max").textContent = s ? s.maxAhead.toFixed(1) + " s" : "-";
    const err = audio.error ? `, error ${audio.error.code} ${audio.error.message || ""}` : "";
    $("st-state").textContent = `${audio.paused ? "paused" : "playing"}, readyState ${audio.readyState}, networkState ${audio.networkState}${audio.muted ? ", muted" : ""}${err}`;
  }

  function recordNote(r) {
    return [r.rule !== "as asked" ? r.rule : "", r.aborted ? "aborted" : "", r.error || "", r.note || "", r.urlFrom === "sources.json" ? "url from sources.json" : ""]
      .filter(Boolean)
      .join("; ");
  }

  function recordMs(r) {
    if (r.ttfbMs === undefined) {
      return "...";
    }
    return r.totalMs !== undefined ? `${r.ttfbMs}/${r.totalMs}` : String(r.ttfbMs);
  }

  function recordBytes(r) {
    return r.delivered !== undefined ? `${fmtBytes(r.bytes)} (${fmtBytes(r.delivered)} sent)` : fmtBytes(r.bytes);
  }

  function renderLog() {
    const s = state.shown || state.current;
    const body = $("log").tBodies[0];
    body.textContent = "";
    if (!s) {
      return;
    }
    const recs = sessionRecords(s);
    recs.forEach((r, i) => {
      const tr = document.createElement("tr");
      const cells = [
        i + 1,
        ((recAt(r) - s.startedAt) / 1000).toFixed(1),
        strip(r.asked),
        strip(r.sent),
        r.status === undefined ? "..." : r.status,
        strip(r.contentRange) || "-",
        recordBytes(r),
        r.lookupMs === undefined ? "-" : r.lookupMs,
        recordMs(r),
        r.instance,
        recordNote(r),
      ];
      cells.forEach((v, j) => {
        const td = document.createElement("td");
        td.textContent = String(v);
        if (j === cells.length - 1 && (r.error || r.aborted)) {
          td.className = "bad";
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    const earlier = state.earlierStored ? ` ${state.earlierStored} records from earlier page loads are stored too.` : "";
    $("log-note").textContent = `Session ${s.n}: ${s.entry.label}, ${s.mode}. ${plural(recs.length, "request")} through the worker.${earlier}`;
  }

  /** Every session of this page load, with its request log and events, for debugging. */
  function buildLogMarkdown() {
    const lines = [];
    lines.push(`### Spike request log: ${device.browser} ${device.version}, ${device.os}`);
    lines.push("");
    lines.push(`- Page loaded ${zoned.format(PAGE_STARTED)}; copied ${zoned.format(Date.now())}`);
    lines.push(`- User agent: \`${navigator.userAgent}\``);
    lines.push("- A new worker id within one session means the browser stopped the worker and started it again.");
    for (const s of state.sessions) {
      const recs = sessionRecords(s);
      lines.push("");
      lines.push(`<details><summary>Session ${s.n}: ${s.entry.label}, ${s.mode} response, ${plural(recs.length, "request")}</summary>`);
      lines.push("");
      lines.push("| # | t (s) | asked | sent | rule | status | returned | bytes | sent bytes | lookup ms | ms | worker | note |");
      lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
      recs.forEach((r, i) => {
        const rel = ((recAt(r) - s.startedAt) / 1000).toFixed(1);
        const note = [r.aborted ? "aborted" : "", r.error || "", r.note || "", r.urlFrom || ""].filter(Boolean).join("; ");
        lines.push(
          `| ${i + 1} | ${rel} | ${md(strip(r.asked))} | ${md(strip(r.sent))} | ${md(r.rule)} | ${md(r.status)} | ${md(strip(r.contentRange))} | ${md(r.bytes)} | ${md(r.delivered)} | ${md(r.lookupMs)} | ${md(recordMs(r))} | ${md(r.instance)} | ${md(note)} |`
        );
      });
      lines.push("");
      lines.push("```");
      s.events.forEach((ev) => lines.push(eventLine(s, ev)));
      lines.push("```");
      lines.push("");
      lines.push("</details>");
    }
    return lines.join("\n");
  }

  async function clearLog() {
    if (window.caches) {
      await caches.delete(LOG_CACHE);
    }
    state.records.clear();
    state.allRecords.clear();
    state.earlierStored = 0;
    startTrack();
  }

  // ---- start ---------------------------------------------------------------

  function buildJumps() {
    const box = $("jumps");
    for (const spec of JUMPS) {
      const row = document.createElement("div");
      row.className = "jump";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "big";
      button.dataset.jump = spec.key;
      button.dataset.testid = spec.testid;
      button.textContent = spec.label;
      button.disabled = true;
      button.addEventListener("click", () => jump(spec.key));
      const expect = document.createElement("p");
      expect.className = "expect";
      expect.id = "expect-" + spec.key;
      const line = document.createElement("p");
      line.className = "check";
      line.id = "check-" + spec.key;
      line.dataset.testid = "check-" + spec.testid;
      line.dataset.result = "pending";
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      const what = document.createElement("span");
      what.className = "what";
      line.append(mark, what);
      row.append(button, expect, line);
      box.appendChild(row);
    }
  }

  function buildChips() {
    const box = $("chips");
    box.textContent = "";
    for (const entry of state.sources) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.format = entry.id;
      chip.dataset.testid = "format-" + entry.id;
      chip.textContent = entry.id.toUpperCase();
      chip.title = entry.label;
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", () => pickFormat(entry.id));
      box.appendChild(chip);
    }
  }

  async function loadSources() {
    const res = await fetch("/spike/sources.json", { cache: "no-store" });
    const json = await res.json();
    state.tracks = json.tracks || [];
    state.sources = state.tracks.filter((t) => t.id !== LOCK_ID);
    state.lockEntry = state.tracks.find((t) => t.id === LOCK_ID) || null;
  }

  function bindControls() {
    MEDIA_EVENTS.forEach((type) => audio.addEventListener(type, onMediaEvent));
    audio.addEventListener("timeupdate", renderStats);
    audio.addEventListener("progress", renderStats);
    LOCK_EVENTS.forEach((type) => lockAudio.addEventListener(type, onLockEvent));
    $("play").addEventListener("click", togglePlay);
    $("play-away").addEventListener("click", onLockPlay);
    document.querySelectorAll("[data-answer]").forEach((b) => {
      b.addEventListener("click", () => {
        const entry = currentEntry();
        const id = b.dataset.scope === "lock" ? LOCK_ID : entry && entry.id;
        if (id) {
          setResult(id, b.dataset.answer, { r: b.dataset.value });
          render();
        }
      });
    });
    $("away-restart").addEventListener("click", restartAway);
    $("next").addEventListener("click", goNext);
    $("redo").addEventListener("click", redoFormat);
    $("mode").addEventListener("change", startTrack);
    $("links-save").addEventListener("click", onSaveLinks);
    $("links-clear").addEventListener("click", onClearLinks);
    $("links-change").addEventListener("click", () => {
      state.editingLinks = true;
      render();
    });
    $("links-close").addEventListener("click", () => {
      state.editingLinks = false;
      render();
    });
    $("expired-paste").addEventListener("click", () => {
      state.editingLinks = true;
      render();
      $("links-card").scrollIntoView({ block: "start", behavior: "smooth" });
      $("links-input").focus();
    });
    $("copy").addEventListener("click", () => copyText(buildMarkdown(), "copy-out", "copy-status"));
    $("copy-log").addEventListener("click", () => copyText(buildLogMarkdown(), "copy-log-out", "copy-log-status"));
    $("start-over").addEventListener("click", startOver);
    $("clear-log").addEventListener("click", clearLog);
    $("debug").addEventListener("toggle", render);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        onHidden();
      } else {
        onVisible();
      }
    });
    ["pagehide", "pageshow", "freeze", "resume", "online", "offline"].forEach((type) => {
      window.addEventListener(type, () => addPageEvent("page " + type));
      document.addEventListener(type, () => addPageEvent("page " + type));
    });
    // The lock test saves timeupdates every few seconds; a page about to be
    // frozen or closed saves the last ones now.
    const flushLock = () => {
      if (activeLock()) {
        saveStore();
      }
    };
    window.addEventListener("pagehide", flushLock);
    document.addEventListener("freeze", flushLock);
    setInterval(tick, TICK_MS);
  }

  function waitForControl(reg) {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve("already controlled");
    }
    return new Promise((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve("controllerchange"), { once: true });
      // After a hard reload the worker is active but this page is not
      // controlled, and no new activate will claim it; ask for a claim.
      if (reg.active) {
        reg.active.postMessage({ type: "claim" });
      }
    });
  }

  function failSetup(message) {
    state.setupError = message;
    setStatus(message, "bad");
    render();
    if (AUTO) {
      autoFail(message);
    }
  }

  async function main() {
    if (!LM) {
      $("banner-setup").hidden = false;
      $("banner-setup").textContent = "The page's lock-math.js did not load, so the test cannot run. Reload the page.";
      return;
    }
    // Set once, before any track loads. Setting the value fires no "change",
    // so this starts no session of its own.
    if (RESPOND) {
      $("mode").value = RESPOND;
    }
    const fragmentLinks = takeFragmentLinks();
    loadStore();
    buildJumps();
    bindControls();
    $("ua").textContent = `${navigator.userAgent} (read as ${device.browser} ${device.version}, ${device.os}, ${device.family})`;
    refineOsVersion();
    recoverLock();
    if (AUTO) {
      const pre = $("auto-results");
      pre.dataset.state = "waiting";
    }
    render();
    if (!("serviceWorker" in navigator)) {
      failSetup("This browser has no service worker support here (a private window?), so the test cannot run. Open the page in a normal window.");
      return;
    }
    if (!window.caches) {
      failSetup("This browser blocks Cache Storage here (a private window?), so the test cannot run. Open the page in a normal window.");
      return;
    }
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    if (navigator.serviceWorker.startMessages) {
      navigator.serviceWorker.startMessages();
    }
    try {
      await loadSources();
      buildChips();
      chooseInitialFormat();
      if (fragmentLinks !== null) {
        const imported = await saveLinkText(fragmentLinks);
        $("links-status").textContent = `Saved ${plural(imported.saved, "link")} from the address.`;
      } else {
        await refreshLinks();
      }
      setStatus("Registering /spike/sw.js with scope /spike/ …");
      const reg = await navigator.serviceWorker.register("/spike/sw.js", { scope: "/spike/", updateViaCache: "none" });
      setStatus("Registered. Waiting for navigator.serviceWorker.ready …");
      await navigator.serviceWorker.ready;
      setStatus("Ready. Waiting for the worker to control this page …");
      const how = await waitForControl(reg);
      state.controlled = true;
      setStatus(`Controlled (${how}).`, "ok");
      navigator.serviceWorker.addEventListener("controllerchange", () => addEvent("controllerchange", "a new worker version took over"));
      navigator.serviceWorker.controller.postMessage({ type: "ping" });
      startTrack();
      await loadStoredLog();
      maybeFinishLock();
      render();
    } catch (err) {
      failSetup("Setup failed: " + errText(err));
      return;
    }
    if (AUTO) {
      autoRun();
    }
  }

  main();
})();
