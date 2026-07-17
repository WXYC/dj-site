// Summarizes per-route client JS from a `next build --experimental-analyze`
// run. Next 16's route table no longer prints First Load JS (the Size columns
// were dropped for both the Turbopack and webpack builders), so the committed
// bundle baseline (docs/plans/nextjs-modernization/bundle-baseline.md) is
// derived from the built-in analyzer's per-route data instead. Run via
// `npm run analyze`.
//
// Per route this sums the client output chunks only (`.next/static/**.js`);
// server/SSR chunks in the same graph are excluded. The total is every client
// chunk reachable from the route (a superset of strict first-load, since lazy
// chunks are included), which is stable enough to diff before/after a change
// as long as the same method is used on both sides.
import fs from "node:fs";
import path from "node:path";

const ANALYZE_DIR = path.join(".next", "diagnostics", "analyze", "data");

function findRouteDataFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRouteDataFiles(full));
    else if (entry.name === "analyze.data") out.push(full);
  }
  return out;
}

function routeOf(file) {
  const rel = path.relative(ANALYZE_DIR, path.dirname(file));
  return rel === "" ? "/" : `/${rel}`;
}

function clientJsBytes(file) {
  const buf = fs.readFileSync(file);
  const len = buf.readUInt32BE(0);
  const data = JSON.parse(buf.subarray(4, 4 + len).toString("utf8"));
  const perOutput = new Map();
  for (const part of data.chunk_parts) {
    const cur = perOutput.get(part.output_file_index) || { raw: 0, gz: 0 };
    cur.raw += part.size;
    cur.gz += part.compressed_size;
    perOutput.set(part.output_file_index, cur);
  }
  let raw = 0;
  let gz = 0;
  for (const [index, sums] of perOutput) {
    const name = data.output_files[index].filename;
    if (name.includes("/static/") && name.endsWith(".js")) {
      raw += sums.raw;
      gz += sums.gz;
    }
  }
  return { raw, gz };
}

if (!fs.existsSync(ANALYZE_DIR)) {
  console.error(
    `No analyzer output at ${ANALYZE_DIR}. Run \`next build --experimental-analyze\` first (or \`npm run analyze\`).`
  );
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const rows = findRouteDataFiles(ANALYZE_DIR)
  .map((file) => ({ route: routeOf(file), ...clientJsBytes(file) }))
  .sort((a, b) => a.route.localeCompare(b.route));

const width = Math.max(...rows.map((r) => r.route.length), "Route".length);
console.log(`${"Route".padEnd(width)}  ${"Client JS".padStart(12)}  ${"gzip".padStart(12)}`);
for (const row of rows) {
  console.log(`${row.route.padEnd(width)}  ${kb(row.raw).padStart(12)}  ${kb(row.gz).padStart(12)}`);
}
