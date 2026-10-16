import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A digital album is stored under the CD-R format, never the disc format (id 1). A fixture that pairs `digital: true` with `format_id: 1`
 * (or builds a digital `intakeItem({ digital: true })` and leaves the factory's default `format_id: 1` in place) models a record the server
 * never produces. A one-time grep cannot keep that true after merge, so this walks every source file under `tests/`
 * (the same approach as Backend-Service's `tests/integration/intake-seed.spec.js` walk, WXYC/Backend-Service#3113).
 *
 * Use `digitalItem()` from `@/tests/fakes/reviews` for a digital record; it sets the CD-R format id.
 */

const TESTS_DIR = path.resolve(__dirname, "..");
const SELF = path.resolve(__filename);

/** Every `.ts`, `.tsx` and `.js` file under `dir`, recursively. */
function sourceFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : sourceFilesUnder(full);
    }
    return /\.(tsx?|js)$/.test(entry.name) ? [full] : [];
  });
}

/** The `{ ... }` text that most tightly encloses `index`, with the text just before its opening brace; null at top level. */
function enclosingLiteral(source: string, index: number): { body: string; before: string } | null {
  let depth = 0;
  let open = -1;
  for (let i = index; i >= 0; i--) {
    if (source[i] === "}") {
      depth++;
    } else if (source[i] === "{") {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open < 0) {
    return null;
  }
  depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") {
      depth++;
    } else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return { body: source.slice(open, i + 1), before: source.slice(Math.max(0, open - 20), open) };
      }
    }
  }
  return null;
}

/** The offending object literals in `source`: each pairs `digital: true` with the disc format id, or is an `intakeItem({ digital: true })` argument with no `format_id`. */
export function digitalWithDiscFormat(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/\bdigital:\s*true\b/g)) {
    const literal = enclosingLiteral(source, match.index!);
    if (!literal) {
      continue;
    }
    const discFormat = /\bformat_id:\s*1\b(?!\d)/.test(literal.body);
    const factoryDefault = /\bintakeItem\(\s*$/.test(literal.before) && !/\bformat_id\b/.test(literal.body);
    if (discFormat || factoryDefault) {
      found.push(literal.body);
    }
  }
  return found;
}

describe("digital fixtures", () => {
  it.each([
    ["a literal with digital: true and format_id: 1", "const a = { id: 1, digital: true, format_id: 1 };", 1],
    ["format_id first, then digital: true", "const a = { format_id: 1, digital: true };", 1],
    ["intakeItem({ digital: true }) with the default format", "intakeItem({ digital: true, id: 3 });", 1],
    ["a literal with the CD-R format id", "const a = { digital: true, format_id: 7 };", 0],
    ["a literal with format_id: 12", "const a = { digital: true, format_id: 12 };", 0],
    ["intakeItem with an explicit non-disc format", "intakeItem({ digital: true, format_id: CDR_FORMAT.id });", 0],
    ["a disc with format_id: 1", "const a = { digital: false, format_id: 1 };", 0],
  ])("the scan %s", (_name, source, count) => {
    expect(digitalWithDiscFormat(source)).toHaveLength(count);
  });

  it("no fixture under tests/ pairs digital: true with format_id: 1", () => {
    const offenders = sourceFilesUnder(TESTS_DIR)
      .filter((file) => file !== SELF)
      .filter((file) => digitalWithDiscFormat(fs.readFileSync(file, "utf8")).length > 0)
      .map((file) => path.relative(TESTS_DIR, file));
    expect(offenders).toEqual([]);
  });
});
