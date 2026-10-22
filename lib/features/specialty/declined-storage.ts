const DECLINED_KEY = "wxyc_specialty_declined_shows";
// A set lasts hours; only the last few matter to a reload.
const REMEMBERED_SHOWS = 20;

/** Show ids whose question this browser answered "Not this time"; empty when storage is unavailable. */
export function readDeclinedShows(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DECLINED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export function rememberDeclinedShow(showId: number): void {
  try {
    const kept = [...readDeclinedShows(), showId].slice(-REMEMBERED_SHOWS);
    localStorage.setItem(DECLINED_KEY, JSON.stringify(kept));
  } catch {
    // Storage is a convenience: the worst case is asking again after a reload.
  }
}
