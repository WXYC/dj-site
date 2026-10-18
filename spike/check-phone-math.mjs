#!/usr/bin/env node
/*
 * Tests the phone lock test's pure logic in public/spike/phone-math.js: the
 * link payload, the schedule (the test jump and the end), and the checks.
 * Throwaway, like the rest of the spike.
 *
 *   node spike/check-phone-math.mjs
 *
 * The page's two plain scripts run in one fresh vm context, as the browser
 * runs them (lock-math.js first), with only the globals the page uses from
 * the browser, so what passes here is the code the page loads.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({ atob, btoa, TextEncoder, TextDecoder });
for (const name of ["lock-math.js", "phone-math.js"]) {
  const file = path.join(here, "..", "public", "spike", name);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const PM = context.SpikePhoneMath;

// ---- the link payload ------------------------------------------------------

/** A seeded generator, so the made-up tokens and signatures are the same on every run. */
function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

function randomText(next, alphabet, n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += alphabet[Math.floor(next() * alphabet.length)];
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Three presigned URLs as boto3 writes them: one credential, date, expiry and token; a signature each. */
function presigned({ seed = 1, tokenChars = 980, origin = "https://wxyc-dj-site-spike-sw-audio.s3.amazonaws.com", run = "a1b2c3" } = {}) {
  const next = rng(seed);
  const token = randomText(next, B64, tokenChars - 2) + "==";
  const shared = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", encodeURIComponent("ASIAEXAMPLEEXAMPLE12/20261017/us-east-1/s3/aws4_request")],
    ["X-Amz-Date", "20261017T230000Z"],
    ["X-Amz-Expires", "3600"],
    ["X-Amz-SignedHeaders", "host"],
    ["X-Amz-Security-Token", PM.awsEncode(token)],
  ];
  const url = (key) => {
    const sig = randomText(next, "0123456789abcdef", 64);
    return `${origin}/${key}?${[...shared, ["X-Amz-Signature", sig]].map(([n, v]) => `${n}=${v}`).join("&")}`;
  };
  return {
    t: { method: "GET", url: url("spike/spike-marker-30min.wav") },
    p: { method: "PUT", url: url(`spike/results/${run}/page.json`) },
    w: { method: "PUT", url: url(`spike/results/${run}/worker.json`) },
  };
}

const PAGE = "https://spike-safari-sw-audio.dj-site.pages.dev/spike/phone?respond=rebuilt";

const roundTrips = [
  { name: "three boto3-style links with a 980-character token", links: presigned() },
  { name: "a 1,300-character token", links: presigned({ seed: 7, tokenChars: 1300 }) },
  { name: "path-style links on a local stand-in for S3", links: presigned({ seed: 3, origin: "http://127.0.0.1:8788/wxyc-dj-site-spike-sw-audio" }) },
  {
    name: "values the packer must keep as written",
    links: {
      a: { method: "GET", url: "https://h.example/k?A=%2f%2B&B=%21x&C=~tilde&D=&E=a+b&F=%zz&G=ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789" },
      b: { method: "PUT", url: "https://h.example/k%20two?A=%2f%2B&B=%21y&C=~tilde&D=&E=a+b&F=%zz&G=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" },
    },
  },
  { name: "a single link", links: { t: { method: "GET", url: "https://h.example/spike/x.wav?X-Amz-Signature=" + "0f".repeat(32) } } },
];

for (const c of roundTrips) {
  test(`payload round trip: ${c.name}`, () => {
    const packed = PM.packLinks(c.links, { run: "a1b2c3", expiresAt: 1792364400.9 });
    assert.match(packed, /^[A-Za-z0-9_-]+$/, "base64url only, no padding");
    const back = PM.unpackLinks(packed);
    assert.equal(back.run, "a1b2c3");
    assert.equal(back.expiresAt, 1792364400);
    assert.deepEqual(Object.keys(back.links), Object.keys(c.links));
    for (const role of Object.keys(c.links)) {
      assert.equal(back.links[role].url, c.links[role].url, `${role}: byte-identical URL`);
      assert.equal(back.links[role].method, c.links[role].method, `${role}: method`);
    }
  });
}

test("the phone URL stays under 2,500 characters with a 1,000-character token", () => {
  const packed = PM.packLinks(presigned({ seed: 11, tokenChars: 1000 }), { run: "a1b2c3", expiresAt: 1792364400 });
  const url = `${PAGE}#k=${packed}`;
  assert.ok(url.length < 2500, `the URL is ${url.length} characters`);
});

