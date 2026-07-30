#!/usr/bin/env bats
#
# BATS tests for scripts/check-catalog-first-load.mjs.
#
# The guard asserts that /dashboard/catalog's client-reference-manifests
# (both @modern and @classic) reference no chunk carrying motion/framer-motion
# or qrcode.react source, using chunk -> source-map -> sourcesContent
# attribution. These tests build a small fixture tree shaped like the
# relevant slice of a real `.next` build (manifests + chunks + source maps)
# in a temp dir and point the script at it via its buildDir argument, so the
# suite is hermetic and needs no real `next build`.
#
# Usage: check-catalog-first-load.mjs [buildDir]
#
# Exit:
#   0 -- both catalog manifests resolved and neither references a
#        motion/qrcode-bearing chunk above the byte threshold
#   1 -- a manifest is missing, references zero chunks, resolves no source
#        maps, or references a chunk that exceeds the threshold for motion
#        or qrcode.react source bytes

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/check-catalog-first-load.mjs"

setup() {
    FIXTURE_DIR="$(mktemp -d)"
    mkdir -p "$FIXTURE_DIR/static/chunks"
}

teardown() {
    rm -rf "$FIXTURE_DIR"
}

# write_manifest EXPERIENCE CHUNK [CHUNK ...]
# Shapes a minimal page_client-reference-manifest.js for
# dashboard/@EXPERIENCE/catalog referencing the given chunk filenames, in the
# same "static/chunks/<name>.js" reference form Turbopack emits.
write_manifest() {
    local experience="$1"
    shift
    local dir="$FIXTURE_DIR/server/app/dashboard/@${experience}/catalog"
    mkdir -p "$dir"
    local chunks_json=""
    for chunk in "$@"; do
        chunks_json+="\"/_next/static/chunks/${chunk}\","
    done
    chunks_json="${chunks_json%,}"
    cat > "$dir/page_client-reference-manifest.js" <<EOF
globalThis.__RSC_MANIFEST=globalThis.__RSC_MANIFEST||{};
globalThis.__RSC_MANIFEST["/dashboard/@${experience}/catalog/page"]={"clientModules":{"mod":{"chunks":[${chunks_json}]}}};
EOF
}

# write_chunk CHUNK MAP
# Writes a real chunk file whose trailing sourceMappingURL comment names MAP
# -- the chunk/map filenames intentionally differ, mirroring the orphan-map
# linkage the real build exhibits (chunk name != map name).
write_chunk() {
    local chunk="$1" map="$2"
    cat > "$FIXTURE_DIR/static/chunks/$chunk" <<EOF
console.log("chunk");
//# sourceMappingURL=$map
EOF
}

# write_map MAP SOURCE_PATH CONTENT
# Writes a source map with one source entry and its sourcesContent.
write_map() {
    local map="$1" source_path="$2" content="$3"
    cat > "$FIXTURE_DIR/static/chunks/$map" <<EOF
{"version":3,"sources":["$source_path"],"sourcesContent":["$content"],"names":[],"mappings":""}
EOF
}

write_clean_chunk() {
    local chunk="$1" map="$2"
    write_chunk "$chunk" "$map"
    write_map "$map" "turbopack:///[project]/node_modules/redux/dist/redux.mjs" "export const x = 1;"
}

# write_tainted_chunk CHUNK MAP SOURCE_PATH
# Big enough sourcesContent (5000 bytes) to clear the guard's byte threshold.
write_tainted_chunk() {
    local chunk="$1" map="$2" source_path="$3"
    local big
    printf -v big 'x%.0s' $(seq 1 5000)
    write_chunk "$chunk" "$map"
    write_map "$map" "$source_path" "$big"
}

@test "exits 0 when both catalog manifests reference only clean chunks" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_manifest "modern" "clean1.js"
    write_manifest "classic" "clean1.js"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -eq 0 ]
    [[ "$output" == *"OK"* ]]
    [[ "$output" == *"@modern"* ]]
    [[ "$output" == *"@classic"* ]]
}

@test "exits non-zero and names the chunk when @modern references a motion chunk" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_tainted_chunk "motion1.js" "motionmap.js.map" "turbopack:///[project]/node_modules/motion-dom/dist/index.mjs"
    write_manifest "modern" "clean1.js" "motion1.js"
    write_manifest "classic" "clean1.js"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -ne 0 ]
    [[ "$output" == *"motion1.js"* ]]
    [[ "$output" == *"motion"* ]]
    [[ "$output" == *"@modern"* ]]
}

@test "exits non-zero and names the chunk when @classic references a qrcode.react chunk" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_tainted_chunk "qr1.js" "qrmap.js.map" "turbopack:///[project]/node_modules/qrcode.react/dist/index.mjs"
    write_manifest "modern" "clean1.js"
    write_manifest "classic" "clean1.js" "qr1.js"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -ne 0 ]
    [[ "$output" == *"qr1.js"* ]]
    [[ "$output" == *"qrcode"* ]]
    [[ "$output" == *"@classic"* ]]
}

@test "a sub-threshold incidental reference does not fail the guard" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_chunk "tiny1.js" "tinymap.js.map"
    write_map "tinymap.js.map" "turbopack:///[project]/node_modules/motion-dom/package.json" "name motion-dom version 1.0.0"
    write_manifest "modern" "clean1.js" "tiny1.js"
    write_manifest "classic" "clean1.js"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -eq 0 ]
}

@test "exits non-zero when the build directory does not exist" {
    run node "$SCRIPT_PATH" "$FIXTURE_DIR/does-not-exist"
    [ "$status" -ne 0 ]
    [[ "$output" == *"no build output"* ]]
}

@test "exits non-zero when the chunks directory is missing" {
    mkdir -p "$FIXTURE_DIR/server"
    rm -rf "$FIXTURE_DIR/static"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -ne 0 ]
    [[ "$output" == *"chunk directory"* ]]
}

@test "exits non-zero when a catalog manifest is missing (empty check must not read as a pass)" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_manifest "modern" "clean1.js"
    # No @classic manifest written.

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -ne 0 ]
    [[ "$output" == *"@classic"* ]]
    [[ "$output" == *"not found"* ]]
}

@test "exits non-zero when a manifest references chunks with no resolvable source map" {
    mkdir -p "$FIXTURE_DIR/server/app/dashboard/@modern/catalog"
    mkdir -p "$FIXTURE_DIR/server/app/dashboard/@classic/catalog"
    cat > "$FIXTURE_DIR/static/chunks/nomap.js" <<'EOF'
console.log("no source map at all");
EOF
    write_manifest "modern" "nomap.js"
    write_manifest "classic" "nomap.js"

    run node "$SCRIPT_PATH" "$FIXTURE_DIR"
    [ "$status" -ne 0 ]
    [[ "$output" == *"source map"* ]]
}

@test "respects the CATALOG_GUARD_BUILD_DIR env var when no argument is given" {
    write_clean_chunk "clean1.js" "clean1.js.map"
    write_manifest "modern" "clean1.js"
    write_manifest "classic" "clean1.js"

    CATALOG_GUARD_BUILD_DIR="$FIXTURE_DIR" run node "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
}
