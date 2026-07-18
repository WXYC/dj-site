import { test, expect } from "../../fixtures/auth.fixture";
import { NowPlayingPage } from "../../pages/now-playing.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * NowPlaying Audio Stream E2E Tests
 *
 * Verifies that the live MP3 stream is not buffered until the user
 * explicitly presses play, and that pausing keeps the element intact so
 * playback can resume from the live edge.
 */
test.describe("NowPlaying audio stream", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });

  test("should not fetch audio stream on page load", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);
    const requests = nowPlaying.trackAudioRequests();

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");
    // Wait long enough for any preload to have started
    await page.waitForTimeout(2000);

    expect(requests).toHaveLength(0);
  });

  test("should have audio element with no src and preload=none", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    await nowPlaying.expectPreloadNone();
    await nowPlaying.expectNoSrc();
  });

  test("keeps the stream source while paused", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);
    await nowPlaying.blockAudioStream();

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    await nowPlaying.expectNoSrc();

    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();

    await nowPlaying.stop();
    // Pausing does not tear down the element; the source is retained so resume
    // can restart playback without rebuilding the audio graph.
    await nowPlaying.expectStreamSrc();
    await expect(nowPlaying.playButton).toBeVisible();
  });

  test("resumes playback on a second play after pausing", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);
    await nowPlaying.blockAudioStream();

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();
    await nowPlaying.stop();
    await nowPlaying.expectStreamSrc();

    // Second play reassigns src, re-running the media load algorithm to snap
    // back to the live edge; the pause button reappearing confirms resume.
    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();
    await expect(nowPlaying.pauseButton).toBeVisible();
  });
});
