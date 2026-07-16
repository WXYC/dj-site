/**
 * Cap total visible results at `total`, giving each group a base quota and
 * redistributing unused quota in group order (bin → rotation → catalog → lml).
 */
export function capResultGroups<T>(
  groups: T[][],
  total: number,
  base: number
): T[][] {
  const counts = groups.map((g) => Math.min(g.length, base));
  let used = counts.reduce((a, b) => a + b, 0);

  if (used > total) {
    let toTrim = used - total;
    for (let i = groups.length - 1; i >= 0 && toTrim > 0; i--) {
      const trim = Math.min(counts[i], toTrim);
      counts[i] -= trim;
      toTrim -= trim;
    }
    return groups.map((g, i) => g.slice(0, counts[i]));
  }

  let leftover = total - used;
  for (let i = 0; i < groups.length && leftover > 0; i++) {
    const extra = Math.min(groups[i].length - counts[i], leftover);
    counts[i] += extra;
    leftover -= extra;
  }
  return groups.map((g, i) => g.slice(0, counts[i]));
}
