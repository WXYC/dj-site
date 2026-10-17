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

  const query = new URLSearchParams(location.search);
  const AUTO = query.get("auto") === "1";
  const AUTO_DWELL_S = boundedNumber(query.get("dwell"), 5, 300, 20);
  const AUTO_FORMATS = (query.get("formats") || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const device = detectDevice(navigator.userAgent);
  const state = {
    sources: [],
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
    loop: false,
    lockNotice: "",
    lockEvaluating: false,
    auto: null,
    resultsSig: "",
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
        }
      }
    } catch (e) {
      store.note = "This browser will not keep the results if the page reloads (its storage is blocked).";
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
    const away =
      !awayApplies() ||
      (isDecided(f.awayPast) &&
        isDecided(f.awayWorker) &&
        isAnswered(f.awayHeard) &&
        (device.family !== "ios" || isAnswered(f.lockScreen)));
    return { play, jump, ahead, away, done: play && jump && ahead && away };
  }

  // ---- the element ---------------------------------------------------------

  function readAhead() {
    const t = audio.currentTime;
    const b = audio.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + 0.05 && t <= b.end(i)) {
        return b.end(i) - t;
      }
    }
    return 0;
  }

  function isBuffered(t) {
    const b = audio.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t && t < b.end(i)) {
        return true;
      }
    }
    return false;
  }

  function allLoaded() {
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) {
      return false;
    }
    const b = audio.buffered;
    let total = 0;
    for (let i = 0; i < b.length; i++) {
      total += b.end(i) - b.start(i);
    }
    return total >= d - 1;
  }

  function bufferedText() {
    const b = audio.buffered;
    const parts = [];
    for (let i = 0; i < b.length; i++) {
      parts.push(`${b.start(i).toFixed(2)}-${b.end(i).toFixed(2)}`);
    }
    return parts.length ? parts.join(", ") + " s" : "(none)";
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

  function positionText() {
    const d = Number.isFinite(audio.duration) ? mmss(audio.duration) : "…";
    return `Position ${mmss(audio.currentTime)} of ${d}`;
  }

  function setMediaSession(entry) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Spike: " + entry.label,
      artist: "WXYC service-worker spike",
      album: "Generated marker tones",
    });
  }

  async function playAudio() {
    try {
      await audio.play();
      return { ok: true };
    } catch (err) {
      addEvent("play refused", `${err && err.name ? err.name : ""} ${errText(err)}`.trim());
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
    $("events").textContent = "";
    const q = new URLSearchParams({ load: LOAD_ID, session: String(session.n), respond: session.mode });
    if (entry.kbps) {
      q.set("kbps", String(entry.kbps));
    }
    audio.loop = state.loop;
    if (AUTO) {
      // Muted playback may start without a tap, and the run must make no sound.
      audio.muted = true;
    }
    audio.src = `/spike/audio/${encodeURIComponent(entry.id)}?${q}`;
    audio.load();
    setMediaSession(entry);
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

  function addEvent(type, detail) {
    const s = state.current;
    if (!s) {
      return;
    }
    const ev = { at: Date.now(), type, ct: audio.currentTime, ahead: readAhead(), detail: detail || "" };
    s.events.push(ev);
    const li = document.createElement("li");
    li.textContent = eventLine(s, ev);
    $("events").appendChild(li);
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

  // ---- the background and lock test ----------------------------------------

  function awayDecided(f) {
    return isDecided(f.awayPast) && isDecided(f.awayWorker);
  }

  function onHidden() {
    addEvent("page hidden");
    const entry = currentEntry();
    if (AUTO || !awayApplies() || !entry || !state.controlled) {
      return;
    }
    const now = Date.now();
    const lock = store.data.lock;
    if (lock && lock.format === entry.id && lock.phase === "back") {
      lock.spans.push({ from: now, to: null });
      lock.phase = "away";
      saveStore();
      return;
    }
    if (!state.loop || audio.paused || awayDecided(readFormat(entry.id))) {
      return;
    }
    state.lockNotice = "";
    // Written synchronously: the browser may freeze or discard the page at
    // any moment from here on, and timers stop while the phone is locked.
    store.data.lock = {
      format: entry.id,
      phase: "away",
      firstHiddenAt: now,
      endAt: null,
      spans: [{ from: now, to: null }],
      aheadAtHide: readAhead(),
      ctAtHide: audio.currentTime,
      allLoaded: allLoaded(),
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      returnState: null,
      reloaded: false,
      expired: false,
    };
    saveStore();
  }

  function onVisible() {
    addEvent("page visible");
    const lock = store.data.lock;
    if (lock && lock.phase === "away") {
      const now = Date.now();
      lock.spans[lock.spans.length - 1].to = now;
      lock.returnState = { paused: audio.paused, ct: audio.currentTime, readyState: audio.readyState };
      if (now - lock.firstHiddenAt >= AWAY_MS) {
        lock.endAt = now;
        lock.phase = "evaluating";
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
      lock.phase = "evaluating";
      saveStore();
    } else if (lock.phase === "back") {
      store.data.lock = null;
      state.lockNotice = "The page reloaded, so the test stopped. Turn on Loop, press play, and leave the page again.";
      saveStore();
    }
  }

  function maybeFinishLock() {
    const lock = store.data.lock;
    if (!lock || state.lockEvaluating || !state.controlled) {
      return;
    }
    if (lock.phase === "back" && Date.now() - lock.firstHiddenAt >= AWAY_MS) {
      lock.endAt = Date.now();
      lock.phase = "evaluating";
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
   * Decides the two automatic away checks from the worker's stored records.
   * Playback went on past what was loaded if the worker was still answering
   * the player after that loaded audio would have run out.
   */
  function evaluateLock(lock) {
    const from = lock.firstHiddenAt;
    const to = lock.endAt || Date.now();
    const recs = [...state.allRecords.values()]
      .filter((r) => r.track === lock.format && recAt(r) >= from && recAt(r) <= to)
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
    const measures = { awayS: round1(awayS), loadedS: round1(loaded), answers: ok.length, failed: bad.length, lastAnswerS: round1(lastOkS), workerIds: instances, reloaded: !!lock.reloaded };

    let worker;
    if (ok.length) {
      worker = Object.assign({ r: "pass", note: facts }, measures);
    } else if (lock.allLoaded) {
      worker = Object.assign({ r: "cant", why: "Everything was already loaded before you left, so this run can't tell.", note: "everything was loaded before you left; " + facts }, measures);
    } else {
      worker = Object.assign({ r: "fail", why: "The worker answered nothing while you were away.", note: facts }, measures);
    }

    let past;
    if (lock.allLoaded) {
      past = Object.assign({ r: "cant", why: "Everything was already loaded before you left, so this run can't tell.", note: "everything was loaded before you left; " + facts }, measures);
    } else if (lastOkS !== null && lastOkS >= loaded) {
      past = Object.assign({ r: "pass", note: facts }, measures);
    } else if (awayS > loaded + 30) {
      past = Object.assign({ r: "fail", why: "Playback did not get past what was loaded when you left.", note: facts }, measures);
    } else {
      past = Object.assign({ r: "cant", why: "You were not away long enough to use up what was loaded.", note: facts }, measures);
    }
    setResult(lock.format, "awayPast", past);
    setResult(lock.format, "awayWorker", worker);
  }

  function restartAway() {
    const entry = currentEntry();
    if (!entry) {
      return;
    }
    store.data.lock = null;
    state.lockNotice = "";
    clearResults(entry.id, ["awayPast", "awayWorker", "awayHeard", "lockScreen"]);
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
      const hit = state.sources.find((t) => t.file && path.endsWith("/" + t.file));
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
      if (!id || !state.sources.some((t) => t.id === id) || checkUrl(m[2])) {
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
    for (const entry of state.sources) {
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
      if (state.linkIds.size === state.sources.length) {
        state.editingLinks = false;
      }
      startTrack();
    } else {
      $("links-status").textContent = "No links found. Paste the lines that start with mp3, m4a, flac or wav.";
    }
    render();
  }

  async function onClearLinks() {
    if (!window.confirm("Remove the saved track links from this browser?")) {
      return;
    }
    for (const entry of state.sources) {
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
    const rows = [
      { label: "First request through the worker", cell: (f) => cellMark(f.first) },
      { label: "Plays", cell: (f) => cellMark(f.plays) },
      { label: "Asks for the next piece", cell: (f) => cellMark(f.next) },
      { label: "Jumps (10%, 50%, 90%, start)", cell: jumpsCell },
      { label: "Right spot (you)", cell: (f) => cellMark(f.spot) },
      { label: "Loaded ahead, playing", cell: (f) => (f.aheadSteady ? { t: `${Math.round(f.aheadSteady.s)} s`, r: "value" } : { t: "–", r: "pending" }) },
      { label: "Loaded ahead, after a jump", cell: (f) => (f.aheadJump ? { t: `${Math.round(f.aheadJump.s)} s`, r: "value" } : { t: "–", r: "pending" }) },
    ];
    if (awayApplies()) {
      rows.push({ label: "Went on past what was loaded (away)", cell: (f) => cellMark(f.awayPast) });
      rows.push({ label: "Worker answered while away", cell: (f) => cellMark(f.awayWorker) });
      rows.push({ label: "Played the whole time (you)", cell: (f) => cellMark(f.awayHeard) });
      if (device.family === "ios") {
        rows.push({ label: "Lock Screen controls (you)", cell: (f) => cellMark(f.lockScreen) });
      }
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

  const awayWord = (v) => (awayApplies() ? word(v) : "n/a");

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
      "| Browser | Version | OS | Format | First request through the worker | Plays | Asks for the next piece | Jumps 10% / 50% / 90% / start | Right spot (heard) | Read-ahead playing (s) | Read-ahead after a jump (s) | Away: went on past what was loaded | Away: worker answered | Away: played the whole time (heard) | Lock Screen controls (heard) |"
    );
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const entry of state.sources) {
      const f = readFormat(entry.id);
      const format = entry.format + (f.mode === "rebuilt" ? " (rebuilt response)" : "");
      const steady = f.aheadSteady ? `${Math.round(f.aheadSteady.s)} (max ${Math.round(f.aheadSteady.max)})` : "not yet";
      const after = f.aheadJump ? String(Math.round(f.aheadJump.s)) : "not yet";
      const lockScreen = device.family === "ios" ? word(f.lockScreen) : "n/a";
      const cells = [
        device.browser, device.version, device.os, format, word(f.first), word(f.plays), word(f.next),
        JUMPS.map((j) => word(f[j.key])).join(" / "), word(f.spot), steady, after,
        awayWord(f.awayPast), awayWord(f.awayWorker), awayWord(f.awayHeard), lockScreen,
      ];
      lines.push(`| ${cells.map(md).join(" | ")} |`);
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
    const names = { first: "first request", plays: "plays", next: "next piece", awayPast: "away, past what was loaded", awayWorker: "away, worker" };
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
    if (store.data.lock && store.data.lock.format === entry.id) {
      store.data.lock = null;
    }
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
      $("results-card").scrollIntoView({ block: "start", behavior: "smooth" });
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
    if (awayApplies()) {
      if (!isDecided(f.awayPast)) {
        setResult(id, "awayPast", { r: "skip" });
      }
      if (!isDecided(f.awayWorker)) {
        setResult(id, "awayWorker", { r: "skip" });
      }
      if (!isAnswered(f.awayHeard)) {
        setResult(id, "awayHeard", { r: "auto" });
      }
      if (device.family === "ios" && !isAnswered(f.lockScreen)) {
        setResult(id, "lockScreen", { r: "auto" });
      }
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
        background: awayApplies()
          ? {
              wentOnPastLoaded: word(f.awayPast),
              workerAnsweredWhileAway: word(f.awayWorker),
              playedWholeTime: word(f.awayHeard),
              lockScreenControls: device.family === "ios" ? word(f.lockScreen) : "n/a",
            }
          : "n/a",
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
    const total = state.sources.length;
    const count = state.linkIds.size;
    const complete = state.linksLoaded && total > 0 && count === total;
    const showForm = state.linksLoaded && (!complete || state.editingLinks || state.linkExpired);
    $("links-card").hidden = !state.linksLoaded;
    $("links-line").hidden = !complete || showForm;
    $("links-form").hidden = !showForm;
    $("links-close").hidden = !complete;
    $("links-count").textContent = `Links: ${count} of ${total} saved`;
    $("links-each").textContent = state.sources.map((t) => `${t.id.toUpperCase()} ${hasLink(t.id) ? "saved" : "missing"}`).join(" · ");
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
    const st = entry ? stepState(entry.id) : { play: false, jump: false, ahead: false, away: false, done: false };
    const order = ["play", "jump", "ahead"];
    if (awayApplies()) {
      order.push("away");
    }
    const current = order.find((k) => !st[k]) || "next";
    $("step-away").hidden = !awayApplies();
    let n = 0;
    for (const key of ["pick", "play", "jump", "ahead", "away", "next"]) {
      const el = $("step-" + key);
      if (el.hidden) {
        continue;
      }
      n += 1;
      const done = key === "pick" ? !!entry : key === "next" ? false : !!st[key];
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

    renderAway(entry, f, usable);

    // Next format
    const nextId = nextFormatId();
    const nextEntry = state.sources.find((t) => t.id === nextId);
    let nextText = "Finish the steps above first, or move on and come back to this format later.";
    if (!nextId || (entry && nextId === entry.id && st.done)) {
      nextText = "All four formats are done in this browser. Copy the results below and post them on dj-site#2148.";
      $("next").textContent = "Go to the results";
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

  function renderAway(entry, f, usable) {
    if (!awayApplies()) {
      return;
    }
    const ios = device.family === "ios";
    $("away-title").textContent = ios ? `Lock the ${device.deviceName} for 15 minutes` : "Leave the tab in the background for 15 minutes";
    $("away-how").textContent = ios
      ? `Switch to another app, then lock the ${device.deviceName}. Leave it for 15 minutes. Before you unlock, press pause and then play on the Lock Screen. Then unlock and come back to this page.`
      : "Switch to another tab, then minimize this window (the yellow button at the top left). Leave it for 15 minutes. Then bring the window back and come back to this tab.";
    const loop = $("loop");
    loop.setAttribute("aria-pressed", String(state.loop));
    loop.textContent = state.loop ? "Loop is on" : "Turn on Loop";
    loop.disabled = !usable;
    const playAway = $("play-away");
    playAway.disabled = !usable;
    playAway.textContent = audio.paused ? "Play" : "Pause";

    const lock = store.data.lock && entry && store.data.lock.format === entry.id ? store.data.lock : null;
    const decided = awayDecided(f);
    $("away-countdown").textContent = countdownText(lock, decided, ios);
    const checking = lock && lock.phase !== "done" ? "checking" : null;
    setCheck("check-away-past", f.awayPast, checking);
    setCheck("check-away-worker", f.awayWorker, checking);
    const canAnswer = usable && (decided || (!!lock && lock.phase === "done"));
    renderAnswers("awayHeard", f, canAnswer);
    renderAnswers("lockScreen", f, canAnswer);
    $("q-lockscreen").hidden = !ios;
    $("away-restart").hidden = !lock && !decided && !isAnswered(f.awayHeard);
  }

  function countdownText(lock, decided, ios) {
    const now = Date.now();
    if (state.lockNotice) {
      return state.lockNotice;
    }
    if (!lock) {
      if (decided) {
        return "";
      }
      if (state.loop && !audio.paused) {
        return "Ready. The 15:00 starts when you leave this page.";
      }
      return "The 15:00 starts when you leave this page, once Loop is on and the audio is playing.";
    }
    if (lock.phase === "away") {
      return "Away…";
    }
    if (lock.phase === "back") {
      const left = AWAY_MS - (now - lock.firstHiddenAt);
      return `${mmss(left / 1000)} to go. Leave this page again${ios ? ` and lock the ${device.deviceName}` : ""}; the clock keeps running.`;
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
    const rows = resultRows();
    const cells = rows.map((row) => state.sources.map((entry) => row.cell(readFormat(entry.id))));
    const sig = JSON.stringify([state.sources.map((t) => t.id), rows.map((r) => r.label), cells]);
    $("results-who").textContent = `${device.browser} ${device.version} · ${device.os}`;
    const hint = $("os-hint");
    hint.hidden = device.osKnown;
    hint.textContent = device.osKnown ? "" : `${device.browser} does not report the ${device.os} version, so add it to the comment by hand${device.family === "mac-safari" || device.deviceName === "Mac" ? " (Apple menu, About This Mac)" : ""}.`;
    const note = $("store-note");
    note.hidden = !store.note;
    note.textContent = store.note;
    if (sig === state.resultsSig) {
      return;
    }
    state.resultsSig = sig;
    const table = $("results");
    const head = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "Check";
    head.appendChild(corner);
    state.sources.forEach((entry) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = entry.id.toUpperCase();
      head.appendChild(th);
    });
    table.tHead.textContent = "";
    table.tHead.appendChild(head);
    const body = table.tBodies[0];
    body.textContent = "";
    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = row.label;
      tr.appendChild(th);
      cells[i].forEach((c, k) => {
        const td = document.createElement("td");
        td.textContent = c.t;
        td.dataset.result = c.r;
        td.dataset.format = state.sources[k].id;
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
    const s = state.current;
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
    state.sources = json.tracks || [];
  }

  function bindControls() {
    MEDIA_EVENTS.forEach((type) => audio.addEventListener(type, onMediaEvent));
    audio.addEventListener("timeupdate", renderStats);
    audio.addEventListener("progress", renderStats);
    $("play").addEventListener("click", togglePlay);
    $("play-away").addEventListener("click", togglePlay);
    $("loop").addEventListener("click", () => {
      state.loop = !state.loop;
      audio.loop = state.loop;
      addEvent("loop " + (state.loop ? "on" : "off"));
      render();
    });
    document.querySelectorAll("[data-answer]").forEach((b) => {
      b.addEventListener("click", () => {
        const entry = currentEntry();
        if (entry) {
          setResult(entry.id, b.dataset.answer, { r: b.dataset.value });
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
      window.addEventListener(type, () => addEvent("page " + type));
      document.addEventListener(type, () => addEvent("page " + type));
    });
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
