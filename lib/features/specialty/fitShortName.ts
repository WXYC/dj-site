/** Share of the tile's width held back as padding on each side. */
export const TILE_PADDING_FRACTION = 0.1;

/**
 * Widest a bold glyph is taken to be, in ems. A deliberate over-estimate for
 * the bold sans stack, so a fitted name has slack rather than clipping; the
 * jsdom test environment cannot measure text, so the rule is arithmetic.
 */
export const GLYPH_WIDTH_EM = 0.7;

/** The tile's type starts at this share of its side and only steps down. */
const MAX_FONT_FRACTION = 0.32;

export interface FittedShortName {
  /** One or two lines, broken on word boundaries only. */
  lines: string[];
  fontSize: number;
}

/**
 * Lays a program's short name out on a square tile so it never clips: wraps to
 * at most two lines on word boundaries (the split with the shortest widest
 * line), then steps the font size down from `size * 0.32` until the widest
 * line fits inside the padded tile. A single long word cannot wrap, so it takes
 * the smaller size instead.
 */
export function fitShortName(name: string, size: number): FittedShortName {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let lines = [words.join(" ")];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const widest = Math.max(...candidate.map((l) => l.length));
    if (widest < Math.max(...lines.map((l) => l.length))) {
      lines = candidate;
    }
  }
  const widest = Math.max(1, ...lines.map((l) => l.length));
  const available = size * (1 - 2 * TILE_PADDING_FRACTION);
  const fontSize = Math.min(
    size * MAX_FONT_FRACTION,
    available / (widest * GLYPH_WIDTH_EM),
  );
  return { lines, fontSize };
}
