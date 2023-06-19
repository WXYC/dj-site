import { CssVarsProvider, CssBaseline } from "@mui/joy";
import ViewProvider from "../src/components/theme/viewStyleToggle";
import wxycTheme from "../src/theme";
import React from "react";
import { MemoryRouter } from "react-router";
import '../src/index.css';
    
export const decorators = [
  (Story) => (
    <ViewProvider>
    <CssVarsProvider
      defaultMode='system'
      disableTransitionOnChange
      theme={wxycTheme}
    >
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    </CssVarsProvider>
    </ViewProvider>
  ),
];

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
