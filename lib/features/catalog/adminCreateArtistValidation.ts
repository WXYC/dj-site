/** Empty or non-numeric strings must not become 0 (Number("") === 0). */
export function parseRequiredPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  // Base-10 positive integers only — reject scientific/hex (Number("1e3") === 1000).
  if (trimmed === "" || !/^[1-9]\d*$/.test(trimmed)) return null;
  return Number(trimmed);
}
