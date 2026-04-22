import { test, expect } from "../../fixtures/auth.fixture";
import { NowPlayingPage } from "../../pages/now-playing.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * NowPlaying Audio Stream E2E Tests
 *
 * Verifies that the live MP3 stream is not buffered until the user
 * explicitly presses play, and that stopping fully tears down the
 * connection.
 *
 * See: https://github.com/WXYC/dj-site/issues/374
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

  test("should set src on play and remove it on stop", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);
    await nowPlaying.blockAudioStream();

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    await nowPlaying.expectNoSrc();

    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();

    await nowPlaying.stop();
    await nowPlaying.expectNoSrc();
  });

  test("should reconnect stream on second play", async ({ page }) => {
    const nowPlaying = new NowPlayingPage(page);
    await nowPlaying.blockAudioStream();

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    // Play → stop
    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();
    await nowPlaying.stop();
    await nowPlaying.expectNoSrc();

    // Play again — should reconnect
    await nowPlaying.play();
    await nowPlaying.expectStreamSrc();
  });
});
