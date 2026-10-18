#!/usr/bin/env node
/*
 * Tests the lock test's arithmetic in public/spike/lock-math.js with a table
 * of timelines. Throwaway, like the rest of the spike.
 *
 *   node spike/check-lock-math.mjs
 *
 * The file runs in a fresh vm context, as the browser runs it (a plain
 * script that sets SpikeLockMath on the global object), so what passes here
 * is the code the page loads.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "public", "spike", "lock-math.js");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
const M = context.SpikeLockMath;

// Wall-clock milliseconds when the page was hidden, and the track length.
const T0 = 1_000_000;
const DURATION = 1800;
const at = (s) => T0 + s * 1000;

/** timeupdates every `everyMs` from wall second `fromS` (position `ct`) to `toS`, playing. */
function tus(fromS, ct, toS, everyMs = 250) {
  const out = [];
  for (let t = at(fromS); t <= at(toS); t += everyMs) {
    out.push({ type: "timeupdate", at: t, ct: ct + (t - at(fromS)) / 1000 });
  }
  return out;
}

const seek = (s, target, extra = {}) =>
  Object.assign({ type: "seeking", at: at(s), target, own: true, hidden: true, inBuffer: false, buffered: [[0, 372.5]] }, extra);
const ev = (type, s, extra = {}) => Object.assign({ type, at: at(s) }, extra);
const byAt = (a, b) => a.at - b.at;

/**
 * Each case: a timeline from the hide (position 30 s) to the return 900 s
 * later, the worker's records, and what the page must conclude. `gap` is
 * seconds behind the wall clock (your own pauses left out), `gapExcluding`
 * the same without the scrubs' own resume time; `scrubs` lists each scrub
 * made while hidden.
 */
const cases = [
  {
    name: "no seek: plays the whole time",
    events: tus(0, 30, 900),
    records: [{ at: at(12), asked: "5300000-" }],
    end: { s: 900, ct: 930 },
    expect: { gap: 0, gapExcluding: 0, youPaused: 0, scrubs: [] },
  },
  {
    name: "one forward scrub past the buffer, back after 1.15 s",
    events: [
      ...tus(0, 30, 300),
      ev("action", 300.04),
      seek(300.05, 630),
      ev("waiting", 300.06),
      ev("seeked", 301, { ct: 630 }),
      ev("playing", 301.2),
      ...tus(301.2, 630, 900),
    ],
    records: [{ at: at(300.4), asked: "111132044-" }],
    end: { s: 900, ct: 630 + 598.8 },
    expect: { gap: 1.15, gapExcluding: 0, youPaused: 0, scrubs: [{ requestS: 0.35, resumeS: 1.15, pass: true, count: 1, inBuffer: false }] },
  },
  {
    name: "the same scrub with one timeupdate a second (as stored)",
    events: [...tus(0, 30, 300, 1000), seek(300.05, 630), ev("seeked", 301, { ct: 630 }), ...tus(301.2, 630, 900, 1000)],
    records: [{ at: at(300.4), asked: "111132044-" }],
    end: { s: 900, ct: 630 + 598.8 },
    expect: { gap: 1.15, gapExcluding: 0, youPaused: 0, scrubs: [{ requestS: 0.35, resumeS: 1.15, pass: true, count: 1 }] },
  },
  {
    name: "a 20 s stall mid-play, with no seek",
    events: [...tus(0, 30, 400), ev("waiting", 400.1), ev("stalled", 403), ev("playing", 420.1), ...tus(420.1, 430.1, 900)],
    records: [{ at: at(419.5), asked: "75000000-" }],
    end: { s: 900, ct: 430.1 + 479.9 },
    expect: { gap: 20, gapExcluding: 20, youPaused: 0, scrubs: [] },
  },
  {
    name: "a background loop-style jump to 0:00 that waits 78 s",
    duration: 600,
    events: [
      ...tus(0, 30, 570),
      seek(570, 0, { own: false, inBuffer: false, buffered: [[300, 600]] }),
      ev("waiting", 570.01),
      ev("seeked", 648, { ct: 0 }),
      ev("playing", 648),
      ...tus(648, 0, 900),
    ],
    records: [{ at: at(647.8), asked: "0-" }],
    end: { s: 900, ct: 252 },
    expect: { gap: 78, gapExcluding: 78, youPaused: 0, scrubs: [{ requestS: 77.8, resumeS: 78, pass: false, count: 1, own: false }] },
  },
  {
    name: "a scrub that never plays again",
    events: [...tus(0, 30, 300), seek(300, 630), ev("waiting", 300.01)],
    records: [],
    end: { s: 900, ct: 630 },
    expect: { gap: 600, gapExcluding: 0, youPaused: 0, scrubs: [{ requestS: null, resumeS: null, pass: false, count: 1 }] },
  },
  {
    name: "a drag that sends three seeks counts as one scrub",
    events: [
      ...tus(0, 30, 300),
      seek(300, 400),
      seek(300.3, 500),
      seek(300.6, 630, { inBuffer: true }),
      ev("seeked", 300.7, { ct: 630 }),
      ...tus(300.7, 630, 900),
    ],
    records: [{ at: at(300.1), asked: "70000000-" }],
    end: { s: 900, ct: 630 + 599.3 },
    expect: { gap: 0.7, gapExcluding: 0, youPaused: 0, scrubs: [{ requestS: null, resumeS: 0.1, pass: true, count: 3, inBuffer: true }] },
  },
  {
    name: "pause and play on the Lock Screen is left out of the gap",
    events: [
      ...tus(0, 30, 880),
      ev("pause", 880.1, { own: true }),
      ev("play", 882.1),
      ev("playing", 882.2),
      ...tus(882.2, 910.1, 900),
    ],
    records: [],
    end: { s: 900, ct: 910.1 + 17.8 },
    expect: { gap: 0.1, gapExcluding: 0.1, youPaused: 2, scrubs: [] },
  },
  {
    name: "a pause by something else counts as a gap",
    events: [...tus(0, 30, 600), ev("pause", 600.1, { own: false }), ev("play", 640.1), ev("playing", 640.1), ...tus(640.1, 630.1, 900)],
    records: [],
    end: { s: 900, ct: 630.1 + 259.9 },
    expect: { gap: 40, gapExcluding: 40, youPaused: 0, scrubs: [] },
  },
];

