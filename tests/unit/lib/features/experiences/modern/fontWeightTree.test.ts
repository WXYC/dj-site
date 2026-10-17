import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODERN_DIR = path.resolve(process.cwd(), "src/components/experiences/modern");

// The modern theme loads Kanit at 400 and 500 only, so any other explicit weight
// renders a synthesized face. Each exemption names one file and the exact
// source line it allows (once per entry), with why that request is safe; any
// other unloaded weight in the same file still fails.
const EXEMPT: { file: string; line: string; why: string }[] = [
  {
    file: "catalog/Results/RotationLocationPill.tsx",
    line: 'fontWeight: "xl",',
    why: "Joy's xl is 500 in the modern theme.",
  },
  {
    file: "catalog/album/DiscogsMarkupRenderer.tsx",
    line: "return <strong key={key}>{token.content}</strong>;",
    why: "Renders Discogs bold markup, which is meant to be bold.",
  },
];

// An explicit weight is safe only when it is 400 or 500 (or a token the modern
// theme maps there: md, lg). Everything else -- another number, bold/bolder/
// lighter, and Joy's sm/xl/xl2/xl3 -- asks for a face the theme does not load.
const WEIGHT_DECLARATION =
  /font-?weight["']?\s*[:=]\s*(\{[^}]*\}|[^;,\n}]*(?:\n\s*[?:][^;,\n}]*)*)/gi;
const UNLOADED_VALUE =
  /\b(?!400\b|500\b)\d{3}\b|\b(?:bold|bolder|lighter)\b|(?<=["'`.])(?:sm|xl\d?)\b/;
const UNLOADED_TOKEN_ACCESS = /fontWeight[.-](?:sm|xl\d?)\b/g;
// A weight held outside a font-weight declaration (a helper's return value, a
// named constant) is still caught when its line names a weight.
const HELD_WEIGHT_LINE = /weight.*(?:\b[6-9]00\b|\bbold\b)|(?:\b[6-9]00\b|\bbold\b).*weight/i;
const BOLD_ELEMENT = /<(?:b|strong)(?=[\s>])/g;

// One entry per offending source line, so a repeated line counts each time.
function unloadedWeightLines(source: string): string[] {
  const starts = new Map<number, string>();
  const note = (index: number) => {
    const start = source.lastIndexOf("\n", index) + 1;
    const end = source.indexOf("\n", index);
    starts.set(start, source.slice(start, end === -1 ? undefined : end).trim());
  };
  const reachingIdentifiers = new Set<string>();
  for (const match of source.matchAll(WEIGHT_DECLARATION)) {
    if (UNLOADED_VALUE.test(match[1])) {
      note(match.index);
    }
    const identifier = match[1].match(/^\{?\s*([A-Za-z_]\w*)\s*\}?$/);
    if (identifier) {
      reachingIdentifiers.add(identifier[1]);
    }
  }
  for (const identifier of reachingIdentifiers) {
    const definition = new RegExp(`^.*\\b${identifier}\\s*[=:](?![=>])(.*)$`, "gm");
    for (const match of source.matchAll(definition)) {
      if (UNLOADED_VALUE.test(match[1])) {
        note(match.index);
      }
    }
  }
  for (const match of source.matchAll(/^.*$/gm)) {
    if (HELD_WEIGHT_LINE.test(match[0])) {
      note(match.index);
    }
  }
  for (const pattern of [UNLOADED_TOKEN_ACCESS, BOLD_ELEMENT]) {
    for (const match of source.matchAll(pattern)) {
      note(match.index);
    }
  }
  return [...starts.values()];
}

function offenders(file: string, source: string): string[] {
  const remaining = unloadedWeightLines(source);
  for (const exemption of EXEMPT.filter((e) => e.file === file)) {
    const at = remaining.indexOf(exemption.line);
    if (at !== -1) {
      remaining.splice(at, 1);
    }
  }
  return remaining;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("modern components' explicit font weights", () => {
  it("asks for no unloaded weight outside the exemption list", () => {
    const found = sourceFiles(MODERN_DIR).flatMap((full) => {
      const rel = path.relative(MODERN_DIR, full);
      return offenders(rel, readFileSync(full, "utf8")).map((line) => `${rel}: ${line}`);
    });

    expect(found).toEqual([]);
  });

  it("keeps every exemption pointed at a line that still exists", () => {
    for (const { file, line } of EXEMPT) {
      const source = readFileSync(path.join(MODERN_DIR, file), "utf8");
      expect(unloadedWeightLines(source), `${file}: ${line}`).toContain(line);
    }
  });
});

describe("the unloaded-weight scan", () => {
  it.each([
    ["a ternary's then-branch", 'fontWeight: active ? 700 : "md"'],
    ["a ternary's else-branch", 'fontWeight: active ? "md" : 700'],
    ["a kebab-case key in sx", '"& b": { "font-weight": 700 }'],
    ["a theme token in an else-branch", 'fontWeight: active ? "lg" : theme.vars.fontWeight.xl2'],
    ["a theme token read on its own", "const heavy = theme.fontWeight.xl3;"],
    ["a styled template literal", "const Row = styled.div`\n  font-weight: 700;\n`;"],
    ["a JSX numeric weight", "<Typography fontWeight={700}>x</Typography>"],
    ["a string number", 'fontWeight: "600"'],
    ["bold", 'fontWeight: "bold"'],
    ["Joy's sm (300)", 'fontWeight: "sm"'],
    ["Joy's xl", 'fontWeight: "xl"'],
    ["a responsive object", 'fontWeight: { xs: "md", md: 700 }'],
    ["a multi-line ternary", 'fontWeight: active\n  ? "md"\n  : 700,'],
    ["a helper's returned weight", "const sortedWeight = (c: string) => (c === sortBy ? 700 : 400);"],
    ["a named constant", "const HEAVY_WEIGHT = 900;"],
    ["a constant reaching a weight prop", "const HEAVY = 700;\n<Box fontWeight={HEAVY} />"],
    ["a named constant, lower-case", "const heavy = 700; // weight"],
    ["a bold word on a weight line", 'const weight = "bold";'],
    ["a CSS variable read", 'fontWeight: "var(--wxyc-fontWeight-xl2)"'],
    ["a CSS variable fallback read", 'const w = "var(--wxyc-fontWeight-xl3, 700)";'],
    ["a bare <b>", "<b>x</b>"],
    ["a bare <strong>", "<strong>x</strong>"],
  ])("flags %s", (_form, source) => {
    expect(unloadedWeightLines(source).length).toBeGreaterThan(0);
  });

  it.each([
    ['fontWeight: active ? "lg" : "md"'],
    ["fontWeight={400}"],
    ["fontWeight: theme.vars.fontWeight.md,"],
    ["fontWeight: { xs: 400, sm: 500 },"],
    ["const sortedWeight = (c: string) => (c === sortBy ? 500 : 400);"],
    ["const width = 700;"],
    ['fontWeight: "var(--wxyc-fontWeight-md)"'],
    ['"font-weight": 500'],
    ["<Box sx={{ width: 700 }}><br /><button>x</button></Box>"],
  ])("passes %s", (source) => {
    expect(unloadedWeightLines(source)).toEqual([]);
  });

  it("fails the catalog row's album title at 700, with no exemption to hide it", () => {
    const rel = "catalog/Results/Result.tsx";
    const source = readFileSync(path.join(MODERN_DIR, rel), "utf8");
    const mutant = source.replace('fontWeight={sortedWeight("album")}', "fontWeight={700}");

    expect(mutant).not.toBe(source);
    expect(offenders(rel, source)).toEqual([]);
    expect(offenders(rel, mutant)).toEqual(["fontWeight={700}"]);
  });

  it.each([
    [
      "sortedWeight's 500 -> 700",
      (source: string) => source.replace("sortBy === column ? 500 : 400", "sortBy === column ? 700 : 400"),
    ],
    [
      "a constant reaching fontWeight",
      (source: string) => `const HEAVY = 700;\n${source}\nconst x = <b2 fontWeight={HEAVY} />;`,
    ],
    [
      "the xl2 CSS variable",
      (source: string) => `${source}\nconst y = { fontWeight: "var(--wxyc-fontWeight-xl2)" };`,
    ],
  ])("fails the catalog row with %s", (_name, mutate) => {
    const rel = "catalog/Results/Result.tsx";
    const source = readFileSync(path.join(MODERN_DIR, rel), "utf8");
    const mutant = mutate(source);

    expect(mutant).not.toBe(source);
    expect(offenders(rel, source)).toEqual([]);
    expect(offenders(rel, mutant)).not.toEqual([]);
  });

  it.each(EXEMPT.map((e) => [e.file, e.line] as const))(
    "lets %s keep only its one exempt line, not a second use or another weight",
    (file, line) => {
      const source = readFileSync(path.join(MODERN_DIR, file), "utf8");

      expect(offenders(file, source)).toEqual([]);
      expect(offenders(file, `${source}\nfontWeight: 700,`)).toEqual(["fontWeight: 700,"]);
      expect(offenders(file, `${source}\n${line}`)).toEqual([line]);
    }
  );
});
