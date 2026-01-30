import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import getArtworkFromDiscogs from "./discogs-image";
import getArtworkFromItunes from "./itunes-image";
import getArtworkFromLastFM, { getSongInfoFromLastFM } from "./last-fm-image";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("artwork hooks", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCOGS_CONSUMER_KEY = "test-discogs-key";
    process.env.DISCOGS_CONSUMER_SECRET = "test-discogs-secret";
    process.env.LAST_FM_KEY = "test-lastfm-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe("getArtworkFromDiscogs", () => {
    it("should return cover image when found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ cover_image: "https://discogs.com/artwork.jpg" }],
          }),
      });

      const result = await getArtworkFromDiscogs({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBe("https://discogs.com/artwork.jpg");
    });

    it("should return null when no results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const result = await getArtworkFromDiscogs({
        title: "Unknown Album",
        artist: "Unknown Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getArtworkFromDiscogs({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await getArtworkFromDiscogs({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should encode artist and title in URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await getArtworkFromDiscogs({
        title: "Album With Spaces",
        artist: "Artist & Special",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("artist=Artist%20%26%20Special")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("title=Album%20With%20Spaces")
      );
    });

    it("should include API credentials in URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await getArtworkFromDiscogs({
        title: "Test",
        artist: "Test",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-discogs-key")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("secret=test-discogs-secret")
      );
    });
  });

  describe("getArtworkFromItunes", () => {
    it("should return high-res artwork URL when found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ artworkUrl100: "https://itunes.com/100x100bb.jpg" }],
          }),
      });

      const result = await getArtworkFromItunes({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBe("https://itunes.com/600x600bb.jpg");
    });

    it("should replace 100x100 with 600x600 in artwork URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                artworkUrl100:
                  "https://is1-ssl.mzstatic.com/image/100x100bb.jpg",
              },
            ],
          }),
      });

      const result = await getArtworkFromItunes({
        title: "Test",
        artist: "Test",
      });

      expect(result).toBe("https://is1-ssl.mzstatic.com/image/600x600bb.jpg");
    });

    it("should return null when no results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const result = await getArtworkFromItunes({
        title: "Unknown Album",
        artist: "Unknown Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null when artworkUrl100 is missing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [{ someOtherField: "value" }] }),
      });

      const result = await getArtworkFromItunes({
        title: "Test",
        artist: "Test",
      });

      expect(result).toBeNull();
    });

    it("should return null when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await getArtworkFromItunes({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await getArtworkFromItunes({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should combine title and artist in search term", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await getArtworkFromItunes({
        title: "My Album",
        artist: "My Artist",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("term=My%20Album%20My%20Artist")
      );
    });
  });

  describe("getArtworkFromLastFM", () => {
    it("should return largest image when found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            album: {
              image: [
                { size: "small", "#text": "https://lastfm.com/small.jpg" },
                { size: "medium", "#text": "https://lastfm.com/medium.jpg" },
                { size: "large", "#text": "https://lastfm.com/large.jpg" },
              ],
            },
          }),
      });

      const result = await getArtworkFromLastFM({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBe("https://lastfm.com/large.jpg");
    });

    it("should return null when no album data", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getArtworkFromLastFM({
        title: "Unknown Album",
        artist: "Unknown Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null when images array is empty", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            album: { image: [] },
          }),
      });

      const result = await getArtworkFromLastFM({
        title: "Test",
        artist: "Test",
      });

      expect(result).toBeNull();
    });

    it("should return null when images is not an array", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            album: { image: "not an array" },
          }),
      });

      const result = await getArtworkFromLastFM({
        title: "Test",
        artist: "Test",
      });

      expect(result).toBeNull();
    });

    it("should return null when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await getArtworkFromLastFM({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await getArtworkFromLastFM({
        title: "Test Album",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should include API key in URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await getArtworkFromLastFM({
        title: "Test",
        artist: "Test",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api_key=test-lastfm-key")
      );
    });

    it("should encode album and artist in URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await getArtworkFromLastFM({
        title: "Album With Spaces",
        artist: "Artist & Special",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("album=Album%20With%20Spaces")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("artist=Artist%20%26%20Special")
      );
    });
  });

  describe("getSongInfoFromLastFM", () => {
    it("should return song info when found", async () => {
      const mockTrackInfo = {
        track: {
          name: "Test Track",
          artist: { name: "Test Artist" },
          duration: "180000",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTrackInfo),
      });

      const result = await getSongInfoFromLastFM({
        title: "Test Track",
        artist: "Test Artist",
      });

      expect(result).toEqual(mockTrackInfo);
    });

    it("should return null when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getSongInfoFromLastFM({
        title: "Unknown Track",
        artist: "Unknown Artist",
      });

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await getSongInfoFromLastFM({
        title: "Test Track",
        artist: "Test Artist",
      });

      expect(result).toBeNull();
    });

    it("should call toast.error when response is not ok", async () => {
      const { toast } = await import("sonner");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await getSongInfoFromLastFM({
        title: "Test Track",
        artist: "Test Artist",
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Failed to fetch song info from Last.fm (500)"
      );
    });

    it("should call toast.error on network error", async () => {
      const { toast } = await import("sonner");

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await getSongInfoFromLastFM({
        title: "Test Track",
        artist: "Test Artist",
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Error fetching song info from Last.fm"
      );
    });

    it("should use track.getInfo method in URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await getSongInfoFromLastFM({
        title: "My Track",
        artist: "My Artist",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("method=track.getInfo")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("track=My%20Track")
      );
    });
  });
});
