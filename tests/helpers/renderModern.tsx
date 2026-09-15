import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import modernTheme from "@/lib/features/experiences/modern/theme";
import { renderWithProviders } from "./render";

/**
 * Renders under the modern experience theme, whose palette carries the custom
 * `rotation` slot (the per-bin colors). Components that read
 * `theme.vars.palette.rotation` — the bin pickers and the rotation card badge —
 * must be tested through this rather than the bare-theme `renderWithProviders`,
 * or the palette read throws on the default Joy theme.
 *
 * Callers importing this pull in the modern theme, which imports `next/font`;
 * mock `next/font/google` and `next/font/local` in the test file (hoisted) so
 * the import resolves under jsdom.
 */
export function renderWithModernTheme(
  ui: ReactElement,
  options?: Parameters<typeof renderWithProviders>[1],
) {
  return renderWithProviders(<CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>, options);
}