test("the shared values travel once: only the signatures are per link", () => {
  const packed = PM.packLinks(presigned(), { run: "a1b2c3" });
  const json = JSON.parse(Buffer.from(packed, "base64url").toString("utf8"));
  assert.deepEqual(
    json.q.filter(([, v]) => v === null).map(([n]) => n),
    ["X-Amz-Signature"],
  );
  for (const role of ["t", "p", "w"]) {
    assert.equal(json.u[role][2].length, 1);
    assert.match(json.u[role][2][0], /^~[A-Za-z0-9_-]{43}$/, "a signature packed as its 32 bytes");
  }
});

const valueCases = [
  { raw: "AWS4-HMAC-SHA256", packed: "AWS4-HMAC-SHA256" },
  { raw: "ASIA%2F2026%2Fus-east-1", packed: "ASIA/2026/us-east-1" },
  { raw: "a%2Bb%3D", packed: "a+b=" },
  { raw: "%2f", packed: "!%2f", why: "lower-case hex is not what awsEncode writes" },
  { raw: "a+b", packed: "!a+b", why: "a bare + is not what awsEncode writes" },
  { raw: "%21bang", packed: "!%21bang", why: "a decoded value starting with ! would read as raw" },
  { raw: "~x", packed: "!~x", why: "a decoded value starting with ~ would read as hex" },
  { raw: "%zz", packed: "!%zz", why: "not percent-decodable" },
  { raw: "", packed: "" },
];

for (const c of valueCases) {
  test(`packValue ${JSON.stringify(c.raw)}${c.why ? ` (${c.why})` : ""}`, () => {
    assert.equal(PM.packValue(c.raw), c.packed);
    assert.equal(PM.unpackValue(PM.packValue(c.raw)), c.raw);
  });
}

const packErrors = [
  { name: "different origins", links: { a: { url: "https://a.example/k?x=1" }, b: { url: "https://b.example/k?x=1" } }, re: /different origin/ },
  { name: "query names in another order", links: { a: { url: "https://a.example/k?x=1&y=2" }, b: { url: "https://a.example/k?y=2&x=1" } }, re: /different query names/ },
  { name: "a URL with a fragment", links: { a: { url: "https://a.example/k?x=1#f" } }, re: /no fragment/ },
  { name: "a URL with no query", links: { a: { url: "https://a.example/k" } }, re: /with a query/ },
  { name: "a query part with no value", links: { a: { url: "https://a.example/k?x" } }, re: /name=value/ },
  { name: "no links", links: {}, re: /no links/ },
];

for (const c of packErrors) {
  test(`packLinks refuses ${c.name}`, () => {
    assert.throws(() => PM.packLinks(c.links, { run: "r" }), c.re);
  });
}

const unpackErrors = [
  { name: "not base64url", text: "abc$", re: /base64url/ },
  { name: "not JSON", text: Buffer.from("nope").toString("base64url"), re: /JSON|Unexpected/ },
  { name: "another version", text: Buffer.from(JSON.stringify({ v: 2, o: "https://h", q: [], u: {} })).toString("base64url"), re: /version 1/ },
  {
    name: "a link short of a value",
    text: Buffer.from(JSON.stringify({ v: 1, r: "r", o: "https://h", q: [["x", null]], u: { t: ["GET", "k", []] } })).toString("base64url"),
    re: /missing/,
  },
];

for (const c of unpackErrors) {
  test(`unpackLinks refuses ${c.name}`, () => {
    assert.throws(() => PM.unpackLinks(c.text), c.re);
  });
}

// ---- the schedule ----------------------------------------------------------

const T0 = 1_000_000;
const at = (s) => T0 + s * 1000;
const MIN = 60 * 1000;

const hiddenCases = [
  { name: "one open span", spans: [{ from: at(0), to: null }], now: at(90), ms: 90000 },
  { name: "one closed span", spans: [{ from: at(0), to: at(30) }], now: at(90), ms: 30000 },
  { name: "two spans add up", spans: [{ from: at(0), to: at(240) }, { from: at(300), to: null }], now: at(400), ms: 340000 },
  { name: "a span past the end counts up to it", spans: [{ from: at(0), to: at(1000) }], now: at(900), ms: 900000 },
  { name: "no spans", spans: [], now: at(90), ms: 0 },
];

