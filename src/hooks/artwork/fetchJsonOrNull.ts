/**
 * Fetches a URL and parses the JSON response, returning null on any failure.
 * Used by artwork fetchers that gracefully degrade when external APIs are unavailable.
 */
export async function fetchJsonOrNull(
  url: string,
  source: string,
  onError: (message: string) => void = console.log,
): Promise<any | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      onError(`Failed to fetch from ${source} (${response.status})`);
      return null;
    }
    return await response.json();
  } catch {
    onError(`Error fetching from ${source}`);
    return null;
  }
}
