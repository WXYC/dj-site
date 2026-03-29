import { getJWTToken } from "@/lib/features/authentication/client";

/**
 * Fetches album artwork from the Backend-Service artwork proxy.
 *
 * The proxy searches Discogs, Last.fm, and iTunes server-side, downloads the
 * image, runs NSFW classification, and returns raw image bytes. This avoids
 * exposing any API credentials to the client.
 *
 * @returns A blob URL pointing to the image data, or null if no artwork was found.
 */
export default async function getArtworkFromProxy({
  title,
  artist,
}: {
  title: string;
  artist: string;
}): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      artistName: artist,
      releaseTitle: title,
    });
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy/artwork/search?${params}`;

    const headers: HeadersInit = {};
    const token = await getJWTToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