for (const c of hiddenCases) {
  test(`hiddenMs: ${c.name}`, () => {
    assert.equal(PM.hiddenMs(c.spans, c.now), c.ms);
  });
}

const actionCases = [
  { name: "not started", input: { phase: "ready", hidden: true, spans: [{ from: at(0), to: null }], now: at(1000) }, want: null },
  { name: "visible", input: { phase: "playing", hidden: false, spans: [{ from: at(0), to: at(400) }], now: at(500) }, want: null },
  { name: "hidden under 5 min", input: { phase: "playing", hidden: true, spans: [{ from: at(0), to: null }], now: at(299) }, want: null },
  { name: "hidden 5 min: jump", input: { phase: "playing", hidden: true, spans: [{ from: at(0), to: null }], now: at(300) }, want: "jump" },
  { name: "already jumped", input: { phase: "playing", hidden: true, jumped: true, spans: [{ from: at(0), to: null }], now: at(600) }, want: null },
  { name: "5 min across two spans: jump", input: { phase: "playing", hidden: true, spans: [{ from: at(0), to: at(200) }, { from: at(260), to: null }], now: at(360) }, want: "jump" },
  { name: "hidden 15 min: end", input: { phase: "playing", hidden: true, jumped: true, spans: [{ from: at(0), to: null }], now: at(900) }, want: "end" },
  { name: "15 min without a jump: end first", input: { phase: "playing", hidden: true, spans: [{ from: at(0), to: null }], now: at(901) }, want: "end" },
  { name: "ended", input: { phase: "ended", hidden: true, spans: [{ from: at(0), to: null }], now: at(1000) }, want: null },
];

for (const c of actionCases) {
  test(`nextAction: ${c.name}`, () => {
    assert.equal(PM.nextAction(Object.assign({ jumpAfterMs: 5 * MIN, endAfterMs: 15 * MIN, jumped: false }, c.input)), c.want);
  });
}

const jumpCases = [
  { name: "30 s buffered ahead: the playhead plus 300 s wins", input: { ct: 300, buffered: [[0, 330]], duration: 1800 }, target: 600, inBuffer: false },
  { name: "400 s buffered ahead: the buffer's end plus 60 s wins", input: { ct: 300, buffered: [[0, 700]], duration: 1800 }, target: 760, inBuffer: false },
  { name: "the whole track buffered: capped 120 s before the end, in the buffer", input: { ct: 300, buffered: [[0, 1800]], duration: 1800 }, target: 1680, inBuffer: true },
  { name: "no range holds the playhead: from the playhead", input: { ct: 300, buffered: [[500, 520]], duration: 1800 }, target: 600, inBuffer: false },
  { name: "a later range holds the target", input: { ct: 300, buffered: [[0, 330], [590, 640]], duration: 1800 }, target: 600, inBuffer: true },
  { name: "unknown length: no cap", input: { ct: 300, buffered: [], duration: NaN }, target: 600, inBuffer: false },
];

for (const c of jumpCases) {
  test(`jumpTarget: ${c.name}`, () => {
    const t = PM.jumpTarget(c.input);
    assert.equal(t.target, c.target);
    assert.equal(t.inBuffer, c.inBuffer);
    assert.equal(t.from, c.input.ct);
  });
}

test("jumpTarget: a track too short for the jump", () => {
  assert.equal(PM.jumpTarget({ ct: 100, buffered: [[0, 200]], duration: 200 }), null);
});

const uploadCases = [
  { name: "never sent", last: null, now: at(10), due: true },
  { name: "59 s ago", last: at(1), now: at(60), due: false },
  { name: "60 s ago", last: at(0), now: at(60), due: true },
];

for (const c of uploadCases) {
  test(`uploadDue: ${c.name}`, () => {
    assert.equal(PM.uploadDue(c.last, c.now, MIN), c.due);
  });
}

const returnCases = [
  { name: "the run is over", input: { phase: "ended" }, kind: "verdict" },
  { name: "not started", input: { phase: "ready" }, kind: "none" },
  { name: "back after 4 min, playing", input: { phase: "playing", spans: [{ from: at(0), to: at(240) }], now: at(240), moving: true }, kind: "early", leftMs: 11 * MIN },
  { name: "back after 4 min, silent", input: { phase: "playing", spans: [{ from: at(0), to: at(240) }], now: at(240), moving: false }, kind: "stopped" },
  { name: "back after 16 min with no end yet", input: { phase: "playing", spans: [{ from: at(0), to: at(960) }], now: at(960), moving: true }, kind: "end" },
  {
    name: "back again: the spans add up",
    input: { phase: "playing", spans: [{ from: at(0), to: at(240) }, { from: at(300), to: at(600) }], now: at(600), moving: true },
    kind: "early",
    leftMs: 6 * MIN,
  },
];

