import { Page, Locator, expect } from "@playwright/test";

const AUDIO_STREAM_URL = "audio-mp3.ibiblio.org";

/**
 * Page Object Model for the NowPlaying widget
 *
 * The NowPlaying widget appears in the Rightbar on dashboard pages.
 * It contains an audio player for the live WXYC stream and displays
 * the currently playing track.
 */
export class NowPlayingPage {
  readonly page: Page;

  // Audio element
  readonly audioElement: Locator;

  // Playback controls
  readonly playButton: Locator;
  readonly pauseButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Audio
    this.audioElement = page.locator("#now-playing-music");

    // Controls (same button, different aria-label based on state)
    this.playButton = page.getByRole("button", { name: "Play audio" });
    this.pauseButton = page.getByRole("button", { name: "Pause audio" });
  }

  // --- Audio stream routing ---

  /**
   * Block audio stream requests so tests don't download audio in CI.
   * Must be called before navigating to a page with the NowPlaying widget.
   */
  async blockAudioStream(): Promise<void> {
    await this.page.route(`**/${AUDIO_STREAM_URL}/**`, (route) => route.abort());
  }

  /**
   * Collect audio stream request URLs for assertion.
   * Returns the array that will be populated as requests are made.
   * Must be called before navigating to a page with the NowPlaying widget.
   */
  trackAudioRequests(): string[] {
    const requests: string[] = [];
    this.page.on("request", (req) => {
      if (req.url().includes(AUDIO_STREAM_URL)) {
        requests.push(req.url());
      }
    });
    return requests;
  }

  // --- Playback actions ---

  /**
   * Click play and simulate successful playback.
   *
   * In headless Chromium the actual audio.play() fails because there's
   * no real audio device / the stream is blocked. Dispatching a synthetic
   * `play` event flips the React isPlaying state so the pause button
   * appears, matching real-browser behavior.
   */
  async play(): Promise<void> {
    await this.playButton.click();
    await this.simulateAudioEvent("play");
  }

  /**
   * Click pause and simulate the pause event.
   *
   * audio.pause() on an element that was never truly playing won't fire
   * a native pause event. The synthetic event keeps the React state in
   * sync with the DOM.
   */
  async stop(): Promise<void> {
    await this.pauseButton.waitFor({ state: "visible" });
    await this.pauseButton.click();
    await this.simulateAudioEvent("pause");
  }

  // --- Assertions ---

  async expectNoSrc(): Promise<void> {
    const src = await this.audioElement.getAttribute("src");
    expect(src).toBeNull();
  }

  async expectStreamSrc(): Promise<void> {
    await expect(this.audioElement).toHaveAttribute("src", /audio-mp3\.ibiblio\.org/);
  }

  async expectPreloadNone(): Promise<void> {
    await expect(this.audioElement).toHaveAttribute("preload", "none");
  }

  // --- Internals ---

  private async simulateAudioEvent(event: "play" | "pause"): Promise<void> {
    await this.page.evaluate((evt) => {
      document.querySelector("#now-playing-music")?.dispatchEvent(new Event(evt));
    }, event);
  }
}
