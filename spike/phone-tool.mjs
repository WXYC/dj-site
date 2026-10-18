#!/usr/bin/env node
/*
 * The Mac side of the phone lock test. Throwaway, like the rest of the
 * spike; spike/make-test-bucket.sh runs it.
 *
 *   node spike/phone-tool.mjs link --page <url> [--copy | --out <file>] < presigned.json
 *   node spike/phone-tool.mjs summary <dir>
 *
 * link reads spike/phone-presign.py's JSON on stdin, packs the three links
 * into the page's #k= fragment with public/spike/phone-math.js (the code the
 * page unpacks them with), checks that each link rebuilds byte for byte,
 * and with --copy puts the phone URL on the clipboard with pbcopy. It prints
 * only the run id, the URL's length and when the links expire, in Pacific
 * time; never the URL, which holds credentials. --out writes the URL to a
 * file instead, and only for links signed with placeholder credentials
 * (local tests).
 *
 * summary prints a short Pacific-time summary of a run's page.json and
 * worker.json, as `make-test-bucket.sh results` downloads them.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({ atob, btoa, TextEncoder, TextDecoder });
for (const name of ["lock-math.js", "phone-math.js"]) {
  const file = path.join(here, "..", "public", "spike", name);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const PM = context.SpikePhoneMath;

const say = (line) => process.stderr.write(line + "\n");
const out = (line) => process.stdout.write(line + "\n");

function die(message) {
  say(`phone-tool: ${message}`);
  process.exit(1);
}

const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

/** Epoch milliseconds (or an ISO string) as "2026-10-17 18:30:05 PDT". */
function pt(value) {
  const ms = typeof value === "string" ? Date.parse(value) : value;
  if (!Number.isFinite(ms)) {
    return "-";
  }
  const p = Object.fromEntries(pacific.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${p.timeZoneName}`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--copy") {
      args.copy = true;
    } else if (a === "--page" || a === "--out") {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}

function link(args) {
  if (!args.page) {
    die("--page <url> is required");
  }
  if (/#/.test(args.page)) {
    die("--page must have no fragment");
  }
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    die("no presigned links on stdin (did phone-presign.py fail?)");
  }
  const roles = ["t", "p", "w"];
  if (!input.run || !input.links || !roles.every((r) => input.links[r] && input.links[r].url)) {
    die("the input lacks the run id or one of the links t, p and w");
  }
  const packed = PM.packLinks(input.links, { run: input.run, expiresAt: input.expiresAt });
  const back = PM.unpackLinks(packed);
  for (const role of roles) {
    const a = input.links[role];
    const b = back.links[role];
    if (!b || b.url !== a.url || b.method !== a.method) {
      die(`link ${role} does not rebuild byte for byte from the payload; nothing copied`);
    }
  }
  if (back.run !== input.run) {
    die("the run id does not survive the payload; nothing copied");
  }
  const url = `${args.page}#k=${packed}`;
  if (args.copy) {
    const r = spawnSync("pbcopy", { input: url });
    if (r.status !== 0) {
      die("pbcopy failed; nothing copied");
    }
  }
  if (args.out) {
    if (!input.placeholder) {
      die("--out writes only links signed with placeholder credentials");
    }
    fs.writeFileSync(args.out, url, { mode: 0o600 });
  }
  const where = args.copy ? ", copied to the clipboard" : args.out ? `, written to ${args.out}` : ", not copied";
  const long = url.length > 2500 ? " (over 2,500: a simulator's openurl may cut it short)" : "";
  say(`run ${input.run}`);
  say(`link length ${url.length} characters${where}${long}`);
  const bySession = Number.isFinite(input.credentialsExpireAt) && input.credentialsExpireAt <= input.signedAt + input.requestedExpiresS;
  say(`links expire ${pt(input.expiresAt * 1000)}${bySession ? " (when this SSO role session ends)" : ""}${input.placeholder ? " (placeholder credentials: the links work nowhere)" : ""}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const MARKS = { pass: "pass", fail: "FAIL", cant: "can't tell" };

function summary(args) {
  const dir = args._[1];
  if (!dir) {
    die("summary needs the run's directory");
  }
  const page = readJson(path.join(dir, "page.json"));
  const worker = readJson(path.join(dir, "worker.json"));
  const run = (page && page.run) || (worker && worker.run) || path.basename(dir);
  out(`run ${run}`);
  if (page) {
    out(`page.json   uploaded ${pt(page.uploadedAt)} (${page.uploadReason}, upload ${page.uploadSeq}); final: ${page.final ? "yes" : "no"}; phase ${page.phase}${page.reason ? `, ${page.reason}` : ""}`);
  } else {
    out("page.json   not in the bucket (yet)");
  }
  if (worker) {
    out(`worker.json uploaded ${pt(worker.uploadedAt)} (${worker.reason}) by worker ${worker.instance}, started ${pt(worker.instanceStartedAt)}; ${worker.records.length} records`);
  } else {
    out("worker.json not in the bucket (yet)");
  }
  if (!page) {
    return;
  }
  const t = page.timeline || {};
  out("");
  out(page.verdict ? page.verdict.text : "no verdict yet: the run is not over");
  if (page.result && page.result.checks) {
    for (const [key, label] of PM.CHECKS) {
      const c = page.result.checks[key] || {};
      const detail = c.r === "pass" ? PM.checkDetail(key, c) : c.why || PM.checkDetail(key, c);
      out(`  ${(MARKS[c.r] || "-").padEnd(10)} ${label}: ${detail}`);
    }
    const w = page.result.checks.whole || {};
    const j = page.result.checks.jump || {};
    out(`  gap ${fmt(w.gapS)} s (${fmt(w.gapWithJumpS)} s counting the jump's own ${fmt(w.jumpResumeS)} s); jump resumed after ${fmt(j.resumeS)} s, first request after ${fmt(j.requestS)} s, target ${j.targetLoaded ? "" : "not "}loaded`);
  }
  out("");
  const rel = (ms) => (Number.isFinite(ms) && Number.isFinite(t.firstHiddenAt) ? ` (+${PM.fmtDuration(ms - t.firstHiddenAt)} after locking)` : "");
  out(`started   ${pt(t.startedAt)}`);
  out(`locked    ${pt(t.firstHiddenAt)}; hidden ${fmt(t.hiddenS)} s in all over ${(t.spans || []).length} span(s); ${(t.returns || []).length} early return(s)`);
  if (t.jump) {
    out(`test jump ${pt(t.jump.at)}${rel(t.jump.at)}: ${fmt(t.jump.fromS)} s to ${fmt(t.jump.targetS)} s${t.jump.skipped ? `, skipped: ${t.jump.skipped}` : ""}`);
  }
  out(`ended     ${pt(t.endAt)}${rel(t.endAt)}${page.reason ? ` (${page.reason})` : ""}`);
  out(`shown     ${t.shownAt ? pt(t.shownAt) : "not yet on the phone"}`);
  const end = Number.isFinite(t.endAt) ? t.endAt : Date.parse(page.uploadedAt);
  const count = (records) => {
    const hidden = (records || []).filter((r) => {
      const at = Date.parse(r.at);
      return at >= t.firstHiddenAt && at <= end && PM.inSpans(t.spans, at, end);
    });
    return { all: hidden.length, ok: hidden.filter((r) => (r.status === 206 || r.status === 200) && !r.error).length, ids: [...new Set(hidden.map((r) => r.instance))] };
  };
  if (Number.isFinite(t.firstHiddenAt)) {
    const fromWorker = worker ? count(worker.records) : null;
    const fromPage = count(page.workerRecords);
    out(
      `worker requests while locked: ${fromWorker ? `${fromWorker.ok} answered of ${fromWorker.all} in worker.json (worker ${fromWorker.ids.join(", ") || "-"})` : "worker.json missing"}; ${fromPage.ok} of ${fromPage.all} in page.json`,
    );
  }
  const uploads = page.workerUploads || [];
  if (uploads.length) {
    const failed = uploads.filter((u) => !u.ok);
    out(`worker uploads the page heard of: ${uploads.length}, ${failed.length} failed${failed.length ? ` (last: ${failed[failed.length - 1].error})` : ""}`);
  }
  if (page.pageUploads && page.pageUploads.lastError) {
    out(`page upload error before this one: ${page.pageUploads.lastError}`);
  }
  const test = (page.settings && page.settings.test) || {};
  if (test.autostart || test.fakeHidden || page.settings.muted) {
    out(`test run: ${[test.autostart && "autostart", test.fakeHidden && "fake hidden", page.settings.muted && "muted"].filter(Boolean).join(", ")}`);
  }
  out(`device    ${page.userAgent}`);
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : "-";
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (command === "link") {
  link(args);
} else if (command === "summary") {
  summary(args);
} else {
  die("usage: phone-tool.mjs link --page <url> [--copy | --out <file>] < presigned.json | phone-tool.mjs summary <dir>");
}
