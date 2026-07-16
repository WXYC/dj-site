import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InitColorSchemeScript from "@mui/joy/InitColorSchemeScript";

describe("InitColorSchemeScript SSR contract", () => {
  const markup = renderToStaticMarkup(<InitColorSchemeScript />);

  it("emits a synchronous inline script (runs before hydration)", () => {
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
