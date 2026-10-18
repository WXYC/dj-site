/*
 * The one-tap phone lock test. Throwaway; this branch never merges. See
 * spike/README.md, "The phone test".
 *
 * The tester pastes a link from the Mac, taps Start and locks the phone.
 * While it is locked the page makes a test jump past what is buffered once
 * it has been hidden 5 minutes, and pauses the audio once it has been
 * hidden 15 minutes in all; both are decided on timeupdate, which fires in
 * the background while audio plays, because timers stop while a phone is
 * locked. On return it shows the verdict. The page and the worker each
 * upload what they recorded to S3 through presigned PUT links from the URL
 * fragment, so nothing needs copying.
 *
 * The fragment, #k=<payload>, holds the links (see phone-math.js). They are
 * credentials: the page keeps them in memory and sessionStorage only, takes
 * the fragment out of the address at once, and never puts a link into an
 * upload, an event or the screen.
 *
 * Test-only query parameters, for a simulator on a local server:
 *   jumpAfter=<s>, endAfter=<s>  hidden seconds before the jump and the end (300 and 900);
 *   autostart=1                  start without a tap, muted;
 *   fakeHidden=1                 count the page as hidden from Start to the end, so a
 *                                muted run in the foreground takes the locked path;
 *   muted=1                      Start plays muted.
 *
 * Plain script with no build step; lock-math.js and phone-math.js load first.
 */
"use strict";

