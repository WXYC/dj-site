import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let insertedCallback: (() => ReactNode) | null = null;
vi.mock("next/navigation", () => ({
  useServerInsertedHTML: (cb: () => ReactNode) => {
    insertedCallback = cb;
  },
}));

import InitColorScheme from "@/src/styles/InitColorScheme";

describe("InitColorScheme server-inserted init script", () => {
  renderToStaticMarkup(<InitColorScheme />);
  const markup = renderToStaticMarkup(<>{insertedCallback?.()}</>);

  it("emits a synchronous inline script (runs at parse time)", () => {
    expect(insertedCallback).not.toBeNull();
    expect(markup).toContain("<script");
    expect(markup).toContain("localStorage.getItem");
  });

  it("stamps the data-joy-color-scheme attribute classic CSS keys on", () => {
    expect(markup).toContain("data-joy-color-scheme");
    expect(markup).toContain("setAttribute");
  });

  it("reads the same storage keys CssVarsProvider persists to", () => {
    expect(markup).toContain("joy-mode");
    expect(markup).toContain("joy-color-scheme");
  });
});
