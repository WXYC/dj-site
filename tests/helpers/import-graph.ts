import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as ts from "typescript";

/**
 * A static import-graph walker shared by every module-graph contract test
 * under tests/contract/: it parses each visited file with the TypeScript
 * compiler API (so a comment that happens to hold a quote or a semicolon
 * can't hide or fake an import) and follows every static import, re-export,
 * side-effect import, and `import()`/`require()` call, including
 * backtick-quoted specifiers. It fails closed on anything it can't prove
 * static and clean: a banned local module, a banned package root, a dynamic
 * import whose argument isn't a plain string literal, or a local specifier
 * (`@/...` or relative) that resolves to no file at all -- a walk that
 * silently dropped one of those edges would make its caller's
 * forbidden-import assertion pass vacuously for exactly the edge that
 * matters.
 *
 * Not exported from the helpers barrel: the node-tier specs that use this
 * import it directly, per the no-barrel rule for that tier.
 */

const ROOT = process.cwd();

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
    RESOLVE_CANDIDATES(base).find(
      (c) => existsSync(c) && statSync(c).isFile()
    ) ?? null
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
function classifySpecifier(
  specifier: string,
  fromFile: string
): SpecifierClassification {
  const resolved = resolveLocalFile(specifier, fromFile);
  if (resolved) return { kind: "local", file: resolved };
  const declaredLocal = specifier.startsWith("@/") || specifier.startsWith(".");
  return declaredLocal ? { kind: "unresolved" } : { kind: "external" };
}

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
// `ts.isStringLiteralLike` covers both quoted and backtick-quoted
// (no-substitution template) literals, so `import(`@/foo`)` is followed the
// same as `import("@/foo")`.
function collectSpecifiers(
  file: string,
  source: string
): { literals: string[]; hasUnresolvedDynamicImport: boolean } {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file)
  );
  const literals: string[] = [];
  let hasUnresolvedDynamicImport = false;

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const text = literalText(node.moduleSpecifier);
      if (text !== null) literals.push(text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const text = literalText(node.moduleSpecifier);
      if (text !== null) literals.push(text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const text = literalText(node.moduleReference.expression);
      if (text !== null) literals.push(text);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
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

export type ImportGraphResult = {
  files: string[];
  banned: string[];
  dynamic: string[];
  unresolved: string[];
};

// `bannedLocalSpecifiers` are resolved to files once, up front, so the walk
// compares files rather than specifier text: a banned module reached by a
// relative path or an explicit extension resolves to the same file a
// `@/`-prefixed import would, and is caught the same way.
// `bannedPackageSpecifiers` are package roots (e.g. "motion"), matched by
// specifier text since an npm package has no local file to resolve to --
// banning a root also bans every subpath under it.
export function walkImportGraph(
  entryFile: string,
  bannedLocalSpecifiers: string[],
  bannedPackageSpecifiers: string[] = []
): ImportGraphResult {
  const bannedLocalFiles = new Set(
    bannedLocalSpecifiers.map((specifier) => {
      const resolved = resolveLocalFile(specifier, join(ROOT, entryFile));
      if (!resolved) {
        throw new Error(
          `Banned specifier "${specifier}" no longer resolves to a file -- update the banned-specifier list.`
        );
      }
      return resolved;
    })
  );

  function isBannedPackageSpecifier(specifier: string): boolean {
    return bannedPackageSpecifiers.some(
      (b) => specifier === b || specifier.startsWith(`${b}/`)
    );
  }

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
    const { literals, hasUnresolvedDynamicImport } = collectSpecifiers(
      join(ROOT, file),
      source
    );

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

      if (bannedLocalFiles.has(classification.file)) {
        banned.push(`${file} -> ${specifier}`);
        continue;
      }
      queue.push(classification.file.slice(ROOT.length + 1));
    }
  }

  return { files: [...visited], banned, dynamic, unresolved };
}