const near = (actual, expected, what) => {
  assert.ok(Math.abs(actual - expected) < 0.011, `${what}: got ${actual}, expected ${expected}`);
};

for (const c of cases) {
  test(c.name, () => {
    const events = [...c.events].sort(byAt);
    const start = { at: T0, ct: 30 };
    const end = { at: at(c.end.s), ct: c.end.ct };
    const duration = c.duration || DURATION;
    const gap = M.playbackGap({ start, end, events, duration });
    near(gap.gapS, c.expect.gap, "gap");
    near(gap.gapExcludingScrubsS, c.expect.gapExcluding, "gap not counting the scrubs");
    near(gap.youPausedS, c.expect.youPaused, "paused by you");

    const scrubs = M.scrubs({ start, end, events, records: c.records, duration, limitS: 5 });
    assert.equal(scrubs.length, c.expect.scrubs.length, "number of scrubs");
    c.expect.scrubs.forEach((want, i) => {
      const got = scrubs[i];
      for (const key of ["requestS", "resumeS"]) {
        if (want[key] === null) {
          assert.equal(got[key], null, key);
        } else {
          near(got[key], want[key], key);
        }
      }
      for (const key of ["pass", "count", "inBuffer", "own"]) {
        if (key in want) {
          assert.equal(got[key], want[key], key);
        }
      }
    });
  });
}

test("the gap is expected minus actual, with each seek's jump from the estimated position", () => {
  // Hidden at 30 s; the last timeupdate before the seek is 330 s at 300 s
  // away, so 50 ms later the estimate is 330.05 s and the jump 299.95 s.
  const events = [...tus(0, 30, 300), seek(300.05, 630), ...tus(301.2, 630, 900)].sort(byAt);
  const gap = M.playbackGap({ start: { at: T0, ct: 30 }, end: { at: at(900), ct: 1228.8 }, events, duration: DURATION });
  near(gap.jumpsS, 299.95, "jumps");
  near(gap.expectedS, 30 + 900 + 299.95, "expected");
  near(gap.actualS, 1228.8, "actual");
});

const ownCases = [
  { name: "visible: always yours", input: { hidden: false, handlersSet: true, lastActionAt: null, at: 5000 }, own: true },
  { name: "hidden, no handlers: the browser's own controls", input: { hidden: true, handlersSet: false, lastActionAt: null, at: 5000 }, own: true },
  { name: "hidden, a Lock Screen action 1 s before", input: { hidden: true, handlersSet: true, lastActionAt: 4000, at: 5000 }, own: true },
  { name: "hidden, the seek stamped 1 ms before its action (clock rounding)", input: { hidden: true, handlersSet: true, lastActionAt: 5001, at: 5000 }, own: true },
  { name: "hidden, the last action 3 s before", input: { hidden: true, handlersSet: true, lastActionAt: 2000, at: 5000 }, own: false },
  { name: "hidden, the only action a second after", input: { hidden: true, handlersSet: true, lastActionAt: 6000, at: 5000 }, own: false },
  { name: "hidden, no action at all", input: { hidden: true, handlersSet: true, lastActionAt: null, at: 5000 }, own: false },
];

for (const c of ownCases) {
  test(`ownAction: ${c.name}`, () => {
    assert.equal(M.ownAction(c.input), c.own);
  });
}
