/*
 * The lock test's arithmetic, kept apart from the page so that
 * spike/check-lock-math.js can test it under Node. Throwaway; this branch
 * never merges. A plain script with no build step: it sets SpikeLockMath on
 * the global object, and the page reads window.SpikeLockMath.
 *
 * Every function is pure and takes plain records. Times are wall-clock
 * milliseconds (Date.now()); positions are seconds of audio. Nothing here
 * relies on a timer, because timers stop while a phone is locked; the page
 * records each event with its wall-clock time as it fires, and these
 * functions work from those records when the page comes back.
 *
 * An event is one of the lock player's, sorted by `at`:
 *   { type: "timeupdate", at, ct }     ct: the player's currentTime
 *   { type: "seeking", at, target, own, hidden, inBuffer, buffered }
 *   { type: "seeked", at, ct }
 *   { type: "waiting" | "playing" | "play" | "ended", at }
 *   { type: "pause", at, own }
 * `own` is true when you did it (on the Lock Screen or on the page), and
 * false when the player did it by itself, as Loop does at the end of a
 * track. Other types (page visibility, Lock Screen actions, stalled) are
 * ignored here.
 *
 * A worker record is { at, asked }: when the request reached the worker, and
 * the element's Range without "bytes=".
 */
(function (root) {
  "use strict";

  /** Playback counts as moving again once the position is this far past where a seek landed. */
  const ADVANCED_BY_S = 0.2;
  /** Seeks this close together, with no playback between them, are one drag of the scrubber. */
  const DRAG_MS = 2000;
  /** A Lock Screen action this soon before a seek or a pause is what caused it. */
  const ACTION_MS = 2000;
  /**
   * An event's time is back-dated from its timeStamp and an action's is
   * Date.now(), both to the millisecond, so the seek an action causes can
   * carry a time a moment before the action's.
   */
  const CLOCK_SLACK_MS = 250;

  const finite = Number.isFinite;

  /**
   * Whether you made a seek or a pause: anything while the page was
   * visible; anything while it was hidden that followed a Lock Screen
   * action; and anything at all when the page could not set Lock Screen
   * handlers, because the browser's own controls then do it and nothing
   * tells the two apart.
   */
  function ownAction({ hidden, handlersSet, lastActionAt, at }) {
    if (!hidden || !handlersSet) {
      return true;
    }
    return finite(lastActionAt) && at - lastActionAt >= -CLOCK_SLACK_MS && at - lastActionAt <= ACTION_MS;
  }

  /**
   * Walks the events from `start` ({at, ct}, playing) to `endAt`. The
   * playhead estimate is the last timeupdate's position plus the wall time
   * since it, frozen while the player waits for data, is paused or is
   * seeking. Returns each seek with the estimated position just before it
   * (`from`) and its `jump` (target minus from), and the time the player
   * was paused by you and by anything else.
   */
  function walk(start, events, endAt, duration) {
    let pos = start.ct;
    let at = start.at;
    let paused = false;
    let waiting = false;
    let seeking = false;
    let pausedSince = null;
    let pausedOwn = false;
    let youPausedMs = 0;
    let otherPausedMs = 0;
    const seeks = [];

    function advance(to) {
      if (to <= at) {
        return;
      }
      if (!paused && !waiting && !seeking) {
        pos += (to - at) / 1000;
        if (finite(duration)) {
          pos = Math.min(pos, duration);
        }
      }
      at = to;
    }

    function unpause(to) {
      if (!paused) {
        return;
      }
      const ms = Math.max(0, to - pausedSince);
      if (pausedOwn) {
        youPausedMs += ms;
      } else {
        otherPausedMs += ms;
      }
      paused = false;
      pausedSince = null;
    }

    for (const ev of events) {
      if (ev.at < start.at || ev.at > endAt) {
        continue;
      }
      advance(ev.at);
      if (ev.type === "timeupdate" && finite(ev.ct)) {
        // A position past the frozen estimate means the player is moving:
        // a waiting or seeking whose end the page did not hear has ended.
        if (ev.ct > pos + 0.01) {
          waiting = false;
          seeking = false;
        }
        if (!seeking) {
          pos = ev.ct;
        }
      } else if (ev.type === "seeking" && finite(ev.target)) {
        seeks.push(Object.assign({}, ev, { from: pos, jump: ev.target - pos }));
        pos = ev.target;
        seeking = true;
      } else if (ev.type === "seeked") {
        seeking = false;
        if (finite(ev.ct)) {
          pos = ev.ct;
        }
      } else if (ev.type === "waiting") {
        waiting = true;
      } else if (ev.type === "playing") {
        waiting = false;
        unpause(ev.at);
      } else if (ev.type === "play") {
        unpause(ev.at);
      } else if (ev.type === "pause" && !paused) {
        paused = true;
        pausedSince = ev.at;
        pausedOwn = !!ev.own;
      } else if (ev.type === "ended" && finite(duration)) {
        pos = duration;
      }
    }
    advance(endAt);
    unpause(endAt);
    return { pos, seeks, youPausedMs, otherPausedMs };
  }

  /**
   * When playback started moving again after `seek`, before `untilAt` (the
   * next seek, or the end). It is back-dated from the first timeupdate past
   * the landing point by how far past it is, so a timeupdate that comes only
   * once a second still gives the moment playback started. null if it never
   * moved again.
   */
  function resumeAt(seek, events, untilAt) {
    let base = seek.target;
    for (const ev of events) {
      if (ev.at <= seek.at) {
        continue;
      }
      if (ev.at >= untilAt) {
        break;
      }
      if (ev.type === "seeked" && finite(ev.ct)) {
        base = ev.ct;
      } else if (ev.type === "timeupdate" && finite(ev.ct) && ev.ct >= base + ADVANCED_BY_S) {
        return Math.max(seek.at, ev.at - (ev.ct - base) * 1000);
      }
    }
    return null;
  }

  const untilNext = (seeks, i, endAt) => (i + 1 < seeks.length ? seeks[i + 1].at : endAt);

  /**
   * Did playback keep up with the wall clock from `start` (the page hidden,
   * {at, ct}) to `end` ({at, ct}: back on the page, or the track's end)?
   *
   *   expected = start.ct + time away - time you paused it + each seek's jump
   *   gap      = expected - end.ct
   *
   * A pause by anything but you counts in the gap. `ownResumeS` is the time
   * each of your own seeks took to play again (to the next seek, or the end,
   * if it never did), so `gapExcludingScrubsS` leaves the scrubs' own
   * resume time out.
   */
  function playbackGap({ start, end, events, duration }) {
    const w = walk(start, events, end.at, duration);
    const awayS = (end.at - start.at) / 1000;
    const jumpsS = w.seeks.reduce((sum, s) => sum + s.jump, 0);
    let expectedS = start.ct + awayS - w.youPausedMs / 1000 + jumpsS;
    if (finite(duration)) {
      expectedS = Math.min(expectedS, duration);
    }
    const gapS = expectedS - end.ct;
    let ownResumeS = 0;
    w.seeks.forEach((s, i) => {
      if (!s.own) {
        return;
      }
      const until = untilNext(w.seeks, i, end.at);
      const moved = resumeAt(s, events, until);
      ownResumeS += ((moved === null ? until : moved) - s.at) / 1000;
    });
    return {
      awayS,
      expectedS,
      actualS: end.ct,
      gapS,
      ownResumeS,
      gapExcludingScrubsS: gapS - ownResumeS,
      jumpsS,
      youPausedS: w.youPausedMs / 1000,
      otherPausedS: w.otherPausedMs / 1000,
      seeks: w.seeks.length,
    };
  }

  /**
   * The seeks made while the page was hidden. Several seeks in one drag of
   * the scrubber count as one scrub, measured from its last seek (where you
   * let go): whether that target was already loaded, how long until the
   * worker saw the first request after it, and how long until playback
   * moved again. A scrub passes if playback moved within `limitS` seconds.
   */
  function scrubs({ start, end, events, records, duration, limitS }) {
    const seeks = walk(start, events, end.at, duration).seeks;
    const recs = [...(records || [])].sort((a, b) => a.at - b.at);
    const out = [];
    let prev = null;
    seeks.forEach((s, i) => {
      const until = untilNext(seeks, i, end.at);
      const moved = resumeAt(s, events, until);
      if (s.hidden) {
        const req = recs.find((r) => r.at >= s.at && r.at < until) || null;
        const resumeS = moved === null ? null : (moved - s.at) / 1000;
        const measured = {
          at: s.at,
          target: s.target,
          own: !!s.own,
          inBuffer: !!s.inBuffer,
          buffered: s.buffered || [],
          requestS: req ? (req.at - s.at) / 1000 : null,
          asked: req ? req.asked : null,
          resumeS,
          untilS: (until - s.at) / 1000,
          pass: resumeS !== null && resumeS < limitS,
        };
        const sameDrag = prev && prev.hidden && prev.moved === null && s.at - prev.at < DRAG_MS;
        if (sameDrag) {
          const scrub = out[out.length - 1];
          Object.assign(scrub, measured, { count: scrub.count + 1 });
        } else {
          out.push(Object.assign({ firstAt: s.at, from: s.from, count: 1 }, measured));
        }
      }
      prev = { hidden: !!s.hidden, moved, at: s.at };
    });
    return out;
  }

  root.SpikeLockMath = { ADVANCED_BY_S, DRAG_MS, ACTION_MS, ownAction, walk, resumeAt, playbackGap, scrubs };
})(typeof self !== "undefined" ? self : globalThis);
