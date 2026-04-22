import { test, expect } from "../../fixtures/auth.fixture";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");
const AUDIO_STREAM_URL = "audio-mp3.ibiblio.org";

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
    const audioRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes(AUDIO_STREAM_URL)) {
        audioRequests.push(req.url());
      }
    });

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");
    // Wait long enough for any preload to have started
    await page.waitForTimeout(2000);

    expect(audioRequests).toHaveLength(0);
  });

  test("should have audio element with no src and preload=none", async ({
    page,
  }) => {
    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    const audio = page.locator("#now-playing-music");
    await expect(audio).toHaveAttribute("preload", "none");
    // The audio element should not have a src attribute at all
    const src = await audio.getAttribute("src");
    expect(src).toBeNull();
  });

  test("should set src on play and remove it on stop", async ({ page }) => {
    // Block the actual stream so we don't download audio in CI
    await page.route(`**/${AUDIO_STREAM_URL}/**`, (route) => route.abort());

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    const audio = page.locator("#now-playing-music");
    const playButton = page.getByRole("button", { name: "Play audio" });

    // Before play: no src
    expect(await audio.getAttribute("src")).toBeNull();

    // Click play — src should be set on the audio element
    await playButton.click();
    await expect(audio).toHaveAttribute("src", /audio-mp3\.ibiblio\.org/);

    // The actual audio.play() fails because we aborted the route, so
    // isPlaying never becomes true and the button stays "Play audio".
    // Manually fire the play event to simulate successful playback so
    // the React state flips and the button becomes "Pause audio".
    await page.evaluate(() => {
      const el = document.querySelector("#now-playing-music");
      el?.dispatchEvent(new Event("play"));
    });

    // Now click pause — src should be removed
    const pauseButton = page.getByRole("button", { name: "Pause audio" });
    await pauseButton.click();
    await expect(audio).not.toHaveAttribute("src");
  });

  test("should reconnect stream on second play", async ({ page }) => {
    await page.route(`**/${AUDIO_STREAM_URL}/**`, (route) => route.abort());

    await page.goto("/dashboard/flowsheet");
    await page.waitForLoadState("domcontentloaded");

    const audio = page.locator("#now-playing-music");

    // Play → verify src set
    await page.getByRole("button", { name: "Play audio" }).click();
    await expect(audio).toHaveAttribute("src", /audio-mp3\.ibiblio\.org/);

    // Simulate successful playback, then stop
    await page.evaluate(() => {
      const el = document.querySelector("#now-playing-music");
      el?.dispatchEvent(new Event("play"));
    });
    await page.getByRole("button", { name: "Pause audio" }).click();
    await expect(audio).not.toHaveAttribute("src");

    // Play again — should reconnect
    await page.getByRole("button", { name: "Play audio" }).click();
    await expect(audio).toHaveAttribute("src", /audio-mp3\.ibiblio\.org/);
  });
});
