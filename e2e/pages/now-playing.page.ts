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
   * Click play and wait for the pause button to appear.
   *
   * In headless Chromium the real audio.play() rejects (no audio device)
   * and the browser may asynchronously fire a "pause" event that races
   * with React's state update, leaving isPlaying indeterminate. We stub
   * audio.play() to dispatch a "play" event and resolve immediately,
   * then wait for React to re-render before returning.
   */
  async play(): Promise<void> {
    await this.page.evaluate(() => {
      const audio = document.querySelector("#now-playing-music") as HTMLAudioElement;
      if (audio) {
        audio.play = () => {
          audio.dispatchEvent(new Event("play"));
          return Promise.resolve();
        };
      }
    });
    await this.playButton.click();
    await this.pauseButton.waitFor({ state: "visible" });
  }

  /**
   * Click pause and wait for the play button to reappear.
   *
   * audio.pause() on an element that was never truly playing may not
   * fire a native pause event. The synthetic event keeps React in sync,
   * and the waitFor guard ensures the re-render has completed.
   */
  async stop(): Promise<void> {
    await this.pauseButton.waitFor({ state: "visible" });
    await this.pauseButton.click();
    await this.simulateAudioEvent("pause");
    await this.playButton.waitFor({ state: "visible" });
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
