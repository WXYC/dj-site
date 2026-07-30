// Regression guard: /dashboard/catalog's client-reference-manifests must
// reference no chunk that carries a heavy dependency belonging to another
// route -- motion (framer-motion/motion-dom/motion-utils, the flowsheet DnD),
// qrcode.react (the six login/* states), or the posthog-js library. None is
// reachable from catalog's first load today: motion and qrcode.react aren't
// imported by anything on the catalog route, and posthog-js is loaded only via
// a dynamic import() inside the first-party lib/posthog.ts adapter, never
// statically. That isolation is implicit -- it falls out of Next/Turbopack's
// automatic chunking and the adapter's dynamic import, not an explicit boundary
// in source. A future refactor that pulls a motion- or qrcode-using component
// into a module shared with catalog, or turns the posthog-js dynamic import
// into a static one (or adds any new static importer), would silently drag the
// dependency into catalog's first load with no compiler error and no obviously
// related diff. posthog-js in particular is one edit away and would add ~1 MB.
// This script makes that regression fail CI instead of shipping.
//
// Detection method: walk each catalog route's client-reference-manifest for the
// chunk filenames it references, then for each chunk resolve its real source map
// and sum the sourcesContent bytes whose source path matches a dependency
// marker. Three correctness details:
//   1. Chunk -> map linkage MUST go through the chunk's trailing
//      `//# sourceMappingURL=` comment, not string-substitution on the map
//      filename: Turbopack emits orphan `.js.map` files with no `.js` chunk of
//      the same name (nearly every map file in a real build has no same-named
//      `.js` sibling), so a chunk's real map is whatever its own
//      sourceMappingURL comment names, frequently a different basename.
//   2. Markers are scoped to `node_modules/<pkg>` so a first-party file whose
//      path merely contains the package name -- the login QRCodeForm, or the
//      lib/posthog.ts adapter itself -- is never mistaken for the library.
//   3. If a source path matches a marker but its sourcesContent entry is null
//      or empty, the guard cannot measure it and FAILS LOUDLY rather than
//      scoring it zero. Bundlers sometimes drop sourcesContent for node_modules;
//      scoring a marker match as zero bytes would let exactly the regression
//      this guards against pass silently.
//
// Usage: node scripts/check-catalog-first-load.mjs [buildDir]
// buildDir defaults to $CATALOG_GUARD_BUILD_DIR or ".next". Accepting an
// override (arg or env var) is what lets this run hermetically against a small
// fixture tree in tests, without a real `next build`.
import fs from "node:fs";
import path from "node:path";

const BYTE_THRESHOLD = 1000; // ignore incidental one-line re-exports; real usage attributes tens/hundreds of KB

// Each dependency's markers are node_modules-scoped path fragments; a source
// whose path contains any marker is attributed to that dependency. "qrcode"
// (no trailing slash) covers both node_modules/qrcode.react and its
// node_modules/qrcode dependency.
const DEPS = [
  {
    key: "motion",
    label: "motion/framer-motion",
    markers: [
      "node_modules/motion-dom",
      "node_modules/framer-motion",
      "node_modules/motion/",
      "node_modules/motion-utils",
    ],
  },
  { key: "qrcode", label: "qrcode.react", markers: ["node_modules/qrcode"] },
  { key: "posthog", label: "posthog-js", markers: ["node_modules/posthog-js"] },
];

// The client-reference-manifest lists chunks as "static/chunks/<name>.js". This
// charset tracks Turbopack's current chunk-naming scheme; if a future Turbopack
// emits differently-named chunks, the "references zero chunks" branch below
// trips rather than silently skipping them.
const CHUNK_REF_RE = /static\/chunks\/([A-Za-z0-9_-]+\.js)/g;

const baseDir = process.argv[2] || process.env.CATALOG_GUARD_BUILD_DIR || ".next";
const chunksDir = path.join(baseDir, "static", "chunks");

function manifestPathFor(experience) {
  return path.join(
    baseDir,
    "server",
    "app",
    "dashboard",
    `@${experience}`,
    "catalog",
    "page_client-reference-manifest.js"
  );
}
const MANIFESTS = [
  { label: "@modern", manifestPath: manifestPathFor("modern") },
  { label: "@classic", manifestPath: manifestPathFor("classic") },
];

function zeroBytes() {
  const bytes = {};
  for (const dep of DEPS) bytes[dep.key] = 0;
  return bytes;
}

// real chunk filename -> per-dependency attributed bytes, plus any marker
// matches whose size could not be measured (null/empty sourcesContent), or null
// if the chunk file itself is missing on disk.
function chunkDeps(jsName) {
  const jsPath = path.join(chunksDir, jsName);
  if (!fs.existsSync(jsPath)) return null;

  const unresolved = { bytes: zeroBytes(), unverifiable: [], resolvedMap: false };

  const src = fs.readFileSync(jsPath, "utf8");
  const match = src.match(/sourceMappingURL=([^\s]+\.map)/);
  if (!match) return unresolved;

  const mapPath = path.join(chunksDir, match[1].split("/").pop());
  if (!fs.existsSync(mapPath)) return unresolved;

  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch {
    return unresolved;
  }

  const content = map.sourcesContent || [];
  const bytes = zeroBytes();
  const unverifiable = [];
  (map.sources || []).forEach((s, i) => {
    for (const dep of DEPS) {
      if (!dep.markers.some((marker) => s.includes(marker))) continue;
      const c = content[i];
      if (c === null || c === undefined || c === "") {
        unverifiable.push(dep.label);
      } else {
        bytes[dep.key] += c.length;
      }
    }
  });
  return { bytes, unverifiable, resolvedMap: content.length > 0 };
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
  let chunksOnDisk = 0;
  let resolvedMaps = 0;
  for (const chunk of chunkNames) {
    const deps = chunkDeps(chunk);
    if (!deps) continue; // manifest references a chunk that no longer exists on disk
    chunksOnDisk += 1;
    if (deps.resolvedMap) resolvedMaps += 1;
    for (const dep of DEPS) {
      if (deps.bytes[dep.key] > BYTE_THRESHOLD) {
        messages.push(
          `${label}: chunk ${chunk} carries ~${deps.bytes[dep.key]} source bytes attributed to ${dep.label} -- catalog's first load must not reach ${dep.label}`
        );
      }
    }
    for (const depLabel of new Set(deps.unverifiable)) {
      messages.push(
        `${label}: chunk ${chunk} has a ${depLabel} source with null/empty sourcesContent -- cannot verify its size, so failing rather than scoring it zero (the bundler may be dropping node_modules sourcesContent, which would let a real regression pass silently)`
      );
    }
  }

  if (messages.length === 0 && chunksOnDisk === 0) {
    return {
      ok: false,
      messages: [
        `${label}: manifest references ${chunkNames.length} chunks but none exist on disk under ${chunksDir} -- the build output is incomplete or laid out differently than expected`,
      ],
    };
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

console.log(
  `check-catalog-first-load: OK -- catalog first-load is clean of motion/qrcode.react/posthog-js in ${summaries.join(", ")}`
);
