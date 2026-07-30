// Regression guard: /dashboard/catalog's client-reference-manifests must
// reference no chunk that carries motion (framer-motion/motion-dom) or
// qrcode.react source. Both are heavy and both are already isolated by
// Turbopack's per-route code-splitting to the routes that actually import
// them (motion -> /dashboard/flowsheet's DnD; qrcode.react -> the six
// login/* route states) -- neither dependency is imported by anything on the
// catalog route today. That isolation is implicit: it falls out of Next's
// automatic chunking, not an explicit boundary in source. A future refactor
// that pulls a motion- or qrcode-using component into a module shared with
// catalog (a common layout piece, a shared hook, etc.) would silently drag
// the dependency back into catalog's first load with no compiler error and
// no obviously-related diff. This script makes that regression fail CI
// instead of shipping.
//
// Detection method: walk each catalog route's client-reference-manifest for
// the chunk filenames it references, then for each chunk resolve its real
// source map and sum the sourcesContent bytes whose source path matches a
// motion or qrcode marker. Chunk -> map linkage MUST go through the chunk's
// trailing `//# sourceMappingURL=` comment, not through string-substitution
// on the map filename: Turbopack emits orphan `.js.map` files with no `.js`
// chunk of the same name (observed: 67 of 68 map files in a real build have
// no same-named `.js` sibling), so a chunk's real map is whatever its own
// sourceMappingURL comment names, which is frequently a different basename.
//
// Usage: node scripts/check-catalog-first-load.mjs [buildDir]
// buildDir defaults to $CATALOG_GUARD_BUILD_DIR or ".next". Accepting an
// override (arg or env var) is what lets this run hermetically against a
// small fixture tree in tests, without a real `next build`.
import fs from "node:fs";
import path from "node:path";

const BYTE_THRESHOLD = 1000; // ignore incidental one-line re-exports; real usage attributes tens/hundreds of KB
const MOTION_MARKERS = ["motion-dom", "framer-motion", "/motion/"];
const QRCODE_MARKERS = ["qrcode"]; // matched case-insensitively
const CHUNK_REF_RE = /static\/chunks\/([A-Za-z0-9_-]+\.js)/g;

const baseDir = process.argv[2] || process.env.CATALOG_GUARD_BUILD_DIR || ".next";
const chunksDir = path.join(baseDir, "static", "chunks");

const MANIFESTS = [
  {
    label: "@modern",
    manifestPath: path.join(
      baseDir,
      "server",
      "app",
      "dashboard",
      "@modern",
      "catalog",
      "page_client-reference-manifest.js"
    ),
  },
  {
    label: "@classic",
    manifestPath: path.join(
      baseDir,
      "server",
      "app",
      "dashboard",
      "@classic",
      "catalog",
      "page_client-reference-manifest.js"
    ),
  },
];

// real chunk filename -> bytes of motion/qrcode source attributed to it via
// its source map's sourcesContent, or null if the chunk file itself is missing.
function chunkDeps(jsName) {
  const jsPath = path.join(chunksDir, jsName);
  if (!fs.existsSync(jsPath)) return null;

  const src = fs.readFileSync(jsPath, "utf8");
  const match = src.match(/sourceMappingURL=([^\s]+\.map)/);
  if (!match) return { motion: 0, qrcode: 0, resolvedMap: false };

  const mapPath = path.join(chunksDir, match[1].split("/").pop());
  if (!fs.existsSync(mapPath)) return { motion: 0, qrcode: 0, resolvedMap: false };

  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch {
    return { motion: 0, qrcode: 0, resolvedMap: false };
  }

  const content = map.sourcesContent || [];
  let motion = 0;
  let qrcode = 0;
  (map.sources || []).forEach((s, i) => {
    const bytes = (content[i] || "").length;
    if (MOTION_MARKERS.some((marker) => s.includes(marker))) motion += bytes;
    if (QRCODE_MARKERS.some((marker) => s.toLowerCase().includes(marker))) qrcode += bytes;
  });
  return { motion, qrcode, resolvedMap: content.length > 0 };
}

function checkManifest(label, manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, messages: [`${label}: catalog manifest not found at ${manifestPath}`] };
  }

  const text = fs.readFileSync(manifestPath, "utf8");
  const chunkNames = [...new Set([...text.matchAll(CHUNK_REF_RE)].map((m) => m[1]))];
  if (chunkNames.length === 0) {
    return {
      ok: false,
      messages: [
        `${label}: manifest at ${manifestPath} references zero chunks -- the chunk-reference regex is likely out of date with the manifest format`,
      ],
    };
  }

  const messages = [];
  let resolvedMaps = 0;
  for (const chunk of chunkNames) {
    const deps = chunkDeps(chunk);
    if (!deps) continue; // manifest references a chunk that no longer exists on disk; not this guard's concern
    if (deps.resolvedMap) resolvedMaps += 1;
    if (deps.motion > BYTE_THRESHOLD) {
      messages.push(
        `${label}: chunk ${chunk} carries ~${deps.motion} source bytes attributed to motion/framer-motion -- catalog's first load must not reach motion`
      );
    }
    if (deps.qrcode > BYTE_THRESHOLD) {
      messages.push(
        `${label}: chunk ${chunk} carries ~${deps.qrcode} source bytes attributed to qrcode.react -- catalog's first load must not reach qrcode.react`
      );
    }
  }

  if (messages.length === 0 && resolvedMaps === 0) {
    return {
      ok: false,
      messages: [
        `${label}: none of the ${chunkNames.length} referenced chunks resolved a source map with sourcesContent under ${chunksDir} -- is productionBrowserSourceMaps still enabled in next.config.mjs? Without it this guard cannot attribute chunk bytes to a dependency and would silently pass.`,
      ],
    };
  }

  if (messages.length > 0) {
    return { ok: false, messages };
  }

  return { ok: true, chunkCount: chunkNames.length, resolvedMaps };
}

if (!fs.existsSync(baseDir)) {
  console.error(`check-catalog-first-load: no build output at ${baseDir} -- run \`npm run build\` first.`);
  process.exit(1);
}
if (!fs.existsSync(chunksDir)) {
  console.error(
    `check-catalog-first-load: no chunk directory at ${chunksDir} -- the build may have failed or used a different output layout.`
  );
  process.exit(1);
}

let allOk = true;
const summaries = [];
for (const { label, manifestPath } of MANIFESTS) {
  const result = checkManifest(label, manifestPath);
  if (!result.ok) {
    allOk = false;
    for (const message of result.messages) {
      console.error(`check-catalog-first-load: ${message}`);
    }
  } else {
    summaries.push(`${label} (${result.chunkCount} chunks, ${result.resolvedMaps} source-mapped)`);
  }
}

if (!allOk) {
  process.exit(1);
}

console.log(`check-catalog-first-load: OK -- catalog first-load is clean of motion/qrcode.react in ${summaries.join(", ")}`);