for (const c of returnCases) {
  test(`onReturn: ${c.name}`, () => {
    const out = PM.onReturn(Object.assign({ endAfterMs: 15 * MIN, spans: [], now: at(0), moving: true }, c.input));
    assert.equal(out.kind, c.kind);
    if ("leftMs" in c) {
      assert.equal(out.leftMs, c.leftMs);
    }
  });
}

// ---- the checks ------------------------------------------------------------

/** timeupdates every second from wall second `fromS` (position `ct`) to `toS`, playing. */
function tus(fromS, ct, toS) {
  const out = [];
  for (let s = fromS; s <= toS; s += 1) {
    out.push({ type: "timeupdate", at: at(s), ct: ct + (s - fromS) });
  }
  return out;
}

const TOTAL = 20_000_000;
const ok = (s, start, end, extra = {}) =>
  Object.assign({ at: at(s), asked: `bytes=${start}-`, status: 206, error: "", contentRange: `bytes ${start}-${end}/${TOTAL}`, instance: "k3x9q1" }, extra);
const testJump = (s, target, extra = {}) =>
  Object.assign({ type: "seeking", at: at(s), ct: target, target, own: true, test: true, hidden: true, inBuffer: false, buffered: [[0, 340]] }, extra);

/** A run hidden at 0 s (position 2 s) with 40 s loaded, the test jump at 300 s and the end at 900 s. */
function baseRun(over = {}) {
  return Object.assign(
    {
      firstHiddenAt: at(0),
      ctAtHide: 2,
      aheadAtHide: 40,
      allLoadedAtHide: false,
      duration: 1800,
      spans: [{ from: at(0), to: null }],
      endAt: at(900),
      endCt: 2 + 900 + 298 - 1.2,
      reason: "end",
      events: [...tus(0, 2, 300), testJump(300, 600), { type: "seeked", at: at(301), ct: 600 }, ...tus(301.2, 600, 900)],
    },
    over,
  );
}

const playing = [ok(-1, 0, 5_000_000), ok(30, 5_000_000, 10_000_000), ok(300.3, 105_840_000, 111_132_043)];

const evalCases = [
  {
    name: "the whole run passes",
    run: baseRun(),
    records: playing,
    r: "pass",
    checks: { worker: "pass", whole: "pass", jump: "pass", past: "pass" },
    text: /^Pass: the audio played the whole 15 min/,
    jump: { resumeS: 1.2, requestS: 0.3, targetLoaded: false },
  },
  {
    name: "the test jump takes 8 s to play again",
    run: baseRun({
      events: [...tus(0, 2, 300), testJump(300, 600), { type: "seeked", at: at(308), ct: 600 }, ...tus(308, 600, 900)],
      endCt: 2 + 900 + 298 - 8,
    }),
    records: playing,
    r: "fail",
    checks: { jump: "fail", whole: "pass" },
    text: /took 8\.0 s to play again/,
  },
  {
    name: "a 20 s stall after the jump fails the whole-time check",
    run: baseRun({
      events: [...tus(0, 2, 300), testJump(300, 600), { type: "seeked", at: at(301), ct: 600 }, ...tus(301, 600, 500), { type: "waiting", at: at(500.5) }, ...tus(520, 799.5, 900)],
      endCt: 799.5 + 380,
    }),
    records: playing,
    r: "fail",
    checks: { whole: "fail", jump: "pass" },
    text: /^Fail: it fell 19\.5 s behind the clock/,
  },
  {
    name: "the worker answered nothing while locked",
    run: baseRun(),
    records: [ok(-1, 0, 5_000_000)],
    r: "fail",
    checks: { worker: "fail" },
    text: /answered nothing/,
  },
  {
    name: "the whole track was fetched before the lock",
    run: baseRun(),
    records: [ok(-1, 0, TOTAL - 1)],
    r: "cant",
    checks: { worker: "cant", past: "cant" },
    text: /already fetched the whole track/,
  },
  {
    name: "answers only during an early return do not count as locked",
    run: baseRun({ spans: [{ from: at(0), to: at(100) }, { from: at(200), to: null }] }),
    records: [ok(-1, 0, 5_000_000), ok(150, 5_000_000, 10_000_000)],
    r: "fail",
    checks: { worker: "fail" },
  },
  {
    name: "no test jump was made",
    run: baseRun({ events: tus(0, 2, 900), endCt: 902 }),
    records: playing,
    r: "cant",
    checks: { jump: "cant", whole: "pass" },
    text: /made no test jump/,
  },
  {
    name: "the sound stopped early",
    run: baseRun({ reason: "stopped", endAt: at(420), endCt: 360, events: [...tus(0, 2, 300), testJump(300, 600), { type: "waiting", at: at(300.1) }] }),
    records: [ok(-1, 0, 5_000_000), ok(30, 5_000_000, 10_000_000)],
    r: "fail",
    text: /^Fail: the sound stopped by itself before the end/,
  },
  {
    name: "a reload long after the last stored position",
    run: baseRun({ reason: "reloaded", endAt: at(900), endCt: null, events: tus(0, 2, 200) }),
    records: playing,
    r: "fail",
    checks: { whole: "fail" },
    text: /closed the page about 3 min after/,
  },
  {
    name: "a reload just as the tester came back",
    run: baseRun({ reason: "reloaded", endAt: at(250), endCt: null, events: tus(0, 2, 245) }),
    records: playing.slice(0, 2),
    r: "cant",
    text: /reloaded when you came back/,
  },
  {
    name: "an expired link",
    run: baseRun(),
    records: [...playing, { at: at(400), asked: "bytes=0-", status: 403, error: "S3 answered 403 AccessDenied" }],
    r: "cant",
    text: /links expired/,
  },
  { name: "never locked", run: baseRun({ firstHiddenAt: null, spans: [] }), records: playing, r: "cant", text: /never locked/ },
];

