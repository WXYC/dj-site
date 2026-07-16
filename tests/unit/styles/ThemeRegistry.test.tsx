import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

// buildModernTheme pulls in next/font via getModernTheme; server-safe id
// validation lives in the registry module, but ThemeRegistry needs the built
// theme object, so next/font must be stubbed like themes.test.ts does.
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

// useThemePreferenceSync's own races/session/mutation behavior is covered by
// themePreferenceHooks.test.tsx; ThemeRegistry only owns wiring it in.
vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  useThemePreferenceSync: vi.fn(),
}));

// jsdom never runs inside Next's streaming-SSR flush provider, so the real
// hook would no-op (see server-inserted-html.shared-runtime.js: it reads
// from a context that defaults to null off the server). Capturing the
// callback ThemeRegistry passes in lets the test invoke the actual flush
// closure it owns, instead of exercising Next's SSR plumbing.
let capturedFlush: (() => ReactNode) | null = null;
vi.mock("next/navigation", () => ({
  useServerInsertedHTML: (callback: () => ReactNode) => {
    capturedFlush = callback;
  },
}));

// Spy on the theme CssVarsProvider receives without replacing its behavior,
// so ThemedProvider's classic/modern selection logic renders for real.
let capturedTheme: unknown = null;
vi.mock("@mui/joy/styles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mui/joy/styles")>();
  return {
    ...actual,
    CssVarsProvider: (props: Parameters<typeof actual.CssVarsProvider>[0]) => {
      capturedTheme = props.theme;
      return <actual.CssVarsProvider {...props} />;
    },
  };
});

import ThemeRegistry from "@/src/styles/ThemeRegistry";
import classicTheme from "@/lib/features/experiences/classic/theme";
import { getModernTheme } from "@/lib/features/experiences/modern/themes";

describe("ThemeRegistry theme selection", () => {
  beforeEach(() => {
    capturedTheme = null;
  });

  it("uses the classic theme for the classic experience", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="classic" themeId="stacks">
        <div>content</div>
      </ThemeRegistry>
    );

    expect(capturedTheme).toBe(classicTheme);
  });

  it("uses the resolved modern theme for the modern experience", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="modern" themeId="bluenote">
        <div>content</div>
      </ThemeRegistry>
    );

    expect(capturedTheme).toBe(getModernTheme("bluenote"));
    expect(capturedTheme).not.toBe(classicTheme);
  });

  it("falls back to the default modern theme for an unrecognized themeId", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="modern" themeId="not-a-real-theme">
        <div>content</div>
      </ThemeRegistry>
    );

    expect(capturedTheme).toBe(getModernTheme("stacks"));
  });
});

describe("ThemeRegistry SSR emotion-cache flush", () => {
  beforeEach(() => {
    capturedFlush = null;
  });

  it("registers a flush callback with the SSR-inserted-HTML hook", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="modern" themeId="stacks">
        <div>content</div>
      </ThemeRegistry>
    );

    expect(capturedFlush).not.toBeNull();
  });

  it("flushes a style tag carrying the emotion rules inserted during the mount render", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="modern" themeId="stacks">
        <div>content</div>
      </ThemeRegistry>
    );

    // GlobalStyles/CssBaseline insert real emotion-serialized rules through
    // the cache during the mount render, so the first flush must have
    // something queued rather than returning null.
    const styleElement = capturedFlush!() as React.ReactElement<{
      "data-emotion": string;
      dangerouslySetInnerHTML: { __html: string };
    }> | null;

    expect(styleElement).not.toBeNull();
    expect(styleElement!.type).toBe("style");
    expect(styleElement!.props["data-emotion"]).toEqual(
      expect.stringMatching(/^joy /)
    );
    expect(
      styleElement!.props.dangerouslySetInnerHTML.__html.length
    ).toBeGreaterThan(0);
  });

  it("returns null on a second flush once nothing new has been inserted", () => {
    render(
      <ThemeRegistry options={{ key: "joy" }} experience="modern" themeId="stacks">
        <div>content</div>
      </ThemeRegistry>
    );

    // First flush drains whatever the mount render inserted.
    capturedFlush!();
    // A second flush with no intervening render has nothing queued.
    const secondFlush = capturedFlush!();

    expect(secondFlush).toBeNull();
  });
});
