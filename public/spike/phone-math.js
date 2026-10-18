/*
 * The phone lock test's pure logic, kept apart from the page so that
 * spike/check-phone-math.mjs can test it under Node, and so that
 * spike/phone-tool.mjs packs the links with the very code the page unpacks
 * them with. Throwaway; this branch never merges. A plain script with no
 * build step: it sets SpikePhoneMath on the global object, and the page
 * reads window.SpikePhoneMath. evaluateRun also needs SpikeLockMath
 * (lock-math.js), loaded first.
 *
 * Three parts:
 *   - the link payload: the run's presigned URLs share their credential,
 *     date, expiry and session token and differ only in method, key and
 *     signature, so they travel as one base64url JSON in the URL fragment,
 *     and the page rebuilds each URL byte for byte;
 *   - the schedule: when the page makes its test jump and when it ends the
 *     run, from the time the page has been hidden in all. The page asks on
 *     each timeupdate, which fires in the background while audio plays;
 *     timers do not run while a phone is locked;
 *   - the checks and the verdict, from the stored events and the worker's
 *     records.
 *
 * Times are wall-clock milliseconds (Date.now()); positions are seconds of
 * audio.
 */
(function (root) {
  "use strict";

  const PAYLOAD_VERSION = 1;
  /** The test jump lands at least this far past the end of what is buffered... */
  const JUMP_PAST_BUFFER_S = 60;
  /** ...and at least this far ahead of the playhead... */
  const JUMP_AHEAD_S = 300;
  /** ...and no closer than this to the end of the track. */
  const JUMP_END_MARGIN_S = 120;
  /** A check on playback or on the jump passes under this many seconds. */
  const LIMIT_S = 5;
  /** After a reload, a last stored position older than this means the browser had closed the page then. */
  const RELOAD_GRACE_MS = 10000;
  /** The rows of the verdict's table, in order. */
  const CHECKS = [
    ["worker", "Worker answered while locked"],
    ["whole", "Played the whole time"],
    ["jump", "Test jump played again within 5 s"],
    ["past", "Went on past what was loaded"],
  ];

  const finite = Number.isFinite;
  const round1 = (n) => (finite(n) ? Math.round(n * 10) / 10 : null);

  // ---- the link payload ---------------------------------------------------

  function bytesToB64url(bytes) {
    let bin = "";
    for (const b of bytes) {
      bin += String.fromCharCode(b);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlToBytes(text) {
    if (!/^[A-Za-z0-9_-]*$/.test(text)) {
      throw new Error("not base64url");
    }
    let b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) {
      b64 += "=";
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  const HEX64 = /^[0-9a-f]{64}$/;

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  /** SigV4's URI encoding: every byte but A-Z a-z 0-9 - _ . ~ as %XX, in upper-case hex. */
  function awsEncode(text) {
    return encodeURIComponent(text).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  }

  /**
   * A query value in the shortest form that still rebuilds it exactly:
   *   "~<base64url>"  a 64-digit lower-case hex value (a SigV4 signature) as its 32 bytes;
   *   "!<raw>"        the raw value, as it was written;
   *   anything else   the decoded value, which awsEncode turns back into the raw one.
   * The session token and the credential shrink by their percent signs, a signature by a third.
   */
  function packValue(raw) {
    if (HEX64.test(raw)) {
      return "~" + bytesToB64url(hexToBytes(raw));
    }
    let decoded = null;
    try {
      decoded = decodeURIComponent(raw);
    } catch (e) {
      decoded = null;
    }
    if (decoded !== null && !/^[~!]/.test(decoded) && awsEncode(decoded) === raw) {
      return decoded;
    }
    return "!" + raw;
  }

  function unpackValue(value) {
    if (typeof value !== "string") {
      throw new Error("a query value is missing");
    }
    if (value.startsWith("~")) {
      return bytesToHex(b64urlToBytes(value.slice(1)));
    }
    if (value.startsWith("!")) {
      return value.slice(1);
    }
    return awsEncode(value);
  }

  /** An absolute URL's origin, path (without its leading slash) and query, exactly as written. */
  function splitUrl(url) {
    const m = /^(https?:\/\/[^/?#]+)\/([^?#]*)\?([^#]*)$/.exec(String(url));
    if (!m) {
      throw new Error("not an absolute http(s) URL with a query and no fragment");
    }
    const query = m[3].split("&").map((part) => {
      const eq = part.indexOf("=");
      if (eq < 1) {
        throw new Error("a query part that is not name=value");
      }
      return [part.slice(0, eq), part.slice(eq + 1)];
    });
    return { origin: m[1], path: m[2], query };
  }

  /**
   * Packs presigned URLs, `{ role: { method, url } }`, into the fragment's
   * payload: the base64url of the JSON
   *   { v: 1, r: run id, e: expiry (epoch seconds, optional), o: origin,
   *     q: [[name, value or null], ...]   the query in order, null where each URL has its own value,
   *     u: { role: [method, path, [its own values, in order]] } }
   * Every URL must have the same origin and the same query names in the same
   * order, as one signer's presigned URLs do; anything else throws.
   */
  function packLinks(links, meta) {
    const roles = Object.keys(links || {});
    if (!roles.length) {
      throw new Error("no links to pack");
    }
    const split = roles.map((role) => splitUrl(links[role].url));
    const origin = split[0].origin;
    const names = split[0].query.map(([name]) => name);
    split.forEach((s, i) => {
      if (s.origin !== origin) {
        throw new Error(`link ${roles[i]} has a different origin`);
      }
      if (s.query.map(([name]) => name).join("&") !== names.join("&")) {
        throw new Error(`link ${roles[i]} has different query names, or the same in a different order`);
      }
    });
    const q = names.map((name, i) => {
      const raw = split[0].query[i][1];
      return [name, split.every((s) => s.query[i][1] === raw) ? packValue(raw) : null];
    });
    const u = {};
    roles.forEach((role, k) => {
      const own = [];
      q.forEach(([, value], i) => {
        if (value === null) {
          own.push(packValue(split[k].query[i][1]));
        }
      });
      u[role] = [String(links[role].method || "GET").toUpperCase(), split[k].path, own];
    });
    const payload = { v: PAYLOAD_VERSION, r: String((meta && meta.run) || ""), o: origin, q, u };
    if (meta && finite(meta.expiresAt)) {
      payload.e = Math.floor(meta.expiresAt);
    }
    return bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  }

  /** The reverse of packLinks: { run, expiresAt, links: { role: { method, url } } }. Throws on a payload it cannot read. */
  function unpackLinks(text) {
    const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(String(text || "").trim())));
    if (!p || p.v !== PAYLOAD_VERSION || typeof p.o !== "string" || !Array.isArray(p.q) || !p.u || typeof p.u !== "object") {
      throw new Error("not a version 1 link payload");
    }
    const links = {};
    for (const role of Object.keys(p.u)) {
      const [method, path, own] = p.u[role];
      const rest = [...(own || [])];
      const query = p.q.map(([name, value]) => name + "=" + unpackValue(value === null ? rest.shift() : value));
      if (rest.length) {
        throw new Error(`link ${role} has more values than its query has places`);
      }
      links[role] = { method, url: `${p.o}/${path}?${query.join("&")}` };
    }
    return { run: p.r, expiresAt: finite(p.e) ? p.e : null, links };
  }

  // ---- the schedule ---------------------------------------------------------

  /** Milliseconds hidden in all up to `until`, a span still open ({to: null}) counting up to it. */
  function hiddenMs(spans, until) {
    let sum = 0;
    for (const s of spans || []) {
      const to = s.to === null || s.to === undefined ? until : Math.min(s.to, until);
      sum += Math.max(0, to - s.from);
    }
    return sum;
  }

  /** Whether `at` falls in one of the hidden spans, a span still open counting up to `until`. */
  function inSpans(spans, at, until) {
    return (spans || []).some((s) => at >= s.from && at <= (s.to === null || s.to === undefined ? until : Math.min(s.to, until)));
  }

  /**
   * What the page does on this timeupdate, only while the run plays and the
   * page is hidden: "end" once hidden for endAfterMs in all, "jump" (once)
   * once hidden for jumpAfterMs in all, or null. Hidden time adds up across
   * hidden spans, so coming back early spoils nothing.
   */
  function nextAction({ phase, hidden, spans, now, jumpAfterMs, endAfterMs, jumped }) {
    if (phase !== "playing" || !hidden) {
      return null;
    }
    const h = hiddenMs(spans, now);
    if (h >= endAfterMs) {
      return "end";
    }
    if (!jumped && h >= jumpAfterMs) {
      return "jump";
    }
    return null;
  }

  /**
   * The test jump's target, past what is buffered: the later of the end of
   * the buffered range holding the playhead plus 60 s and the playhead plus
   * 300 s, capped at the track's length minus 120 s. `buffered` is [[start,
   * end], ...] in seconds. null when that is not ahead of the playhead (a
   * track too short for the jump).
   */
  function jumpTarget({ ct, buffered, duration }) {
    const ranges = buffered || [];
    const holding = ranges.find(([a, b]) => a <= ct + 0.05 && ct <= b);
    const bufferedEnd = holding ? holding[1] : ct;
    let target = Math.max(bufferedEnd + JUMP_PAST_BUFFER_S, ct + JUMP_AHEAD_S);
    if (finite(duration) && duration > 0) {
      target = Math.min(target, duration - JUMP_END_MARGIN_S);
    }
    if (!(target > ct + 1)) {
      return null;
    }
    const inBuffer = ranges.some(([a, b]) => a <= target && target < b);
    return { target, from: ct, bufferedEnd, inBuffer };
  }

  /** Whether a periodic upload is due: never sent, or the last one `everyMs` or more ago. */
  function uploadDue(lastAt, now, everyMs) {
    return !finite(lastAt) || now - lastAt >= everyMs;
  }

  /**
   * What coming back to the page means:
   *   "verdict"  the run is over: show the result;
   *   "end"      hidden long enough in all, though no timeupdate ended it: end now;
   *   "stopped"  the sound stopped by itself before that: end now, and say so;
   *   "early"    still playing: say how long is left, and keep going;
   *   "none"     the run has not started.
   * `moving` is whether the audio is playing now.
   */
  function onReturn({ phase, spans, now, endAfterMs, moving }) {
    if (phase === "ended") {
      return { kind: "verdict" };
    }
    if (phase !== "playing") {
      return { kind: "none" };
    }
    const h = hiddenMs(spans, now);
    if (h >= endAfterMs) {
      return { kind: "end", hiddenMs: h };
    }
    if (!moving) {
      return { kind: "stopped", hiddenMs: h };
    }
    return { kind: "early", hiddenMs: h, leftMs: endAfterMs - h };
  }

  /** "45 s" under a minute and a half, else whole minutes ("4 min"). */
  function fmtDuration(ms) {
    const s = Math.max(0, ms / 1000);
    return s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`;
  }

  // ---- the checks ---------------------------------------------------------

  const isOk = (r) => (r.status === 206 || r.status === 200) && !r.error;
  /** S3 answers 403 once a presigned link expires, and 400 ExpiredToken once its session ends. */
  const isExpired = (r) => r.status === 403 || (r.status === 400 && /expired/i.test(r.error || ""));
  const strip = (range) => String(range || "").replace(/^bytes[= ]/, "");

  function parseContentRange(text) {
    const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(String(text || "").trim());
    return m ? { start: Number(m[1]), end: Number(m[2]), total: m[3] === "*" ? null : Number(m[3]) } : null;
  }

  /**
   * Whether the worker had handed the player every byte of the track before
   * `before`, by each answer's Content-Range (and, for a rebuilt response,
   * the bytes the player read). Safari can fetch a whole file early while
   * its buffered ranges still show only part of it.
   */
  function fetchedWhole(records, before) {
    let total = null;
    const spans = [];
    for (const r of records) {
      const cr = parseContentRange(r.contentRange);
      if (r.at >= before || !isOk(r) || !cr || cr.total === null) {
        continue;
      }
      total = cr.total;
      const end = finite(r.delivered) ? Math.min(cr.end, cr.start + r.delivered - 1) : cr.end;
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

  /** Where the measurement ends: the run's end, the track's end, or after a reload the last position stored. */
  function endPoint(run, events) {
    let end = null;
    if (run.reason === "reloaded") {
      const lastTu = [...events].reverse().find((ev) => ev.type === "timeupdate" && ev.at >= run.firstHiddenAt);
      end = lastTu ? { at: lastTu.at, ct: lastTu.ct } : null;
    } else if (finite(run.endCt) && finite(run.endAt)) {
      end = { at: run.endAt, ct: run.endCt };
    }
    const ended = events.find((ev) => ev.type === "ended" && ev.at >= run.firstHiddenAt);
    if (ended && (!end || ended.at < end.at)) {
      end = { at: ended.at, ct: finite(run.duration) ? run.duration : ended.ct };
    }
    return end;
  }

  const cant = (why, extra) => Object.assign({ r: "cant", why }, extra || {});
  const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

  /**
   * The four checks and the verdict for a run, from what the page stored
   * (`run`: firstHiddenAt, ctAtHide, aheadAtHide, allLoadedAtHide, duration,
   * spans, events, endAt, endCt, reason) and the worker's records ({ at
   * (ms), asked, status, error, aborted, contentRange, delivered,
   * instance }). Over the time from the first hide to the end:
   *   worker  the worker answered at least once while the page was hidden;
   *   past    it answered while hidden at least as long after the first hide
   *           as the audio that was loaded then, so playback went on past it;
   *   whole   the position kept up with the wall clock (lock-math's gap, not
   *           counting the test jump's own resume time) within limitS;
   *   jump    the test jump played again within limitS.
   * Each is { r: "pass" | "fail" | "cant", why, ...measures }.
   */
  function evaluateRun(run, records, opts) {
    const LM = root.SpikeLockMath;
    const limitS = opts && finite(opts.limitS) ? opts.limitS : LIMIT_S;
    const graceMs = opts && finite(opts.graceMs) ? opts.graceMs : RELOAD_GRACE_MS;
    const events = [...(run.events || [])].sort((a, b) => a.at - b.at);
    if (!finite(run.firstHiddenAt)) {
      const why = "The phone was never locked during the test.";
      const checks = { worker: cant(why), whole: cant(why), jump: cant(why), past: cant(why) };
      return { r: "cant", text: "Can't tell: " + lower(why), checks, expired: false, limitS };
    }
    const from = run.firstHiddenAt;
    const to = finite(run.endAt) ? run.endAt : opts && finite(opts.now) ? opts.now : from;
    const recs = (records || []).filter((r) => finite(r.at)).sort((a, b) => a.at - b.at);
    const during = recs.filter((r) => r.at >= from && r.at <= to);
    const hidden = during.filter((r) => inSpans(run.spans, r.at, to));
    const expired = during.some(isExpired);
    const ok = hidden.filter(isOk);
    const hiddenS = hiddenMs(run.spans, to) / 1000;
    const loadedS = finite(run.aheadAtHide) ? run.aheadAtHide : 0;
    const lastOkS = ok.length ? (ok[ok.length - 1].at - from) / 1000 : null;
    const whole = !run.allLoadedAtHide && fetchedWhole(recs, from);
    const facts = {
      answers: ok.length,
      failed: hidden.filter((r) => r.error && !r.aborted).length,
      lastAnswerS: round1(lastOkS),
      loadedS: round1(loadedS),
      hiddenS: round1(hiddenS),
      workerIds: [...new Set(during.map((r) => r.instance).filter(Boolean))],
      fetchedWholeBefore: whole,
    };
    let already = null;
    if (run.allLoadedAtHide) {
      already = "Everything was already loaded before the phone was locked, so this run can't tell.";
    } else if (whole) {
      already = "The player had already fetched the whole track through the worker before the phone was locked, so this run can't tell.";
    }

    let worker;
    if (ok.length) {
      worker = Object.assign({ r: "pass" }, facts);
    } else if (already) {
      worker = cant(already, facts);
    } else {
      worker = Object.assign({ r: "fail", why: "The worker answered nothing while the phone was locked." }, facts);
    }

    let past;
    if (already) {
      past = cant(already, facts);
    } else if (lastOkS !== null && lastOkS >= loadedS) {
      past = Object.assign({ r: "pass" }, facts);
    } else if (hiddenS > loadedS + 30) {
      past = Object.assign({ r: "fail", why: "Playback did not get past what was loaded when the phone was locked." }, facts);
    } else {
      past = cant("The phone was not locked long enough to use up what was loaded.", facts);
    }

    const end = endPoint(run, events);
    const start = { at: from, ct: finite(run.ctAtHide) ? run.ctAtHide : 0 };
    let wholeCheck;
    if (!end || !finite(end.ct)) {
      wholeCheck = cant("The page could not tell where the audio was at the end.");
    } else {
      const g = LM.playbackGap({ start, end, events, duration: run.duration });
      const measures = {
        gapS: round1(g.gapExcludingScrubsS),
        gapWithJumpS: round1(g.gapS),
        jumpResumeS: round1(g.ownResumeS),
        expectedS: round1(g.expectedS),
        actualS: round1(g.actualS),
        youPausedS: round1(g.youPausedS),
        otherPausedS: round1(g.otherPausedS),
        seeks: g.seeks,
        stoppedAfterS: round1((end.at - from) / 1000),
      };
      if (run.reason === "reloaded" && to - end.at > graceMs) {
        wholeCheck = Object.assign({ r: "fail", why: `The browser closed the page about ${fmtDuration(end.at - from)} after the phone was locked, so the audio stopped.` }, measures);
      } else if (g.gapExcludingScrubsS < limitS) {
        wholeCheck = Object.assign({ r: "pass" }, measures);
      } else {
        wholeCheck = Object.assign({ r: "fail", why: `It fell ${g.gapExcludingScrubsS.toFixed(1)} s behind the clock, not counting the test jump.` }, measures);
      }
    }

    const scrubs = LM.scrubs({
      start,
      end: end || { at: to, ct: NaN },
      events,
      records: recs.map((r) => ({ at: r.at, asked: strip(r.asked) })),
      duration: run.duration,
      limitS,
    });
    const t = scrubs.find((s) => s.test);
    let jump;
    if (!t) {
      jump = cant("The page made no test jump while the phone was locked.");
    } else {
      const measures = {
        afterS: round1((t.firstAt - from) / 1000),
        fromS: round1(t.from),
        toS: round1(t.target),
        targetLoaded: t.inBuffer,
        requestS: round1(t.requestS),
        asked: t.asked,
        resumeS: round1(t.resumeS),
      };
      if (t.pass) {
        jump = Object.assign({ r: "pass" }, measures);
      } else if (t.resumeS === null) {
        jump = Object.assign({ r: "fail", why: "After the test jump the audio did not play again." }, measures);
      } else {
        jump = Object.assign({ r: "fail", why: `After the test jump the audio took ${t.resumeS.toFixed(1)} s to play again.` }, measures);
      }
    }
    return verdict(run, { worker, whole: wholeCheck, jump, past }, expired, limitS, to);
  }

  /** One line for the screen and the results: pass, fail or can't tell, and why. `to` is where the run ended. */
  function verdict(run, checks, expired, limitS, to) {
    const out = { r: "cant", text: "", checks, expired: !!expired, limitS };
    const w = checks.whole;
    if (expired) {
      return Object.assign(out, { text: "Can't tell: the links expired during the test. Make a new link on the Mac and run it again." });
    }
    if (run.reason === "reloaded") {
      if (w.r === "fail") {
        return Object.assign(out, { r: "fail", text: `Fail: the browser reloaded the page while the phone was locked; it had closed the page about ${fmtDuration(w.stoppedAfterS * 1000)} after the phone was locked, so the audio stopped then.` });
      }
      return Object.assign(out, { text: "Can't tell: the page reloaded when you came back, before the test was over. Make a new link on the Mac and run it again." });
    }
    if (run.reason === "stopped") {
      const behind = finite(w.gapS) ? ` (${w.gapS.toFixed(1)} s behind the clock)` : "";
      return Object.assign(out, { r: "fail", text: `Fail: the sound stopped by itself before the end${behind}, after ${fmtDuration(hiddenMs(run.spans, to))} locked.` });
    }
    const order = ["whole", "jump", "worker", "past"];
    const failed = order.find((k) => checks[k].r === "fail");
    if (failed) {
      return Object.assign(out, { r: "fail", text: "Fail: " + lower(checks[failed].why) });
    }
    const unsure = order.find((k) => checks[k].r !== "pass");
    if (unsure) {
      return Object.assign(out, { text: "Can't tell: " + lower(checks[unsure].why) });
    }
    const j = checks.jump;
    return Object.assign(out, {
      r: "pass",
      text: `Pass: the audio played the whole ${fmtDuration(hiddenMs(run.spans, to))} with the phone locked (${w.gapS.toFixed(1)} s behind the clock), and the test jump played again in ${j.resumeS.toFixed(1)} s.`,
    });
  }

  /** A check's measures in a few words, for the table on the phone and the summary on the Mac. */
  function checkDetail(key, c) {
    if (!c) {
      return "";
    }
    const s = (n) => (finite(n) ? `${n.toFixed(1)} s` : "-");
    if (key === "worker") {
      return `${c.answers || 0} answers while locked${c.failed ? `, ${c.failed} failed` : ""}${c.workerIds && c.workerIds.length ? `; worker ${c.workerIds.join(", ")}` : ""}`;
    }
    if (key === "whole") {
      return finite(c.gapS) ? `gap ${s(c.gapS)} (${s(c.gapWithJumpS)} with the jump's own ${s(c.jumpResumeS)})` : c.why || "";
    }
    if (key === "jump") {
      if (!finite(c.toS)) {
        return c.why || "";
      }
      const resumed = finite(c.resumeS) ? `played again after ${s(c.resumeS)}` : "never played again";
      const request = finite(c.requestS) ? `worker asked after ${s(c.requestS)}` : "no request reached the worker";
      return `${resumed}; ${s(c.fromS)} to ${s(c.toS)}, target ${c.targetLoaded ? "" : "not "}loaded; ${request}`;
    }
    if (key === "past") {
      return finite(c.lastAnswerS) ? `last answer ${s(c.lastAnswerS)} after locking; ${s(c.loadedS)} loaded then` : c.why || "";
    }
    return "";
  }

  root.SpikePhoneMath = {
    PAYLOAD_VERSION,
    LIMIT_S,
    CHECKS,
    awsEncode,
    packValue,
    unpackValue,
    packLinks,
    unpackLinks,
    hiddenMs,
    inSpans,
    nextAction,
    jumpTarget,
    uploadDue,
    onReturn,
    fmtDuration,
    fetchedWhole,
    evaluateRun,
    checkDetail,
  };
})(typeof self !== "undefined" ? self : globalThis);
