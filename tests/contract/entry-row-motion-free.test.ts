import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as ts from "typescript";

/**
 * EntryRow.tsx exists so a motion-free surface can render the live row's
 * `<tr>` presentation without pulling `motion/react` or any live-show hook
 * or API module into its bundle. A later edit that reaches for one of those
 * from inside EntryRow.tsx -- even transitively, even via a dynamic
 * `import()` this walk can't resolve a destination for -- silently reopens
 * that bundle, so the walk fails closed on anything it can't prove static
 * and clean: a banned import, a dynamic import it can't resolve, or a local
 * import (`@/...` or relative) that resolves to no file at all.
 */

const ENTRY_FILE = "src/components/experiences/modern/flowsheet/Entries/EntryRow.tsx";
const ROOT = process.cwd();

// Local modules EntryRow.tsx's module graph may never reach, named however a
// specifier might spell them (the `@/` alias, a relative path, baseUrl's bare
// form, or with an explicit extension) -- matched by resolved file, not text.
const BANNED_LOCAL_SPECIFIERS = [
  "@/src/hooks/flowsheetHooks",
  "@/src/hooks/authenticationHooks",
  "@/lib/features/bin/api",
  "@/lib/features/lml/api",
];

// Motion's own package entry points, plus the two packages that hold its
// engine and are directly importable rather than reachable only as a
// subpath of motion/framer-motion. Banning a package root also bans every
// subpath under it (motion/react, motion/react-client, motion/react-m,
// motion/react-mini, motion-dom/..., motion-utils/..., ...), so these four
// roots cover every way EntryRow.tsx could reopen the motion bundle.
const BANNED_PACKAGE_SPECIFIERS = ["motion", "framer-motion", "motion-dom", "motion-utils"];

const RESOLVE_CANDIDATES = (p: string) => [
  p,
  `${p}.ts`,
  `${p}.tsx`,
  `${p}.js`,
  `${p}.jsx`,
  `${p}.mjs`,
  join(p, "index.ts"),
  join(p, "index.tsx"),
  join(p, "index.js"),
  join(p, "index.jsx"),
];

// Resolves a specifier to a file on disk, or null if nothing under that name
// is a file -- a directory with no index candidate is deliberately not a
// match (`existsSync` alone would say yes and the caller's `readFileSync`
// would throw `EISDIR`). `@/` resolves against the repo root, a leading `.`
// resolves against `fromFile`'s directory, and anything else is resolved
// against the repo root too: tsconfig's `baseUrl: "."` makes a bare
// specifier like `src/hooks/flowsheetHooks` just as valid an import as its
// `@/`-prefixed spelling, so treating it as local here is what classifies it
// correctly rather than letting it fall through as an external package.
function resolveLocalFile(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : join(ROOT, specifier);
  return (
    RESOLVE_CANDIDATES(base).find((c) => existsSync(c) && statSync(c).isFile()) ?? null
  );
}

type SpecifierClassification =
  | { kind: "local"; file: string }
  | { kind: "external" }
  | { kind: "unresolved" };

// A specifier spelled with `@/` or a leading `.` declares itself local, so a
// failed resolution for one of those is a broken import, not a package this
// walk should ignore. A bare specifier that fails to resolve under baseUrl is
// assumed to be an external package (react, @mui/joy, node:fs, ...) -- this
// walk has no package.json cross-check, so that assumption is the walk's one
// blind spot, not a license to skip resolving what baseUrl does make local.
function classifySpecifier(specifier: string, fromFile: string): SpecifierClassification {
  const resolved = resolveLocalFile(specifier, fromFile);
  if (resolved) return { kind: "local", file: resolved };
  const declaredLocal = specifier.startsWith("@/") || specifier.startsWith(".");
  return declaredLocal ? { kind: "unresolved" } : { kind: "external" };
}

function isBannedPackageSpecifier(specifier: string): boolean {
  return BANNED_PACKAGE_SPECIFIERS.some(
    (b) => specifier === b || specifier.startsWith(`${b}/`)
  );
}