(() => {
  const PAGE_VERSION = "phone-1";
  const WORKER_VERSION = "phone-1";
  const RUN_KEY = "spike-phone-run-v1";
  const PAYLOAD_KEY = "spike-phone-payload";
  const RELOADED_KEY = "spike-phone-worker-reload";
  const OVERRIDE_CACHE = "spike-url-overrides";
  const LOG_CACHE = "spike-request-log";
  const LOCK_ID = "lock";
  const LOCK_KBPS = 1411;
  const UPLOAD_EVERY_MS = 60 * 1000;
  const TU_EVERY_MS = 1000;
  const SAVE_EVERY_MS = 2000;
  const STALLED_MS = 10 * 1000;
  const ANSWER_MS = 3000;
  const CONTROL_MS = 15 * 1000;
  const FAKE_LOCK_DELAY_MS = 2000;
  const RETURN_CHECK_MS = 2000;
  const MEDIA_EVENTS = [
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "play", "playing", "pause",
    "waiting", "stalled", "suspend", "seeking", "seeked", "ended", "error", "emptied", "abort", "timeupdate", "ratechange",
  ];
  const LM = window.SpikeLockMath;
  const PM = window.SpikePhoneMath;
  const LOAD_ID = Math.random().toString(36).slice(2, 8);
  const PAGE_STARTED = Date.now();

  const query = new URLSearchParams(location.search);
  const JUMP_AFTER_MS = bounded(query.get("jumpAfter"), 5, 3600, 300) * 1000;
  const END_AFTER_MS = bounded(query.get("endAfter"), 10, 7200, 900) * 1000;
  const RESPOND = query.get("respond") === "direct" ? "direct" : "rebuilt";
  const AUTOSTART = query.get("autostart") === "1";
  const FAKE_HIDDEN = query.get("fakeHidden") === "1";
  const MUTED = AUTOSTART || query.get("muted") === "1";

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const finite = Number.isFinite;
  const round1 = (n) => (finite(n) ? Math.round(n * 10) / 10 : null);
  const round3 = (n) => (finite(n) ? Math.round(n * 1000) / 1000 : null);
  const errText = (err) => (err && err.message ? err.message : String(err));
  const minutes = PM ? PM.fmtDuration(END_AFTER_MS) : "";

  const state = {
    payload: null, // { run, expiresAt, links: { t, p, w } }: the links never leave memory and sessionStorage
    badLink: "",
    setupError: "",
    ready: false,
    worker: null, // the controlling worker's pong: { instance, startedAt, version }
    workerAck: false,
    records: new Map(), // this run's worker records, by id
    workerUploads: [],
    handlers: [],
    lockAction: null,
    testJumpPending: false,
    fakeHidden: false,
    lastProgressAt: 0,
    lastCt: 0,
    savedAt: 0,
    lastUploadAt: null,
    upload: { seq: 0, inFlight: false, ok: 0, failed: 0, lastOkAt: null, lastError: "", sentFinal: false },
    chain: Promise.resolve(),
    early: null,
    notice: "",
    storageNote: "",
    waiters: { pong: null, ack: null },
  };
  let run = null;

  function bounded(text, min, max, fallback) {
    const n = Number(text);
    if (text === null || text === "" || !Number.isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, n));
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---- the run, kept in localStorage ---------------------------------------

  function newRun(id) {
    return {
      v: 1,
      run: id,
      phase: "ready",
      reason: null,
      load: LOAD_ID,
      startedAt: null,
      firstHiddenAt: null,
      ctAtHide: null,
      aheadAtHide: null,
      allLoadedAtHide: false,
      bufferedAtHide: [],
      duration: null,
      spans: [],
      events: [],
      jump: null,
      endAt: null,
      endCt: null,
      reloadedAt: null,
      returns: [],
      result: null,
      shownAt: null,
    };
  }

  function loadRun(id) {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(RUN_KEY) || "null");
    } catch (e) {
      stored = null;
    }
    if (stored && stored.v === 1 && (id === null || stored.run === id)) {
      return stored;
    }
    return id === null ? null : newRun(id);
  }

  function save() {
    state.savedAt = Date.now();
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch (e) {
      state.storageNote = "This browser would not store the run (" + errText(e) + "), so a reload loses it.";
    }
  }

  /** Each event at once, timeupdates about once a second; saved at once except timeupdates, every two seconds. */
  function recordEvent(rec, force) {
    const events = run.events;
    const last = events[events.length - 1];
    if (!force && rec.type === "timeupdate" && last && last.type === "timeupdate" && rec.at - last.at < TU_EVERY_MS) {
      return;
    }
    events.push(rec);
    if (rec.type !== "timeupdate" || Date.now() - state.savedAt >= SAVE_EVERY_MS) {
      save();
    }
  }

  /** A run that was playing when the page loaded: the browser reloaded the page, or closed it and opened it again. */
  function recover() {
    if (!run || run.phase !== "playing") {
      return;
    }
    if (!finite(run.firstHiddenAt)) {
      run = newRun(run.run);
      state.notice = "The page reloaded before the phone was locked. Tap Start to begin again.";
      save();
      return;
    }
    const open = run.spans[run.spans.length - 1];
    if (open && open.to === null) {
      open.to = PAGE_STARTED;
    }
    run.events.push({ type: "reloaded", at: PAGE_STARTED });
    Object.assign(run, { reason: "reloaded", reloadedAt: PAGE_STARTED, endAt: PAGE_STARTED, endCt: null, phase: "ended" });
    save();
  }

  // ---- the link payload ------------------------------------------------------

  /** Reads #k=, takes it out of the address at once, and keeps it for this tab (a reload needs it again). */
  function takePayload() {
    const hash = location.hash || "";
    let text = null;
    let fromFragment = false;
    if (hash.startsWith("#k=")) {
      text = hash.slice(3);
      fromFragment = true;
      try {
        history.replaceState(history.state, "", location.pathname + location.search);
      } catch (e) {
        // An address bar that keeps the fragment is no worse than before.
      }
    } else {
      try {
        text = sessionStorage.getItem(PAYLOAD_KEY);
      } catch (e) {
        text = null;
      }
    }
    if (!text) {
      return null;
    }
    let payload;
    try {
      payload = PM.unpackLinks(text);
    } catch (e) {
      state.badLink = errText(e);
      return null;
    }
    if (!payload.run || !["t", "p", "w"].every((k) => payload.links[k] && payload.links[k].url)) {
      state.badLink = "It lacks its run id or one of its three links.";
      return null;
    }
    if (fromFragment) {
      try {
        sessionStorage.setItem(PAYLOAD_KEY, text);
      } catch (e) {
        state.storageNote = "This browser would not keep the links for this tab, so a reload loses them.";
      }
    }
    return payload;
  }

  const expiresAtMs = () => (state.payload && finite(state.payload.expiresAt) ? state.payload.expiresAt * 1000 : null);
  const shortTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // ---- the worker ------------------------------------------------------------

  function onWorkerMessage(e) {
    const data = e.data || {};
    if (data.type === "pong" && state.waiters.pong) {
      state.waiters.pong(data);
    } else if (data.type === "phone-ack" && state.waiters.ack && run && data.run === run.run) {
      state.waiters.ack(data);
    } else if (data.type === "record" && run && data.record && data.record.run === run.run) {
      upsertRecord(data.record);
    } else if (data.type === "worker-upload" && run && data.run === run.run && data.upload) {
      state.workerUploads.push(data.upload);
      if (state.workerUploads.length > 200) {
        state.workerUploads.shift();
      }
    }
  }

  function upsertRecord(rec) {
    if (!rec || !rec.id) {
      return;
    }
    const prev = state.records.get(rec.id);
    state.records.set(rec.id, prev ? Object.assign(prev, rec) : rec);
  }

  /** Asks the controlling worker something and waits up to ANSWER_MS for its answer (null if none). */
  function ask(kind, message) {
    return new Promise((resolve) => {
      const c = navigator.serviceWorker.controller;
      if (!c) {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => {
        state.waiters[kind] = null;
        resolve(null);
      }, ANSWER_MS);
      state.waiters[kind] = (data) => {
        clearTimeout(timer);
        state.waiters[kind] = null;
        resolve(data);
      };
      c.postMessage(message);
    });
  }

  function waitForControl(reg) {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), CONTROL_MS);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true }
      );
      // After a hard reload the worker is active but this page is not
      // controlled, and no new activate will claim it; ask for a claim.
      if (reg.active) {
        reg.active.postMessage({ type: "claim" });
      }
    });
  }

  /**
   * Registers the worker, waits until it controls the page, and makes sure it
   * is this page's version: a worker from an earlier visit is replaced by the
   * new one (it skips waiting and claims the page), and if it is not, the
   * page reloads once. Returns false when it reloads.
   */
  async function setUpWorker() {
    const sw = navigator.serviceWorker;
    const reg = await sw.register("/spike/sw.js", { scope: "/spike/", updateViaCache: "none" });
    await sw.ready;
    if (!(await waitForControl(reg))) {
      throw new Error("the worker did not take control of the page within 15 seconds");
    }
    let pong = await ask("pong", { type: "ping" });
    if (!pong || pong.version !== WORKER_VERSION) {
      try {
        await reg.update();
      } catch (e) {
        // The check fails offline; the version test below decides.
      }
      const until = Date.now() + CONTROL_MS;
      while ((!pong || pong.version !== WORKER_VERSION) && Date.now() < until) {
        await sleep(500);
        pong = await ask("pong", { type: "ping" });
      }
    }
    if (!pong || pong.version !== WORKER_VERSION) {
      let reloaded = null;
      try {
        reloaded = sessionStorage.getItem(RELOADED_KEY);
      } catch (e) {
        reloaded = "1";
      }
      if (!reloaded) {
        sessionStorage.setItem(RELOADED_KEY, "1");
        location.reload();
        return false;
      }
      throw new Error(`the worker is ${pong ? `version ${pong.version || "(none)"}` : "not answering"}, not ${WORKER_VERSION}`);
    }
    try {
      sessionStorage.removeItem(RELOADED_KEY);
    } catch (e) {
      // Nothing to remove.
    }
    state.worker = { instance: pong.instance, startedAt: pong.startedAt, version: pong.version };
    return true;
  }

  /** Gives the worker the lock track's link (as the guided page's saved links do) and its own upload link. */
  async function configureWorker() {
    const cache = await caches.open(OVERRIDE_CACHE);
    await cache.put(
      `/spike/url/${LOCK_ID}.json`,
      new Response(JSON.stringify({ url: state.payload.links.t.url }), { headers: { "Content-Type": "application/json" } })
    );
    const ack = await ask("ack", { type: "phone", run: run.run, url: state.payload.links.w.url });
    state.workerAck = !!ack;
  }

  function flushWorker(reason) {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (c && state.payload) {
      c.postMessage({ type: "flush", reason });
    }
  }

  /** The worker stores every record in Cache Storage as well as posting it, so a page that slept catches up. */
  async function loadStoredLog() {
    if (!window.caches || !run) {
      return;
    }
    try {
      const cache = await caches.open(LOG_CACHE);
      for (const key of await cache.keys()) {
        const res = await cache.match(key);
        const rec = res ? await res.json() : null;
        if (rec && rec.run === run.run) {
          upsertRecord(rec);
        }
      }
    } catch (err) {
      state.storageNote = "The worker's stored log could not be read: " + errText(err);
    }
  }

  const workerRecords = () => [...state.records.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  function normalized() {
    return workerRecords().map((r) => ({
      at: Date.parse(r.at),
      asked: r.asked,
      status: r.status,
      error: r.error || "",
      aborted: !!r.aborted,
      contentRange: r.contentRange || "",
      delivered: r.delivered,
      instance: r.instance,
    }));
  }

  // ---- the element -------------------------------------------------------------

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
    if (!finite(d) || d <= 0) {
      return false;
    }
    const b = audio.buffered;
    let total = 0;
    for (let i = 0; i < b.length; i++) {
      total += b.end(i) - b.start(i);
    }
    return total >= d - 1;
  }

  function bufferedRanges() {
    const b = audio.buffered;
    const out = [];
    for (let i = 0; i < b.length; i++) {
      out.push([round1(b.start(i)), round1(b.end(i))]);
    }
    return out;
  }

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

  const isHidden = () => (FAKE_HIDDEN ? state.fakeHidden : document.visibilityState === "hidden");

  /** Playing now: not paused, and either enough data or a position that moved in the last 10 s. */
  function isMoving(now) {
    return !audio.paused && !audio.ended && (audio.readyState >= 3 || now - state.lastProgressAt < STALLED_MS);
  }

  /**
   * isMoving, or failing that whether the position moves in the next two
   * seconds: a page whose script slept while locked has heard no recent
   * timeupdate although the audio plays on.
   */
  async function movingOnReturn(now) {
    if (isMoving(now)) {
      return true;
    }
    const ct = audio.currentTime;
    await sleep(RETURN_CHECK_MS);
    return !audio.paused && !audio.ended && audio.currentTime > ct + 0.5;
  }

  function setUpMediaSession() {
    const ms = navigator.mediaSession;
    if (!ms) {
      return;
    }
    if (typeof MediaMetadata !== "undefined") {
      ms.metadata = new MediaMetadata({
        title: "Lock test: leave the phone locked",
        artist: "WXYC service-worker spike",
        album: `The sound stops by itself after ${minutes}`,
      });
    }
    state.handlers = [];
    for (const action of ["play", "pause"]) {
      try {
        ms.setActionHandler(action, () => onLockAction(action));
        state.handlers.push(action);
      } catch (e) {
        // An action this browser does not support.
      }
    }
    // No scrubbing: the page makes its own test jump.
    for (const action of ["seekto", "seekforward", "seekbackward", "previoustrack", "nexttrack"]) {
      try {
        ms.setActionHandler(action, null);
      } catch (e) {
        // An action this browser does not support.
      }
    }
  }

  function updatePositionState() {
    const ms = navigator.mediaSession;
    const d = audio.duration;
    if (!ms || typeof ms.setPositionState !== "function" || !finite(d) || d <= 0) {
      return;
    }
    try {
      ms.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(d, Math.max(0, audio.currentTime)) });
    } catch (e) {
      // A state the browser rejects; the Lock Screen keeps its own.
    }
  }

  /** A Lock Screen play or pause. Nothing asks the tester for one, but a pause the tester made is theirs. */
  function onLockAction(action) {
    const at = Date.now();
    state.lockAction = { action, at };
    if (run && run.phase === "playing") {
      recordEvent({ type: "action", action, at, ct: round3(audio.currentTime) }, true);
    }
    if (action === "play") {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function onMediaEvent(e) {
    if (!run || run.phase !== "playing") {
      return;
    }
    const type = e.type;
    const at = eventWallTime(e);
    const ct = audio.currentTime;
    const rec = { type, at, ct: round3(ct) };
    if (type === "timeupdate") {
      if (ct > state.lastCt + 0.01) {
        state.lastProgressAt = Date.now();
      }
      state.lastCt = ct;
      recordEvent(rec, false);
      tick(Date.now());
      return;
    }
    if (type === "seeking") {
      const hidden = isHidden();
      const test = state.testJumpPending;
      state.testJumpPending = false;
      // The page's own test jump is its own; any other seek while hidden is the player's.
      Object.assign(rec, { target: rec.ct, hidden, inBuffer: isBuffered(ct), buffered: bufferedRanges(), own: test || !hidden, test });
    } else if (type === "pause") {
      const hidden = isHidden();
      const lastPause = state.lockAction && state.lockAction.action === "pause" ? state.lockAction.at : null;
      Object.assign(rec, { hidden, own: LM.ownAction({ hidden, handlersSet: state.handlers.includes("pause"), lastActionAt: lastPause, at }) });
    } else if (type === "error" && audio.error) {
      rec.detail = `code ${audio.error.code} ${audio.error.message || ""}`.trim();
    }
    if (type === "loadedmetadata" && finite(audio.duration)) {
      run.duration = audio.duration;
    }
    if (["loadedmetadata", "play", "pause", "seeked", "ratechange"].includes(type)) {
      updatePositionState();
    }
    recordEvent(rec, true);
  }

  // ---- the run -----------------------------------------------------------------

  function onStart() {
    if (!run || run.phase !== "ready" || !state.ready) {
      return;
    }
    const now = Date.now();
    const q = new URLSearchParams({ load: LOAD_ID, session: "phone", respond: RESPOND, kbps: String(LOCK_KBPS), run: run.run });
    audio.loop = false;
    audio.muted = MUTED;
    audio.volume = 1;
    audio.src = `/spike/audio/${LOCK_ID}?${q}`;
    // play() runs before any await, inside the tap, as iOS requires.
    const played = audio.play();
    setUpMediaSession();
    const id = run.run;
    run = newRun(id);
    Object.assign(run, { phase: "playing", startedAt: now });
    state.lastProgressAt = now;
    state.lastCt = 0;
    state.notice = "";
    recordEvent({ type: "start", at: now, ct: 0, muted: MUTED }, true);
    render();
    upload("start");
    flushWorker("start");
    played.then(
      () => {
        if (FAKE_HIDDEN) {
          setTimeout(() => {
            state.fakeHidden = true;
            onHidden(Date.now());
          }, FAKE_LOCK_DELAY_MS);
        }
      },
      (err) => {
        const name = err && err.name ? err.name : "Error";
        recordEvent({ type: "play refused", at: Date.now(), detail: `${name} ${errText(err)}` }, true);
        run.phase = "ready";
        state.notice = `The browser would not start the audio (${name}). Tap Start again.`;
        save();
        render();
      }
    );
  }

  /** On each timeupdate while playing: the jump, the end, and the periodic upload. */
  function tick(now) {
    const act = PM.nextAction({
      phase: run.phase,
      hidden: isHidden(),
      spans: run.spans,
      now,
      jumpAfterMs: JUMP_AFTER_MS,
      endAfterMs: END_AFTER_MS,
      jumped: !!run.jump,
    });
    if (act === "end") {
      endRun(now, "end");
      return;
    }
    if (act === "jump") {
      makeJump(now);
    }
    if (PM.uploadDue(state.lastUploadAt, now, UPLOAD_EVERY_MS)) {
      upload("periodic");
    }
  }

  /** The automatic jump that stands in for a Lock Screen scrub: past what is buffered, so the player must ask the worker. */
  function makeJump(now) {
    const ct = audio.currentTime;
    const buffered = bufferedRanges();
    const t = PM.jumpTarget({ ct, buffered, duration: audio.duration });
    if (!t) {
      run.jump = { at: now, skipped: "the track is too short for the jump" };
      save();
      return;
    }
    run.jump = { at: now, fromS: round3(ct), targetS: round3(t.target), bufferedEnd: round1(t.bufferedEnd), inBuffer: t.inBuffer, buffered };
    recordEvent({ type: "test jump", at: now, ct: round3(ct), target: round3(t.target), inBuffer: t.inBuffer }, true);
    state.testJumpPending = true;
    audio.currentTime = t.target;
  }

  /** Ends the run: "end" after the hidden time, "stopped" when the sound stopped before it. */
  function endRun(now, reason) {
    if (run.phase !== "playing") {
      return;
    }
    const ct = audio.currentTime;
    recordEvent({ type: "pause", at: now, ct: round3(ct), own: true, hidden: isHidden(), end: true }, true);
    Object.assign(run, { endAt: now, endCt: ct, reason, phase: "ended" });
    audio.pause();
    evaluate();
    save();
    render();
    upload("end");
    flushWorker("end");
    if (FAKE_HIDDEN && state.fakeHidden) {
      setTimeout(() => {
        state.fakeHidden = false;
        onVisible(Date.now());
      }, FAKE_LOCK_DELAY_MS);
    }
  }

  function evaluate() {
    run.result = PM.evaluateRun(run, normalized(), { limitS: PM.LIMIT_S, now: Date.now() });
  }

  function onHidden(now) {
    if (!run || run.phase !== "playing") {
      return;
    }
    run.spans.push({ from: now, to: null });
    if (!finite(run.firstHiddenAt)) {
      Object.assign(run, {
        firstHiddenAt: now,
        ctAtHide: audio.currentTime,
        aheadAtHide: readAhead(),
        allLoadedAtHide: allLoaded(),
        bufferedAtHide: bufferedRanges(),
        duration: finite(audio.duration) ? audio.duration : run.duration,
      });
    }
    state.early = null;
    // Saved at once: the browser may freeze or discard the page from here on.
    recordEvent({ type: "hidden", at: now, ct: round3(audio.currentTime) }, true);
  }

  async function onVisible(now) {
    if (!run) {
      return;
    }
    const open = run.spans[run.spans.length - 1];
    if (open && open.to === null) {
      open.to = now;
    }
    if (run.phase === "playing") {
      recordEvent({ type: "visible", at: now, ct: round3(audio.currentTime) }, true);
    }
    const moving = run.phase === "playing" ? await movingOnReturn(now) : false;
    if (run.phase === "playing" && isHidden()) {
      // Locked again during the check: the hidden span it opened goes on.
      return;
    }
    const back = PM.onReturn({ phase: run.phase, spans: run.spans, now, endAfterMs: END_AFTER_MS, moving });
    if (back.kind === "end" || back.kind === "stopped") {
      endRun(now, back.kind);
    } else if (back.kind === "early") {
      run.returns.push({ at: now, hiddenS: round1(back.hiddenMs / 1000) });
      state.early = back;
      save();
      render();
      upload("visible");
      flushWorker("visible");
      return;
    }
    if (run.phase === "ended") {
      await finish();
    }
  }

  /** The run is over and the tester is looking: the full evaluation, the verdict and the final upload. */
  async function finish() {
    await loadStoredLog();
    evaluate();
    if (!run.shownAt) {
      run.shownAt = Date.now();
    }
    save();
    render();
    flushWorker("shown");
    await upload("shown");
  }

  // ---- uploads -------------------------------------------------------------------

  /** Everything the run recorded, with no link in it. */
  function results(reason) {
    const iso = (ms) => (finite(ms) ? new Date(ms).toISOString() : null);
    const hiddenUntil = finite(run.endAt) ? run.endAt : Date.now();
    return {
      kind: "spike-sw-audio-phone",
      version: 1,
      pageVersion: PAGE_VERSION,
      workerVersion: state.worker ? state.worker.version : null,
      workerInstanceAtLoad: state.worker ? state.worker.instance : null,
      run: run.run,
      final: run.phase === "ended" && !!run.result,
      phase: run.phase,
      reason: run.reason,
      verdict: run.result ? { result: run.result.r, text: run.result.text } : null,
      verdictShown: !!run.shownAt,
      uploadReason: reason,
      uploadSeq: state.upload.seq,
      uploadedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      load: LOAD_ID,
      pageLoadedAt: iso(PAGE_STARTED),
      addressHasFragment: !!location.hash,
      linksExpireAt: iso(expiresAtMs()),
      settings: {
        track: LOCK_ID,
        respond: RESPOND,
        loop: false,
        jumpAfterS: JUMP_AFTER_MS / 1000,
        endAfterS: END_AFTER_MS / 1000,
        limitS: PM.LIMIT_S,
        muted: MUTED,
        test: { autostart: AUTOSTART, fakeHidden: FAKE_HIDDEN },
        lockScreenHandlers: state.handlers,
        workerConfigured: state.workerAck,
      },
      timeline: {
        startedAt: run.startedAt,
        firstHiddenAt: run.firstHiddenAt,
        ctAtHide: round3(run.ctAtHide),
        aheadAtHide: round3(run.aheadAtHide),
        allLoadedAtHide: run.allLoadedAtHide,
        bufferedAtHide: run.bufferedAtHide,
        duration: run.duration,
        hiddenS: round1(PM.hiddenMs(run.spans, hiddenUntil) / 1000),
        spans: run.spans,
        returns: run.returns,
        jump: run.jump,
        endAt: run.endAt,
        endCt: round3(run.endCt),
        reloadedAt: run.reloadedAt,
        shownAt: run.shownAt,
      },
      result: run.result,
      events: run.events,
      workerRecords: workerRecords(),
      workerUploads: state.workerUploads,
      pageUploads: { ok: state.upload.ok, failed: state.upload.failed, lastOkAt: iso(state.upload.lastOkAt), lastError: state.upload.lastError },
      notes: [state.storageNote].filter(Boolean),
    };
  }

  /** S3's error code (for example AccessDenied), never its whole body: that can quote the signed request. */
  async function s3Code(res) {
    try {
      const m = /<Code>([^<]+)<\/Code>/.exec(await res.text());
      return m ? " " + m[1] : "";
    } catch (e) {
      return "";
    }
  }

  async function put(reason) {
    const link = state.payload.links.p;
    const final = run.phase === "ended" && !!run.result;
    state.upload.seq += 1;
    state.upload.inFlight = true;
    try {
      const res = await fetch(link.url, {
        method: "PUT",
        body: JSON.stringify(results(reason)),
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      if (res.ok) {
        state.upload.ok += 1;
        state.upload.lastOkAt = Date.now();
        state.upload.lastError = "";
        state.upload.sentFinal = final;
      } else {
        state.upload.failed += 1;
        state.upload.lastError = `S3 answered ${res.status}${await s3Code(res)}`;
        state.upload.sentFinal = false;
      }
    } catch (err) {
      state.upload.failed += 1;
      state.upload.lastError = `the upload failed: ${errText(err)} (CORS or network)`;
      state.upload.sentFinal = false;
    } finally {
      state.upload.inFlight = false;
    }
  }

  /** PUTs the results, one at a time; each replaces the last. A periodic upload is skipped while one is under way. */
  function upload(reason) {
    if (!state.payload || !run) {
      return Promise.resolve();
    }
    if (reason === "periodic" && state.upload.inFlight) {
      return Promise.resolve();
    }
    state.lastUploadAt = Date.now();
    state.chain = state.chain.then(() => put(reason)).then(render, render);
    return state.chain;
  }

  async function copyResults() {
    const text = JSON.stringify(results("copy"), null, 2);
    const out = $("copy-out");
    out.value = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      $("copy").textContent = "Copied";
    } catch (err) {
      out.focus();
      out.select();
      $("copy").textContent = "Select the text below and copy it";
    }
  }

  // ---- the screen ------------------------------------------------------------------

  const MARKS = { pass: "✓", fail: "✗", cant: "?" };

  function show(lead, sub, result) {
    $("lead").textContent = lead;
    $("sub").textContent = sub || "";
    $("sub").hidden = !sub;
    if (result) {
      $("lead").dataset.result = result;
    } else {
      delete $("lead").dataset.result;
    }
  }

  function renderChecks(result) {
    const body = $("checks").querySelector("tbody");
    body.textContent = "";
    for (const [key, label] of PM.CHECKS) {
      const c = result.checks[key] || {};
      const tr = document.createElement("tr");
      const mark = document.createElement("td");
      mark.className = "mark";
      mark.dataset.result = c.r || "cant";
      mark.textContent = MARKS[c.r] || "?";
      const text = document.createElement("td");
      text.dataset.testid = `check-${key}`;
      text.dataset.result = c.r || "cant";
      text.textContent = label;
      const detail = document.createElement("span");
      detail.className = "detail";
      detail.textContent = c.r === "pass" ? PM.checkDetail(key, c) : c.why || PM.checkDetail(key, c);
      text.appendChild(detail);
      tr.append(mark, text);
      body.appendChild(tr);
    }
    $("checks").hidden = false;
  }

  function renderSent() {
    const sent = $("sent");
    sent.hidden = false;
    if (!state.payload) {
      sent.dataset.state = "bad";
      sent.textContent = "Results not sent: the page lost its upload link when it reloaded.";
    } else if (state.upload.inFlight || (!state.upload.sentFinal && !state.upload.lastError)) {
      sent.dataset.state = "";
      sent.textContent = "Sending results…";
    } else if (state.upload.sentFinal && !state.upload.lastError) {
      sent.dataset.state = "ok";
      sent.textContent = "Results sent";
    } else {
      sent.dataset.state = "bad";
      sent.textContent = `Results not sent: ${state.upload.lastError}.`;
    }
    $("copy").hidden = sent.dataset.state !== "bad";
  }

  function render() {
    $("start").hidden = true;
    $("checks").hidden = true;
    $("sent").hidden = true;
    $("copy").hidden = true;
    const foot = [];
    if (run) {
      foot.push(`Run ${run.run}`);
    }
    foot.push(`page ${PAGE_VERSION}`);
    if (state.worker) {
      foot.push(`worker ${state.worker.version} (${state.worker.instance})`);
    }
    if (FAKE_HIDDEN || AUTOSTART || MUTED || JUMP_AFTER_MS !== 300000 || END_AFTER_MS !== 900000) {
      foot.push(`test settings: jump ${JUMP_AFTER_MS / 1000} s, end ${END_AFTER_MS / 1000} s${MUTED ? ", muted" : ""}${FAKE_HIDDEN ? ", fake hidden" : ""}`);
    }
    if (state.storageNote) {
      foot.push(state.storageNote);
    }
    $("foot").textContent = foot.join(" · ");

    if (!LM || !PM) {
      show("The page did not load completely.", "Reload the page.");
      return;
    }
    if (state.setupError) {
      show("The test cannot run in this browser.", state.setupError, "fail");
      return;
    }
    if (!run) {
      if (state.badLink) {
        show("The link could not be read.", `${state.badLink.replace(/\.?$/, ".")} On the Mac, run spike/make-test-bucket.sh phone again and paste the new link. (A link cut short in copying reads this way too.)`, "fail");
      } else {
        show("This page needs the link from the Mac.", "On the Mac, run spike/make-test-bucket.sh phone, then paste the link it copies into Safari's address bar.");
      }
      return;
    }
    if (run.phase === "ended") {
      if (!run.result) {
        show("Working out the result…");
        return;
      }
      show(run.result.text, "", run.result.r);
      renderChecks(run.result);
      renderSent();
      return;
    }
    if (run.phase === "playing") {
      if (state.early) {
        show(`You came back after ${PM.fmtDuration(state.early.hiddenMs)}; lock again to finish (${PM.fmtDuration(state.early.leftMs)} to go).`);
      } else {
        show(`Lock your phone now. Leave it locked until the sound stops by itself, about ${minutes}. Then unlock and look here.`);
      }
      return;
    }
    const exp = expiresAtMs();
    const expired = !!exp && exp <= Date.now();
    let sub = "";
    if (expired) {
      sub = `These links expired at ${shortTime(exp)}. On the Mac, run spike/make-test-bucket.sh phone again and paste the new link.`;
    } else if (exp && exp - Date.now() < END_AFTER_MS + 5 * 60 * 1000) {
      sub = `These links expire at ${shortTime(exp)}, before the test can finish. On the Mac, run spike/make-test-bucket.sh phone again and paste the new link.`;
    }
    show(state.notice || `Tap Start, then lock your phone. The sound stops by itself after about ${minutes}; then unlock and look here.`, sub, expired ? "fail" : null);
    $("start").hidden = false;
    $("start").disabled = !state.ready || expired;
  }

  // ---- start-up --------------------------------------------------------------------

  function bindEvents() {
    MEDIA_EVENTS.forEach((type) => audio.addEventListener(type, onMediaEvent));
    $("start").addEventListener("click", onStart);
    $("copy").addEventListener("click", copyResults);
    document.addEventListener("visibilitychange", () => {
      const now = Date.now();
      if (FAKE_HIDDEN) {
        if (run && run.phase === "playing") {
          recordEvent({ type: "real visibility " + document.visibilityState, at: now }, true);
        }
        return;
      }
      if (document.visibilityState === "hidden") {
        onHidden(now);
      } else {
        onVisible(now);
      }
    });
    // A page about to be frozen or closed saves the last timeupdates now.
    const flush = () => {
      if (run && run.phase === "playing") {
        save();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("freeze", flush);
  }

  async function main() {
    if (!LM || !PM) {
      render();
      return;
    }
    state.payload = takePayload();
    // A link that cannot be read wins over a run stored from an earlier link.
    run = state.badLink ? null : loadRun(state.payload ? state.payload.run : null);
    recover();
    bindEvents();
    render();
    if (!run) {
      return;
    }
    if (!("serviceWorker" in navigator) || !window.caches) {
      state.setupError = "This browser has no service worker or Cache Storage here (a private window?). Open the link in a normal Safari window.";
      render();
      return;
    }
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    if (navigator.serviceWorker.startMessages) {
      navigator.serviceWorker.startMessages();
    }
    try {
      if (!(await setUpWorker())) {
        return;
      }
      if (state.payload) {
        await configureWorker();
      }
      await loadStoredLog();
    } catch (err) {
      state.setupError = "Setup failed: " + errText(err);
      render();
      return;
    }
    if (run.phase === "ended") {
      await finish();
      return;
    }
    state.ready = run.phase === "ready" && !!state.payload;
    render();
    if (AUTOSTART && state.ready) {
      onStart();
    }
  }

  main();
})();