for (const c of evalCases) {
  test(`evaluateRun: ${c.name}`, () => {
    const out = PM.evaluateRun(c.run, c.records, { limitS: 5 });
    assert.equal(out.r, c.r, out.text);
    for (const [key, want] of Object.entries(c.checks || {})) {
      assert.equal(out.checks[key].r, want, `${key}: ${out.checks[key].why || ""}`);
    }
    if (c.text) {
      assert.match(out.text, c.text);
    }
    for (const [key, want] of Object.entries(c.jump || {})) {
      if (typeof want === "number") {
        assert.ok(Math.abs(out.checks.jump[key] - want) < 0.051, `jump ${key}: got ${out.checks.jump[key]}, expected ${want}`);
      } else {
        assert.equal(out.checks.jump[key], want, `jump ${key}`);
      }
    }
    for (const [key] of PM.CHECKS) {
      assert.equal(typeof PM.checkDetail(key, out.checks[key]), "string");
    }
  });
}

test("the gap leaves out the test jump's own resume time, and only that", () => {
  const out = PM.evaluateRun(baseRun(), playing, { limitS: 5 });
  const w = out.checks.whole;
  assert.ok(Math.abs(w.jumpResumeS - 1.2) < 0.051, `the jump's own resume: ${w.jumpResumeS}`);
  assert.ok(Math.abs(w.gapS) < 0.051, `the gap without it: ${w.gapS}`);
  assert.ok(Math.abs(w.gapWithJumpS - 1.2) < 0.051, `the gap with it: ${w.gapWithJumpS}`);
});

const fetchedCases = [
  { name: "every byte, in two answers", records: [ok(-2, 0, 9_999_999), ok(-1, 10_000_000, TOTAL - 1)], whole: true },
  { name: "a hole in the middle", records: [ok(-2, 0, 9_999_999), ok(-1, 10_000_001, TOTAL - 1)], whole: false },
  { name: "the rest only after the hide", records: [ok(-2, 0, 9_999_999), ok(1, 10_000_000, TOTAL - 1)], whole: false },
  { name: "a rebuilt answer the player stopped reading", records: [ok(-1, 0, TOTAL - 1, { delivered: 3_000_000 })], whole: false },
  { name: "a failed answer", records: [ok(-1, 0, TOTAL - 1, { status: 502, error: "fetch failed" })], whole: false },
];

for (const c of fetchedCases) {
  test(`fetchedWhole: ${c.name}`, () => {
    assert.equal(PM.fetchedWhole(c.records, at(0)), c.whole);
  });
}