// Resolved once, up front, so the walk compares files rather than specifier
// text: a banned module reached by a relative path or an explicit extension
// resolves to the same file a `@/`-prefixed import would, and is caught the
// same way.
const BANNED_LOCAL_FILES = new Set(
  BANNED_LOCAL_SPECIFIERS.map((specifier) => {
    const resolved = resolveLocalFile(specifier, join(ROOT, ENTRY_FILE));
    if (!resolved) {
      throw new Error(
        `Banned specifier "${specifier}" no longer resolves to a file -- update BANNED_LOCAL_SPECIFIERS.`
      );
    }
    return resolved;
  })
);

function scriptKindFor(file: string): ts.ScriptKind {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function literalText(expr: ts.Expression): string | null {
  return ts.isStringLiteralLike(expr) ? expr.text : null;
}

// Walks the file's AST -- rather than scanning its text with a regex -- so a
// comment that happens to hold a quote or a semicolon (`// drag surface;
// see "wrapper"`) can sit anywhere inside an import clause without hiding
// the import it comments on: comments are trivia the parser discards before
// an import/export/call node is ever produced. Collects every static import
// (including type-only, side-effect-only, and re-export forms) and every
// `import(...)` / `require(...)` call; a call whose argument isn't a plain
// string literal (a computed or templated specifier this walk can't resolve
// a destination for) is reported as unresolved instead of silently skipped.
function collectSpecifiers(
  file: string,
  source: string
): { literals: string[]; hasUnresolvedDynamicImport: boolean } {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const literals: string[] = [];
  let hasUnresolvedDynamicImport = false;

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const text = literalText(node.moduleSpecifier);
      if (text !== null) literals.push(text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const text = literalText(node.moduleSpecifier);
      if (text !== null) literals.push(text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const text = literalText(node.moduleReference.expression);
      if (text !== null) literals.push(text);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) {
        const [arg] = node.arguments;
        const text = arg ? literalText(arg) : null;
        if (text !== null) {
          literals.push(text);
        } else {
          hasUnresolvedDynamicImport = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { literals, hasUnresolvedDynamicImport };
}

function walk(
  entryFile: string
): { files: string[]; banned: string[]; dynamic: string[]; unresolved: string[] } {
  const visited = new Set<string>();
  const banned: string[] = [];
  const dynamic: string[] = [];
  const unresolved: string[] = [];
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(join(ROOT, file), "utf8");
    const { literals, hasUnresolvedDynamicImport } = collectSpecifiers(join(ROOT, file), source);

    if (hasUnresolvedDynamicImport) {
      dynamic.push(file);
    }

    for (const specifier of literals) {
      if (isBannedPackageSpecifier(specifier)) {
        banned.push(`${file} -> ${specifier}`);
        continue;
      }

      const classification = classifySpecifier(specifier, join(ROOT, file));
      if (classification.kind === "unresolved") {
        unresolved.push(`${file} -> ${specifier}`);
        continue;
      }
      if (classification.kind === "external") continue;

      if (BANNED_LOCAL_FILES.has(classification.file)) {
        banned.push(`${file} -> ${specifier}`);
        continue;
      }
      queue.push(classification.file.slice(ROOT.length + 1));
    }
  }

  return { files: [...visited], banned, dynamic, unresolved };
}

describe("EntryRow module graph (motion-free contract)", () => {
  it("imports nothing banned, statically or dynamically, from its own or any transitive import", () => {
    const { banned, dynamic, unresolved, files } = walk(ENTRY_FILE);

    expect(banned).toEqual([]);
    expect(dynamic).toEqual([]);
    expect(unresolved).toEqual([]);

    // A walk that stopped visiting imports would leave every list above
    // empty too, so this also proves it actually visited EntryRow's own
    // local imports rather than nothing at all.
    expect(files).toContain(ENTRY_FILE);
    expect(files).toContain("lib/features/flowsheet/types.ts");
    expect(files).toContain("lib/features/schedule-week/showUrl.ts");
  });
});
