/*
 * Page script for the service-worker spike. Throwaway; this branch never
 * merges. See spike/README.md.
 *
 * The <audio> element gets its src only after the worker is ready AND
 * controls this page: a load made earlier would go to the DJ site's host,
 * which serves no audio.
 */
"use strict";

(() => {
  const OVERRIDE_CACHE = "spike-url-overrides";
  const LOG_CACHE = "spike-request-log";
  const MIB = 1024 * 1024;
  const STEADY_AFTER_MS = 15000;
  const AFTER_SEEK_MS = 10000;
  const LOAD_ID = Math.random().toString(36).slice(2, 8);
  const PAGE_STARTED = Date.now();
  const MEDIA_EVENTS = [
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "play", "playing", "pause",
    "waiting", "stalled", "suspend", "seeking", "seeked", "ended", "error", "emptied", "abort",
  ];

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const state = {
    sources: [],
    controlled: false,
    sessions: [],
    nextSession: 1,
    current: null,
    records: new Map(),
    earlierStored: 0,
  };

  // ---- formatting ----------------------------------------------------------

  const zoned = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "short",
  });
  const clock = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const strip = (range) => String(range || "").replace(/^bytes[= ]/, "");
  const secs = (n) => (Number.isFinite(n) ? n.toFixed(1) : "-");
  const md = (v) => String(v === undefined || v === null ? "" : v).replace(/\|/g, "\\|").replace(/\n/g, " ");

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

  function parseUA(ua) {
    const pick = (re) => {
      const m = re.exec(ua);
      return m ? m[1] : null;
    };
    let browser = "Unknown";
    let version = "";
    const rules = [
      [/CriOS\/([\d.]+)/, "Chrome on iOS (WebKit)"],
      [/FxiOS\/([\d.]+)/, "Firefox on iOS (WebKit)"],
      [/EdgiOS\/([\d.]+)/, "Edge on iOS (WebKit)"],
      [/Edg\/([\d.]+)/, "Edge"],
      [/Firefox\/([\d.]+)/, "Firefox"],
      [/Chrome\/([\d.]+)/, "Chrome"],
      [/Version\/([\d.]+).*Safari\//, "Safari"],
    ];
    for (const [re, name] of rules) {
      const v = pick(re);
      if (v) {
        browser = name;
        version = v;
        break;
      }
    }
    let os = "";
    const ios = /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/.exec(ua);
    const mac = /Mac OS X ([\d_.]+)/.exec(ua);
    if (ios) {
      os = "iOS " + ios[1].replace(/_/g, ".");
    } else if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
      os = "iPadOS (desktop UA; fill in the version)";
    } else if (mac) {
      os = `macOS (UA says ${mac[1].replace(/_/g, ".")}; fill in the real version)`;
    } else if (/Android ([\d.]+)/.test(ua)) {
      os = "Android " + pick(/Android ([\d.]+)/);
    } else if (/Windows NT/.test(ua)) {
      os = "Windows";
    } else if (/Linux/.test(ua)) {
      os = "Linux";
    }
    return { browser, version, os };
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

  function bufferedText() {
    const b = audio.buffered;
    const parts = [];
    for (let i = 0; i < b.length; i++) {
      parts.push(`${b.start(i).toFixed(2)}-${b.end(i).toFixed(2)}`);
    }
    return parts.length ? parts.join(", ") + " s" : "(none)";
  }

  function renderStats() {
    const s = state.current;
    $("st-time").textContent = audio.currentTime.toFixed(2) + " s";
    $("st-duration").textContent = Number.isFinite(audio.duration) ? audio.duration.toFixed(2) + " s" : String(audio.duration);
    $("st-buffered").textContent = bufferedText();
    $("st-ahead").textContent = readAhead().toFixed(1) + " s";
    $("st-max").textContent = s ? s.maxAhead.toFixed(1) + " s" : "-";
    const err = audio.error ? `, error ${audio.error.code} ${audio.error.message || ""}` : "";
    $("st-state").textContent =
      `${audio.paused ? "paused" : "playing"}, readyState ${audio.readyState}, networkState ${audio.networkState}${err}`;
  }

  function tick() {
    renderStats();
    const s = state.current;
    if (!s) {
      return;
    }
    const now = Date.now();
    const ahead = readAhead();
    if (!audio.paused && audio.readyState >= 3) {
      s.samples.push({ at: now, ahead });
      s.maxAhead = Math.max(s.maxAhead, ahead);
    }
    // Only the latest seek is judged: a later seek supersedes an earlier one.
    const seek = s.seeks[s.seeks.length - 1];
    if (!seek) {
      return;
    }
    if (!seek.resumedAt && !audio.paused && audio.currentTime >= seek.target + 0.5 && audio.currentTime < seek.target + 60) {
      seek.resumedAt = now;
    }
    if (seek.seekedAt && seek.aheadAfter === null && now - seek.seekedAt >= AFTER_SEEK_MS) {
      seek.aheadAfter = ahead;
    }
  }

  function seek(fraction) {
    const s = state.current;
    if (!s || !Number.isFinite(audio.duration)) {
      return;
    }
    const target = audio.duration * fraction;
    s.seeks.push({
      label: fraction === 0 ? "back" : Math.round(fraction * 100) + "%",
      target,
      at: Date.now(),
      inBuffer: isBuffered(target),
      seekedAt: null,
      resumedAt: null,
      aheadAfter: null,
    });
    audio.currentTime = target;
  }

  function addEvent(type, detail) {
    const s = state.current;
    if (!s) {
      return;
    }
    const ev = {
      at: Date.now(),
      type,
      ct: audio.currentTime,
      ahead: readAhead(),
      detail: detail || "",
    };
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
    let detail = "";
    if (e.type === "error" && audio.error) {
      detail = `code ${audio.error.code} ${audio.error.message || ""}`.trim();
      if (s) {
        s.error = detail;
      }
    }
    if (e.type === "seeked" && s && s.seeks.length) {
      const last = s.seeks[s.seeks.length - 1];
      if (!last.seekedAt) {
        last.seekedAt = Date.now();
      }
    }
    if (e.type === "loadedmetadata") {
      document.querySelectorAll("#seeks button").forEach((b) => {
        b.disabled = false;
      });
    }
    addEvent(e.type, detail);
    renderStats();
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

  function selectedEntry() {
    return state.sources.find((t) => t.id === $("track").value) || null;
  }

  function startTrack() {
    const entry = selectedEntry();
    if (!entry || !state.controlled) {
      return;
    }
    // Never reused, so a late record from a cleared session cannot land in
    // a new one.
    const session = {
      n: state.nextSession++,
      entry,
      mode: $("mode").value,
      startedAt: Date.now(),
      events: [],
      seeks: [],
      samples: [],
      maxAhead: 0,
      error: null,
    };
    state.sessions.push(session);
    state.current = session;
    $("events").textContent = "";
    document.querySelectorAll("#seeks button").forEach((b) => {
      b.disabled = true;
    });
    const q = new URLSearchParams({ load: LOAD_ID, session: String(session.n), respond: session.mode });
    if (entry.kbps) {
      q.set("kbps", String(entry.kbps));
    }
    audio.loop = $("loop").checked;
    audio.src = `/spike/audio/${encodeURIComponent(entry.id)}?${q}`;
    audio.load();
    setMediaSession(entry);
    const chunk = chunkFor(entry);
    $("st-chunk").textContent = `${fmtBytes(chunk.bytes)} (${chunk.why})`;
    addEvent("src set", `${entry.label}, ${session.mode}`);
    renderLog();
  }

  // ---- the worker ----------------------------------------------------------

  function setStatus(text, kind) {
    const el = $("sw-status");
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
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

  function onWorkerMessage(e) {
    const data = e.data || {};
    if (data.type === "record") {
      upsert(data.record);
      renderLog();
    } else if (data.type === "pong") {
      setStatus(`Controlled. Worker instance ${data.instance}, started ${zoned.format(new Date(data.startedAt))}.`, "ok");
    }
  }

  function upsert(rec) {
    if (!rec || rec.load !== LOAD_ID) {
      return;
    }
    const prev = state.records.get(rec.id);
    state.records.set(rec.id, prev ? Object.assign(prev, rec) : rec);
  }

  // The worker stores every record in Cache Storage as well as posting it, so
  // a page that was asleep (backgrounded, phone locked) can catch up on wake.
  async function loadStoredLog() {
    if (!window.caches) {
      return;
    }
    const cache = await caches.open(LOG_CACHE);
    const keys = await cache.keys();
    let earlier = 0;
    for (const key of keys) {
      const res = await cache.match(key);
      const rec = res ? await res.json() : null;
      if (rec && rec.load === LOAD_ID) {
        upsert(rec);
      } else if (rec) {
        earlier += 1;
      }
    }
    state.earlierStored = earlier;
    renderLog();
  }

  function sessionRecords(session) {
    return [...state.records.values()]
      .filter((r) => r.session === String(session.n))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
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
        ((Date.parse(r.at) - s.startedAt) / 1000).toFixed(1),
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
    $("log-note").textContent =
      `Session ${s.n}: ${s.entry.label}, ${s.mode}. ${recs.length} request${recs.length === 1 ? "" : "s"} through the worker.${earlier}`;
  }

  // ---- results -------------------------------------------------------------

  function median(values) {
    if (!values.length) {
      return NaN;
    }
    const v = [...values].sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  function summarize(s) {
    const recs = sessionRecords(s);
    const reaches = recs.length
      ? `yes (first asked ${recs[0].asked})`
      : `no request reached the worker${s.error ? " (element error " + s.error + ")" : ""}`;

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
    const shortText = shorts ? `${followed} of ${shorts} short answers followed by a request for the next byte` : "no short answer yet";

    const seekText = s.seeks.length
      ? s.seeks
          .map((sk) => {
            const next = recs.find((r) => Date.parse(r.at) >= sk.at);
            const via = next ? "new range " + strip(next.asked) : sk.inBuffer ? "from buffer" : "no new request";
            const resumed = sk.resumedAt ? `resumed in ${((sk.resumedAt - sk.at) / 1000).toFixed(1)} s` : "did not resume";
            return `${sk.label}: ${sk.seekedAt ? "" : "no seeked event, "}${via}, ${resumed}`;
          })
          .join("; ")
      : "not tried";

    const steady = s.samples
      .filter((p) => {
        const before = s.seeks.filter((sk) => sk.at <= p.at).pop();
        return p.at - (before ? before.at : s.startedAt) >= STEADY_AFTER_MS;
      })
      .map((p) => p.ahead);
    const steadyText = steady.length ? `median ${secs(median(steady))}, max ${secs(Math.max(...steady))}` : "no steady samples";
    const afterText = s.seeks.length
      ? s.seeks.map((sk) => `${sk.label}: ${sk.aheadAfter === null ? "-" : secs(sk.aheadAfter)}`).join("; ")
      : "-";

    const instances = [...new Set(recs.map((r) => r.instance))];
    const errors = recs.filter((r) => r.error).length;
    const notes = `${s.mode} response; ${recs.length} requests; ${errors} errors; worker ids ${instances.join(", ") || "-"}`;
    return { recs, reaches, shortText, seekText, steadyText, afterText, notes };
  }

  function buildMarkdown() {
    const ua = navigator.userAgent;
    const p = parseUA(ua);
    const lines = [];
    lines.push(`### Spike results: ${p.browser} ${p.version}, ${p.os || "unknown OS"}`);
    lines.push("");
    lines.push(`- Page loaded ${zoned.format(PAGE_STARTED)}; copied ${zoned.format(Date.now())}`);
    lines.push(`- User agent: \`${ua}\``);
    lines.push("- A new worker id within one row means the browser stopped the worker and started it again.");
    lines.push("");
    lines.push(
      "| Browser | Version | OS | Format | Reaches worker (first incl.) | Short 206, then the rest | Seeks 10% / 50% / 90% / back | Read-ahead steady (s) | Read-ahead 10 s after seek (s) | Background / locked | Notes |"
    );
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
    const sums = state.sessions.map((s) => [s, summarize(s)]);
    for (const [s, x] of sums) {
      lines.push(
        `| ${md(p.browser)} | ${md(p.version)} | ${md(p.os)} | ${md(s.entry.format)} | ${md(x.reaches)} | ${md(x.shortText)} | ${md(x.seekText)} | ${md(x.steadyText)} | ${md(x.afterText)} | _fill in_ | ${md(x.notes)} |`
      );
    }
    for (const [s, x] of sums) {
      lines.push("");
      lines.push(`<details><summary>Session ${s.n}: ${s.entry.label}, ${s.mode} response, ${x.recs.length} requests</summary>`);
      lines.push("");
      lines.push("| # | t (s) | asked | sent | rule | status | returned | bytes | sent bytes | lookup ms | ms | worker | note |");
      lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
      x.recs.forEach((r, i) => {
        const rel = ((Date.parse(r.at) - s.startedAt) / 1000).toFixed(1);
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

  async function copyResults() {
    const text = buildMarkdown();
    const out = $("copy-out");
    out.value = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      $("copy-status").textContent = `Copied ${state.sessions.length} session(s). The text is also below.`;
    } catch (err) {
      out.focus();
      out.select();
      $("copy-status").textContent = "The browser refused the clipboard. Select the text below and copy it.";
    }
  }

  async function clearLog() {
    if (window.caches) {
      await caches.delete(LOG_CACHE);
    }
    state.records.clear();
    state.sessions = [];
    state.current = null;
    state.earlierStored = 0;
    startTrack();
  }

  // ---- track URLs ----------------------------------------------------------

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

  function renderUrlForm() {
    const form = $("urls");
    form.textContent = "";
    for (const entry of state.sources) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.htmlFor = "url-" + entry.id;
      label.textContent = `${entry.label} (${entry.file})`;
      const input = document.createElement("input");
      input.type = "url";
      input.id = "url-" + entry.id;
      input.placeholder = "https://... presigned GET";
      input.autocomplete = "off";
      input.spellcheck = false;
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "Save";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "quiet";
      clear.textContent = "Clear";
      const note = document.createElement("span");
      note.className = "muted";
      readOverride(entry.id).then((url) => {
        input.value = url;
        note.textContent = url ? "saved" : entry.url ? "using sources.json" : "no URL yet";
      });
      save.addEventListener("click", async () => {
        const value = input.value.trim();
        const problem = value ? checkUrl(value) : "";
        if (problem) {
          note.textContent = problem;
          return;
        }
        await writeOverride(entry.id, value);
        note.textContent = value ? "saved" : "cleared";
      });
      clear.addEventListener("click", async () => {
        input.value = "";
        await writeOverride(entry.id, "");
        note.textContent = "cleared";
      });
      row.append(label, input, save, clear, note);
      form.appendChild(row);
    }

    // One paste for all four, so a phone needs a single copy from the
    // bucket script's output.
    const bulk = document.createElement("div");
    bulk.className = "row";
    const label = document.createElement("label");
    label.htmlFor = "url-bulk";
    label.textContent = "Or paste the bucket script's output (one \"<id> <url>\" per line):";
    const area = document.createElement("textarea");
    area.id = "url-bulk";
    area.rows = 4;
    area.spellcheck = false;
    const saveAll = document.createElement("button");
    saveAll.type = "button";
    saveAll.textContent = "Save all";
    const note = document.createElement("span");
    note.className = "muted";
    saveAll.addEventListener("click", async () => {
      let saved = 0;
      for (const line of area.value.split(/\r?\n/)) {
        const m = /^\s*(\S+)\s+(https?:\/\/\S+)\s*$/.exec(line);
        if (m && state.sources.some((t) => t.id === m[1]) && !checkUrl(m[2])) {
          await writeOverride(m[1], m[2]);
          saved += 1;
        }
      }
      area.value = "";
      note.textContent = `${saved} saved`;
      renderUrlForm();
    });
    bulk.append(label, area, saveAll, note);
    form.appendChild(bulk);
  }

  // ---- start ---------------------------------------------------------------

  async function loadSources() {
    const res = await fetch("/spike/sources.json", { cache: "no-store" });
    const json = await res.json();
    state.sources = json.tracks || [];
    const picker = $("track");
    picker.textContent = "";
    for (const entry of state.sources) {
      const opt = document.createElement("option");
      opt.value = entry.id;
      opt.textContent = entry.label;
      picker.appendChild(opt);
    }
  }

  function bindControls() {
    MEDIA_EVENTS.forEach((type) => audio.addEventListener(type, onMediaEvent));
    audio.addEventListener("timeupdate", renderStats);
    audio.addEventListener("progress", renderStats);
    $("track").addEventListener("change", startTrack);
    $("mode").addEventListener("change", startTrack);
    $("loop").addEventListener("change", () => {
      audio.loop = $("loop").checked;
      addEvent("loop " + (audio.loop ? "on" : "off"));
    });
    document.querySelectorAll("#seeks button").forEach((b) => {
      b.addEventListener("click", () => seek(Number(b.dataset.seek)));
    });
    $("urls").addEventListener("submit", (e) => e.preventDefault());
    $("copy").addEventListener("click", copyResults);
    $("clear-log").addEventListener("click", clearLog);
    document.addEventListener("visibilitychange", () => {
      addEvent("page " + document.visibilityState);
      if (document.visibilityState === "visible") {
        loadStoredLog();
      }
    });
    ["pagehide", "pageshow", "freeze", "resume", "online", "offline"].forEach((type) => {
      window.addEventListener(type, () => addEvent("page " + type));
      document.addEventListener(type, () => addEvent("page " + type));
    });
    setInterval(tick, 500);
  }

  async function main() {
    const ua = navigator.userAgent;
    const p = parseUA(ua);
    $("ua").textContent = `${ua} (read as ${p.browser} ${p.version}, ${p.os || "unknown OS"})`;
    bindControls();
    if (!("serviceWorker" in navigator)) {
      setStatus("This browser has no service worker support here, so the spike cannot run.", "bad");
      return;
    }
    if (!window.caches) {
      setStatus("Cache Storage is unavailable (a private window?). Saved URLs and the stored log need it.", "bad");
      return;
    }
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    if (navigator.serviceWorker.startMessages) {
      navigator.serviceWorker.startMessages();
    }
    try {
      const sources = loadSources().then(renderUrlForm);
      setStatus("Registering /spike/sw.js with scope /spike/ ...");
      const reg = await navigator.serviceWorker.register("/spike/sw.js", { scope: "/spike/", updateViaCache: "none" });
      setStatus("Registered. Waiting for navigator.serviceWorker.ready ...");
      await navigator.serviceWorker.ready;
      setStatus("Ready. Waiting for the worker to control this page ...");
      const how = await waitForControl(reg);
      await sources;
      state.controlled = true;
      setStatus(`Controlled (${how}).`, "ok");
      navigator.serviceWorker.addEventListener("controllerchange", () => addEvent("controllerchange", "a new worker version took over"));
      navigator.serviceWorker.controller.postMessage({ type: "ping" });
      $("track").disabled = false;
      startTrack();
      loadStoredLog();
    } catch (err) {
      setStatus("Setup failed: " + (err && err.message ? err.message : String(err)), "bad");
    }
  }

  main();
})();
