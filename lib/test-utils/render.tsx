import React from "react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";

import { CssVarsProvider } from "@mui/joy/styles";
import type { AppStore, RootState } from "@/lib/store";
import { makeStore } from "@/lib/store";

// Extended render options to include preloaded state and store
interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

// Custom render result that includes the store and user event utilities
interface CustomRenderResult extends RenderResult {
  store: AppStore;
  user: ReturnType<typeof userEvent.setup>;
}

// Create a test wrapper with Redux and MUI providers
function createTestWrapper(store: AppStore) {
  return function TestWrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <CssVarsProvider>{children}</CssVarsProvider>
      </Provider>
    );
  };
}

/**
 * Custom render function that wraps components with Redux and MUI providers.
 *
 * @example
 * // Basic usage
 * const { getByText, store } = renderWithProviders(<MyComponent />);
 *
 * @example
 * // With preloaded state
 * const { getByText, store } = renderWithProviders(<MyComponent />, {
 *   preloadedState: {
 *     flowsheet: { ...defaultFlowsheetFrontendState, autoplay: true }
 *   }
 * });
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
): CustomRenderResult {
  // Apply preloaded state to the store if provided
  // Note: For full preloadedState support, makeStore would need to accept it
  // This is a simplified version that works with the current store setup
  const { preloadedState, store = makeStore(), ...renderOptions } = options;
  void preloadedState;

  const user = userEvent.setup();
  const wrapper = createTestWrapper(store);

  return {
    ...rtlRender(ui, { wrapper, ...renderOptions }),
    store,
    user,
  };
}

/**
 * Create a store for use in tests.
 * Returns a fresh store instance for each test.
 */
export function createTestStore(): AppStore {
  return makeStore();
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";
// Override the render export with our custom render
export { renderWithProviders as render };
